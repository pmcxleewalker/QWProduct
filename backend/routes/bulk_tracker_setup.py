"""Super-admin-only bulk provisioning endpoints, using existing authentication."""
import time
import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from middleware.tenant import require_super_admin
from services.bulk_tracker_setup import FIELDS, MAX_BYTES, create_review, now, row_conflicts
from services.onence_client import NOT_CONFIGURED
from services.tracker_asset_claims import claim_assets, device_keys, release_assets


class SetupRowView(BaseModel):
    id: str
    registration: str
    tracker_id: str
    sim_iccid: str
    sim_msisdn: str
    tracker_model: str
    status: Literal["Ready to start", "Activating SIM", "Sending messages", "Waiting for delivery", "Configured", "Failed"]
    delivered: int = Field(ge=0, le=4)
    errors: List[str]
    error: str
    retry_requested: bool = False


class BatchView(BaseModel):
    id: str
    tenant_id: str
    tenant_name: str
    created_at: str
    started_at: Optional[str] = None
    valid: bool
    rows: List[SetupRowView]


class BatchSummary(BaseModel):
    id: str
    tenant_id: str
    tenant_name: str
    created_at: str
    row_count: int


class SetupIndex(BaseModel):
    configured: bool
    batches: List[BatchSummary]


def build_router(db, worker):
    router = APIRouter(prefix="/platform/bulk-tracker-setup", dependencies=[Depends(require_super_admin)])

    async def get_batch(batch_id):
        batch = await db.tracker_setup_batches.find_one({"id": batch_id}, {"_id": 0})
        if not batch:
            raise HTTPException(404, "Batch not found")
        return batch

    def require_configured():
        if not worker.provider.configured:
            raise HTTPException(503, NOT_CONFIGURED)

    @router.get("", response_model=SetupIndex)
    async def index():
        batches = await db.tracker_setup_batches.find({}, {"_id": 0, "id": 1, "tenant_id": 1,
            "tenant_name": 1, "created_at": 1, "rows.id": 1}).sort("created_at", -1).to_list(None)
        return {"configured": worker.provider.configured,
                "batches": [dict(b, row_count=len(b.pop("rows"))) for b in batches]}

    @router.get("/template")
    async def template():
        return Response(",".join(FIELDS) + "\r\n", media_type="text/csv",
                        headers={"Content-Disposition": 'attachment; filename="quick-wing-tracker-template.csv"'})

    @router.post("/review", response_model=BatchView)
    async def review(tenant_id: str = Form(...), file: UploadFile = File(...), context=Depends(require_super_admin)):
        content = await file.read(MAX_BYTES + 1)
        await file.close()
        if len(content) > MAX_BYTES:
            raise HTTPException(413, "CSV must be 512 KB or smaller")
        return await create_review(db, tenant_id, content, context)

    @router.get("/batches/{batch_id}", response_model=BatchView)
    async def detail(batch_id: str):
        return await get_batch(batch_id)

    @router.post("/batches/{batch_id}/activate", response_model=BatchView)
    async def activate(batch_id: str, context=Depends(require_super_admin)):
        require_configured()
        batch = await get_batch(batch_id)
        if batch.get("started_at"):
            return batch
        if not batch["valid"]:
            raise HTTPException(400, "Resolve every CSV validation error before activation")
        lease = str(uuid.uuid4())
        locked = await db.tracker_setup_batches.find_one_and_update(
            {"id": batch_id, "started_at": {"$exists": False}, "$or": [
                {"start_lease_until": {"$exists": False}}, {"start_lease_until": {"$lt": time.time()}}]},
            {"$set": {"start_lease": lease, "start_lease_until": time.time() + 120}},
            projection={"_id": 0}, return_document=ReturnDocument.AFTER)
        if not locked:
            return await get_batch(batch_id)
        try:
            if not await db.tenants.find_one({"id": batch["tenant_id"]}, {"_id": 0, "id": 1}):
                raise HTTPException(404, "Franchise not found")
            for row in locked["rows"]:
                renewed = await db.tracker_setup_batches.update_one(
                    {"id": batch_id, "start_lease": lease},
                    {"$set": {"start_lease_until": time.time() + 120}})
                if not renewed.matched_count:
                    raise HTTPException(409, "Another request is starting this batch")
                owner = worker.owner(batch_id, row)
                keys = device_keys(row["tracker_id"], row["sim_iccid"], row["sim_msisdn"], row["car_id"])
                await claim_assets(db, owner, keys)
                conflicts = await row_conflicts(db, batch["tenant_id"], row, owner)
                if conflicts:
                    raise HTTPException(409, f"{row['registration']}: " + "; ".join(conflicts))
                row.update(autorun=True, retry_requested=False)
            result = await db.tracker_setup_batches.update_one(
                {"id": batch_id, "start_lease": lease, "started_at": {"$exists": False}},
                {"$set": {"started_at": now(), "started_by": context.user_id,
                          "started_by_email": context.user_email, "rows": locked["rows"]}})
            if not result.matched_count:
                raise HTTPException(409, "Another request is starting this batch")
        except Exception:
            fresh = await get_batch(batch_id)
            if not fresh.get("started_at") and fresh.get("start_lease") == lease:
                for row in locked["rows"]:
                    await release_assets(db, worker.owner(batch_id, row))
            raise
        finally:
            await db.tracker_setup_batches.update_one({"id": batch_id, "start_lease": lease},
                {"$unset": {"start_lease": "", "start_lease_until": ""}})
        return await get_batch(batch_id)

    @router.post("/batches/{batch_id}/rows/{row_id}/retry", response_model=BatchView)
    async def retry(batch_id: str, row_id: str, context=Depends(require_super_admin)):
        require_configured()
        batch = await get_batch(batch_id)
        if not batch.get("started_at"):
            raise HTTPException(400, "Activate the reviewed batch first")
        index = next((i for i, r in enumerate(batch["rows"]) if r["id"] == row_id), None)
        if index is None:
            raise HTTPException(404, "Tracker row not found")
        prefix = f"rows.{index}"
        result = await db.tracker_setup_batches.update_one(
            {"id": batch_id, f"{prefix}.status": {"$in": ["Failed", "Waiting for delivery"]},
             f"{prefix}.lease_until": {"$lt": time.time()}},
            {"$set": {f"{prefix}.retry_requested": True, f"{prefix}.autorun": True,
                      f"{prefix}.last_retry_by": context.user_id, f"{prefix}.last_retry_at": now()}})
        if not result.matched_count and batch["rows"][index]["status"] != "Configured":
            raise HTTPException(409, "This tracker is being updated. Retry after its current operation finishes.")
        return await get_batch(batch_id)

    return router