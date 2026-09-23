"""Restart-safe provisioning. Durable intent precedes every external mutation."""
import asyncio
import logging
import time
import uuid
from datetime import datetime

from pymongo import ReturnDocument
from services.bulk_tracker_setup import now, row_conflicts
from services.onence_client import OneNCEClient, ProviderError

logger = logging.getLogger(__name__)


class TrackerSetupWorker:
    def __init__(self, db, provider=None):
        self.db = db
        self.provider = provider or OneNCEClient()
        self.task = None

    async def start(self):
        await self.db.tracker_setup_batches.create_index("id", unique=True)
        await self.db.tracker_devices.create_index("id", unique=True, sparse=True)
        if self.task is None:
            self.task = asyncio.create_task(self.loop())

    async def stop(self):
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None

    async def loop(self):
        while True:
            try:
                if self.provider.configured:
                    batches = await self.db.tracker_setup_batches.find(
                        {"started_at": {"$exists": True}, "rows.autorun": True}, {"_id": 0}).to_list(None)
                    for batch in batches:
                        for index, row in enumerate(batch["rows"]):
                            if row.get("autorun"):
                                await self.process_row(batch["id"], index)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Tracker setup worker interrupted (%s)", type(exc).__name__)
            await asyncio.sleep(10)

    async def process_row(self, batch_id, index):
        if not self.provider.configured:
            return
        prefix = f"rows.{index}"
        lease = str(uuid.uuid4())
        batch = await self.db.tracker_setup_batches.find_one_and_update(
            {"id": batch_id, "started_at": {"$exists": True}, f"{prefix}.autorun": True,
             f"{prefix}.lease_until": {"$lt": time.time()}},
            {"$set": {f"{prefix}.lease_token": lease, f"{prefix}.lease_until": time.time() + 120}},
            projection={"_id": 0}, return_document=ReturnDocument.AFTER)
        if not batch:
            return
        row = batch["rows"][index]
        selector = {"id": batch_id, f"{prefix}.lease_token": lease}

        async def save():
            row["lease_until"] = time.time() + 120
            row["updated_at"] = now()
            row["delivered"] = sum(message["state"] == "delivered" for message in row["messages"])
            result = await self.db.tracker_setup_batches.update_one(selector, {"$set": {prefix: row}})
            if not result.matched_count:
                raise ProviderError("Provisioning ownership changed; no further messages sent")

        try:
            row["error"] = ""
            tenant = await self.db.tenants.find_one({"id": batch["tenant_id"]}, {"_id": 0, "id": 1})
            conflicts = await row_conflicts(self.db, batch["tenant_id"], row, self.owner(batch_id, row))
            if not tenant or conflicts:
                raise ProviderError("; ".join(conflicts) or "Franchise no longer exists")
            await self.ensure_activated(batch, row, save)
            await self.ensure_tracker(batch, row)
            row["status"] = "Sending messages"
            await save()
            # Reconcile all accepted messages first: an early failure must not hide
            # later delivery confirmations or permit a delivered message to be retried.
            for message in row["messages"]:
                if message["state"] != "delivered":
                    await self.reconcile(row, message, save)
            for message in row["messages"]:
                if message["state"] == "delivered":
                    continue
                if message["state"] == "pending":
                    continue  # 1NCE already queues delivery; do not duplicate a queued SMS.
                if message["state"] in {"sending", "uncertain"}:
                    raise ProviderError("SMS outcome is unconfirmed. Retry checks 1NCE records only; no duplicate will be sent.")
                if message["state"] == "failed" and not row.get("retry_requested"):
                    raise ProviderError("A configuration message failed. Use Retry failed.")
                await self.send(row, message, save)
            row["retry_requested"] = False
            row["delivered"] = sum(m["state"] == "delivered" for m in row["messages"])
            row["status"] = "Configured" if row["delivered"] == 4 else "Waiting for delivery"
            row["autorun"] = row["status"] != "Configured"
            if row["status"] == "Configured":
                await self.db.tracker_devices.update_one(
                    {"id": row["device_id"], "tenant_id": batch["tenant_id"], "provisioning_batch_id": batch_id},
                    {"$set": {"is_active": True, "updated_at": now()}})
            await save()
        except ProviderError as exc:
            row.update(status="Failed", error=str(exc), autorun=False, retry_requested=False)
            await save()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Tracker setup row failed (%s)", type(exc).__name__)
            row.update(status="Failed", error="Setup interrupted. Retry will check saved progress before continuing.",
                       autorun=False, retry_requested=False)
            await save()
        finally:
            await self.db.tracker_setup_batches.update_one(selector, {"$set": {f"{prefix}.lease_until": 0}})

    @staticmethod
    def owner(batch_id, row):
        return f"bulk:{batch_id}:{row['id']}"

    async def ensure_activated(self, batch, row, save):
        if row["activation"].get("confirmed"):
            return
        row["status"] = "Activating SIM"
        await save()
        sim = await self.provider.get_sim(row["sim_iccid"])
        if sim.get("msisdn") and str(sim["msisdn"]).lstrip("+") != row["sim_msisdn"]:
            raise ProviderError("CSV MSISDN does not match this SIM in 1NCE")
        if sim["status"] == "Disabled":
            if row["activation"].get("state") in {"requested", "uncertain"}:
                raise ProviderError("SIM activation is not confirmed. Retry checks its state without repeating activation.")
            row["activation"].update(state="requested", requested_at=now())
            await save()
            try:
                result = await self.provider.activate_sim(row["sim_iccid"])
                row["activation"].update(result)
                await save()
            except ProviderError as exc:
                row["activation"].update(state="uncertain" if exc.uncertain else "failed",
                                         http_status=exc.http_status, error=str(exc))
                await save()
                raise
            sim = await self.provider.get_sim(row["sim_iccid"])
        if sim["status"] != "Enabled":
            raise ProviderError("SIM activation not yet confirmed. Retry checks the SIM state.")
        row["activation"].update(state="enabled", confirmed=True, confirmed_at=now(), result=sim)
        await save()

    async def ensure_tracker(self, batch, row):
        doc = {"id": row["device_id"], "tenant_id": batch["tenant_id"], "car_id": row["car_id"],
               "imei": row["tracker_id"], "sim_iccid": row["sim_iccid"], "sim_number": row["sim_msisdn"],
               "tracker_model": row["tracker_model"], "apn": "sensor.net", "label": row["tracker_model"],
               "is_active": False, "is_demo": False, "verified_with_sinotrack": False,
               "provisioning_batch_id": batch["id"], "created_at": now(), "updated_at": now()}
        await self.db.tracker_devices.update_one({"id": doc["id"]}, {"$setOnInsert": doc}, upsert=True)

    async def send(self, row, message, save):
        message.update(state="sending", provider_id=None)
        attempt = {"started_at": now()}
        message["attempts"].append(attempt)
        await save()
        try:
            result = await self.provider.send_sms(row["sim_iccid"], message["payload"])
            message.update(state="pending", provider_id=result["provider_id"])
            attempt.update(result, accepted_at=now(), state="pending")
        except ProviderError as exc:
            state = "uncertain" if exc.uncertain else "failed"
            message["state"] = state
            attempt.update(state=state, error=str(exc), http_status=exc.http_status)
            await save()
            raise
        await save()

    async def reconcile(self, row, message, save):
        if message["state"] in {"sending", "uncertain"} and not message.get("provider_id"):
            matches = []
            started = datetime.fromisoformat(message["attempts"][-1]["started_at"])
            complete = False
            for page in range(1, 11):
                await save()
                records = await self.provider.sms_list(row["sim_iccid"], page)
                for record in records:
                    try:
                        submitted = datetime.fromisoformat(record["submit_date"].replace("Z", "+00:00"))
                        delta = (submitted - started).total_seconds()
                    except (KeyError, ValueError, TypeError):
                        continue
                    if (str(record.get("iccid")) == row["sim_iccid"] and record.get("payload") == message["payload"]
                            and record.get("source_address") == "1234" and -5 <= delta <= 120
                            and (record.get("sms_type") or {}).get("description") == "MT"):
                        matches.append(record)
                if len(records) < 100:
                    complete = True
                    break
            if complete and len(matches) == 1 and str(matches[0].get("id", "")).isdigit():
                message["provider_id"] = str(matches[0]["id"])
                message["attempts"][-1]["provider_id"] = message["provider_id"]
                await save()
            else:
                return  # Never blindly repeat an uncertain POST, including truncated searches.
        if not message.get("provider_id"):
            return
        await save()
        detail = await self.provider.sms_detail(row["sim_iccid"], message["provider_id"])
        status = (detail.get("status") or {}).get("description", "").upper()
        # Only an explicit delivery confirmation contributes to 4/4.
        state = {"DELIVERED": "delivered", "FAILED": "failed", "EXPIRED": "failed",
                 "PENDING": "pending", "BUFFERED": "pending", "SENT": "pending"}.get(status, "pending")
        message["state"] = state
        result = {key: detail.get(key) for key in ("id", "submit_date", "delivery_date", "expiry_date", "final_date", "status")}
        message["attempts"][-1].update(state=state, result=result, checked_at=now())
        await save()