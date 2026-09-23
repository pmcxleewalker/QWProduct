"""Tracker setup worker tests: activation/SMS progression/retry semantics in isolated DB."""
import asyncio
import os
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.bulk_tracker_setup import COMMANDS, now
from services.onence_client import ProviderError
from services.tracker_setup_worker import TrackerSetupWorker


def _mongo_url() -> str:
    if os.environ.get("MONGO_URL"):
        return os.environ["MONGO_URL"]
    for line in (BACKEND_DIR / ".env").read_text().splitlines():
        if line.startswith("MONGO_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("MONGO_URL is required")


@pytest_asyncio.fixture
async def temp_db():
    client = AsyncIOMotorClient(_mongo_url())
    db_name = f"test_tracker_worker_{uuid.uuid4().hex[:10]}"
    db = client[db_name]
    try:
        yield db
    finally:
        await client.drop_database(db_name)
        client.close()


def make_row(status="Ready to start", retry_requested=False):
    return {
        "id": "0",
        "registration": "12-KY-999",
        "tracker_id": "1234567890",
        "sim_iccid": "123456789012345678",
        "sim_msisdn": "353871111111",
        "tracker_model": "QW",
        "car_id": "CAR_A1",
        "device_id": "DEV_NEW",
        "errors": [],
        "error": "",
        "status": status,
        "delivered": 0,
        "activation": {},
        "messages": [{"payload": p, "state": "planned", "attempts": []} for p in COMMANDS],
        "autorun": True,
        "retry_requested": retry_requested,
        "lease_until": 0,
    }


class FakeProvider:
    def __init__(self, sim_status="Enabled"):
        self.configured = True
        self.sim_status = sim_status
        self.activate_calls = 0
        self.sent_payloads = []
        self.detail_by_id = {}
        self.fail_payload = None
        self.sms_list_records = []
        self.send_delay = 0

    async def get_sim(self, iccid):
        return {"iccid": iccid, "msisdn": "353871111111", "status": self.sim_status}

    async def activate_sim(self, iccid):
        self.activate_calls += 1
        self.sim_status = "Enabled"
        return {"http_status": 200}

    async def send_sms(self, iccid, payload):
        if self.send_delay:
            await asyncio.sleep(self.send_delay)
        self.sent_payloads.append(payload)
        if payload == self.fail_payload:
            raise ProviderError("send failed", uncertain=False, http_status=500)
        provider_id = str(len(self.sent_payloads))
        return {"provider_id": provider_id, "http_status": 201}

    async def sms_detail(self, iccid, message_id):
        status = self.detail_by_id.get(message_id, "PENDING")
        return {"id": int(message_id), "status": {"description": status}, "submit_date": now()}

    async def sms_list(self, iccid, page):
        return self.sms_list_records


async def _seed_batch(db, row):
    await db.tenants.insert_one({"id": "TENANT_A", "name": "Tenant A", "status": "active"})
    await db.vehicles.insert_one({"id": "CAR_A1", "tenant_id": "TENANT_A", "registration": "12-KY-999"})
    await db.tracker_setup_batches.insert_one({
        "id": "BATCH_1",
        "tenant_id": "TENANT_A",
        "tenant_name": "Tenant A",
        "created_at": now(),
        "started_at": now(),
        "valid": True,
        "rows": [row],
    })


@pytest.mark.asyncio
async def test_worker_enabled_sim_does_not_activate_again(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row()
    await _seed_batch(temp_db, row)

    await worker.process_row("BATCH_1", 0)

    assert provider.activate_calls == 0
    assert provider.sent_payloads == list(COMMANDS)
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["status"] == "Waiting for delivery"
    assert current["rows"][0]["delivered"] == 0


@pytest.mark.asyncio
async def test_worker_disabled_sim_put_once_then_enabled(temp_db):
    provider = FakeProvider(sim_status="Disabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row()
    await _seed_batch(temp_db, row)

    await worker.process_row("BATCH_1", 0)

    assert provider.activate_calls == 1
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["activation"]["confirmed"] is True


@pytest.mark.asyncio
async def test_worker_delivery_progress_to_configured_without_resend(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row()
    await _seed_batch(temp_db, row)

    await worker.process_row("BATCH_1", 0)
    first_count = len(provider.sent_payloads)
    provider.detail_by_id = {"1": "DELIVERED", "2": "DELIVERED", "3": "DELIVERED", "4": "DELIVERED"}

    await worker.process_row("BATCH_1", 0)

    assert len(provider.sent_payloads) == first_count
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["status"] == "Configured"
    assert current["rows"][0]["delivered"] == 4


@pytest.mark.asyncio
async def test_worker_failed_second_sms_stops_later_messages(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    provider.fail_payload = COMMANDS[1]
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row()
    await _seed_batch(temp_db, row)

    await worker.process_row("BATCH_1", 0)

    assert provider.sent_payloads == [COMMANDS[0], COMMANDS[1]]
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["status"] == "Failed"
    assert "failed" in current["rows"][0]["error"].lower()


@pytest.mark.asyncio
async def test_worker_retry_resumes_failed_and_unsent_not_delivered_or_pending(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row(status="Failed", retry_requested=True)
    row["messages"][0].update(state="delivered", provider_id="11", attempts=[{"state": "delivered", "provider_id": "11"}])
    row["messages"][1].update(state="failed", attempts=[{"state": "failed"}])
    row["messages"][2].update(state="planned", attempts=[])
    row["messages"][3].update(state="pending", provider_id="44", attempts=[{"state": "pending", "provider_id": "44"}])
    await _seed_batch(temp_db, row)

    await worker.process_row("BATCH_1", 0)

    assert provider.sent_payloads == [COMMANDS[1], COMMANDS[2]]
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    states = [m["state"] for m in current["rows"][0]["messages"]]
    assert states[0] == "delivered"
    assert states[3] == "pending"


@pytest.mark.asyncio
async def test_worker_ambiguous_uncertain_match_refuses_resend(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    provider.sms_list_records = [
        {
            "id": 200,
            "iccid": "123456789012345678",
            "payload": COMMANDS[0],
            "source_address": "1234",
            "sms_type": {"description": "MT"},
            "submit_date": now(),
        },
        {
            "id": 201,
            "iccid": "123456789012345678",
            "payload": COMMANDS[0],
            "source_address": "1234",
            "sms_type": {"description": "MT"},
            "submit_date": now(),
        },
    ]
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row(status="Failed", retry_requested=True)
    row["messages"][0].update(state="uncertain", attempts=[{"started_at": now(), "state": "uncertain"}])
    await _seed_batch(temp_db, row)

    await worker.process_row("BATCH_1", 0)

    assert provider.sent_payloads == []
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["status"] == "Failed"
    assert "unconfirmed" in current["rows"][0]["error"].lower() or "retry" in current["rows"][0]["error"].lower()


@pytest.mark.asyncio
async def test_worker_concurrent_same_row_single_ordered_send_and_single_tracker(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    provider.send_delay = 0.02
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row()
    await _seed_batch(temp_db, row)

    await asyncio.gather(worker.process_row("BATCH_1", 0), worker.process_row("BATCH_1", 0))

    assert provider.sent_payloads == list(COMMANDS)
    assert await temp_db.tracker_devices.count_documents({"id": "DEV_NEW"}) == 1


@pytest.mark.asyncio
async def test_worker_delivery_progress_1_2_3_4_without_resend(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row(status="Waiting for delivery")
    row["messages"][0].update(state="pending", provider_id="1", attempts=[{"state": "pending", "provider_id": "1"}])
    row["messages"][1].update(state="pending", provider_id="2", attempts=[{"state": "pending", "provider_id": "2"}])
    row["messages"][2].update(state="pending", provider_id="3", attempts=[{"state": "pending", "provider_id": "3"}])
    row["messages"][3].update(state="pending", provider_id="4", attempts=[{"state": "pending", "provider_id": "4"}])
    await _seed_batch(temp_db, row)

    for i in range(1, 5):
        provider.detail_by_id = {str(j): ("DELIVERED" if j <= i else "PENDING") for j in range(1, 5)}
        await worker.process_row("BATCH_1", 0)
        current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
        assert current["rows"][0]["delivered"] == i

    assert provider.sent_payloads == []
    final_batch = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert final_batch["rows"][0]["status"] == "Configured"


@pytest.mark.asyncio
async def test_worker_reconcile_late_deliveries_even_with_earlier_failed_then_retry_failed_only(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row(status="Waiting for delivery")
    row["messages"][0].update(state="failed", provider_id="1", attempts=[{"state": "failed", "provider_id": "1"}])
    row["messages"][1].update(state="pending", provider_id="2", attempts=[{"state": "pending", "provider_id": "2"}])
    row["messages"][2].update(state="pending", provider_id="3", attempts=[{"state": "pending", "provider_id": "3"}])
    row["messages"][3].update(state="pending", provider_id="4", attempts=[{"state": "pending", "provider_id": "4"}])
    await _seed_batch(temp_db, row)

    provider.detail_by_id = {"1": "FAILED", "2": "DELIVERED", "3": "DELIVERED", "4": "DELIVERED"}
    await worker.process_row("BATCH_1", 0)

    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["status"] == "Failed"
    assert current["rows"][0]["delivered"] == 3

    await temp_db.tracker_setup_batches.update_one(
        {"id": "BATCH_1"},
        {"$set": {"rows.0.retry_requested": True, "rows.0.autorun": True, "rows.0.status": "Failed"}},
    )
    provider.detail_by_id = {"1": "FAILED", "2": "DELIVERED", "3": "DELIVERED", "4": "DELIVERED"}
    await worker.process_row("BATCH_1", 0)
    assert provider.sent_payloads == [COMMANDS[0]]


@pytest.mark.asyncio
async def test_worker_known_failed_provider_id_delivered_before_retry_zero_resend(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row(status="Failed", retry_requested=True)
    row["messages"][0].update(state="failed", provider_id="1", attempts=[{"state": "failed", "provider_id": "1"}])
    for idx in [1, 2, 3]:
        row["messages"][idx].update(state="delivered", provider_id=str(idx + 1), attempts=[{"state": "delivered", "provider_id": str(idx + 1)}])
    await _seed_batch(temp_db, row)

    provider.detail_by_id = {"1": "DELIVERED", "2": "DELIVERED", "3": "DELIVERED", "4": "DELIVERED"}
    await worker.process_row("BATCH_1", 0)

    assert provider.sent_payloads == []
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["status"] == "Configured"
    assert current["rows"][0]["delivered"] == 4


@pytest.mark.asyncio
async def test_worker_retry_reconciles_unique_timeout_match_and_does_not_resend(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row(status="Failed", retry_requested=True)
    row["messages"][0].update(
        state="uncertain",
        attempts=[{"started_at": now(), "state": "uncertain"}],
    )
    for idx in [1, 2, 3]:
        row["messages"][idx].update(state="delivered", provider_id=str(400 + idx), attempts=[{"state": "delivered", "provider_id": str(400 + idx)}])
    await _seed_batch(temp_db, row)

    provider.sms_list_records = [{
        "id": 321,
        "iccid": "123456789012345678",
        "payload": COMMANDS[0],
        "source_address": "1234",
        "sms_type": {"description": "MT"},
        "submit_date": now(),
    }]
    provider.detail_by_id = {"321": "DELIVERED"}
    await worker.process_row("BATCH_1", 0)

    assert provider.sent_payloads == []
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["messages"][0]["provider_id"] == "321"
    assert current["rows"][0]["status"] == "Configured"


@pytest.mark.asyncio
async def test_worker_retry_zero_match_refuses_resend_and_keeps_failed(temp_db):
    provider = FakeProvider(sim_status="Enabled")
    worker = TrackerSetupWorker(temp_db, provider=provider)
    row = make_row(status="Failed", retry_requested=True)
    row["messages"][0].update(
        state="uncertain",
        attempts=[{"started_at": now(), "state": "uncertain"}],
    )
    await _seed_batch(temp_db, row)

    provider.sms_list_records = []
    await worker.process_row("BATCH_1", 0)

    assert provider.sent_payloads == []
    current = await temp_db.tracker_setup_batches.find_one({"id": "BATCH_1"}, {"_id": 0})
    assert current["rows"][0]["status"] == "Failed"
    assert "unconfirmed" in current["rows"][0]["error"].lower() or "retry" in current["rows"][0]["error"].lower()
