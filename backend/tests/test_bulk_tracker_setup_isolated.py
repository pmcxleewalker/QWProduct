"""Bulk tracker setup isolated tests: CSV/review/router behavior with temporary Mongo DB."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from middleware.tenant import require_super_admin
from routes.bulk_tracker_setup import build_router
from services.bulk_tracker_setup import create_review, parse_csv


def _mongo_url() -> str:
    if os.environ.get("MONGO_URL"):
        return os.environ["MONGO_URL"]
    env_path = BACKEND_DIR / ".env"
    for line in env_path.read_text().splitlines():
        if line.startswith("MONGO_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("MONGO_URL is required")


@pytest_asyncio.fixture
async def temp_db():
    client = AsyncIOMotorClient(_mongo_url())
    db_name = f"test_bulk_tracker_{uuid.uuid4().hex[:10]}"
    db = client[db_name]
    try:
        yield db
    finally:
        await client.drop_database(db_name)
        client.close()


@pytest_asyncio.fixture
async def seeded_db(temp_db):
    await temp_db.tenants.insert_many([
        {"id": "TENANT_A", "name": "Tenant A", "slug": "tenant-a", "status": "active"},
        {"id": "TENANT_B", "name": "Tenant B", "slug": "tenant-b", "status": "active"},
    ])
    await temp_db.vehicles.insert_many([
        {"id": "CAR_A1", "tenant_id": "TENANT_A", "registration": "12-KY-999"},
        {"id": "CAR_B1", "tenant_id": "TENANT_B", "registration": "12-KY-777"},
    ])
    return temp_db


@pytest.fixture
def super_context():
    return SimpleNamespace(user_id="SUPER_1", user_email="superadmin@quickwing.com")


def _csv_bytes(rows: list[str], headers: str = "registration,tracker_id,sim_iccid,sim_msisdn,tracker_model") -> bytes:
    return (headers + "\n" + "\n".join(rows) + "\n").encode("utf-8")


class FakeProvider:
    def __init__(self, configured: bool):
        self.configured = configured


class FakeWorker:
    def __init__(self, configured: bool):
        self.provider = FakeProvider(configured=configured)

    @staticmethod
    def owner(batch_id, row):
        return f"bulk:{batch_id}:{row['id']}"


@pytest.mark.asyncio
async def test_parse_csv_utf8_bom_and_leading_zeroes():
    payload = "\ufeffregistration,tracker_id,sim_iccid,sim_msisdn,tracker_model\n12-KY-999,001234567890,001234567890123456,0007123456,QW-1\n"
    rows = parse_csv(payload.encode("utf-8"))
    assert rows[0]["tracker_id"] == "001234567890"
    assert rows[0]["sim_iccid"] == "001234567890123456"
    assert rows[0]["sim_msisdn"] == "0007123456"


@pytest.mark.asyncio
async def test_parse_csv_rejects_extra_headers():
    with pytest.raises(Exception) as exc:
        parse_csv(_csv_bytes(["12-KY-999,1234567890,123456789012345678,353871111111,QW-1"],
                             headers="registration,tracker_id,sim_iccid,sim_msisdn,tracker_model,tenant_id"))
    assert "CSV headers must be exactly" in str(exc.value)


@pytest.mark.asyncio
async def test_create_review_validation_and_conflicts(seeded_db, super_context):
    await seeded_db.tracker_devices.insert_one({
        "id": "DEV_EXIST", "tenant_id": "TENANT_A", "imei": "1234567890", "sim_iccid": "123456789012345678",
        "sim_number": "353871111111", "car_id": "CAR_A1", "is_active": True,
    })
    content = _csv_bytes([
        "12-KY-999,1234567890,123456789012345678,353871111111,Model-A",  # existing tracker/sim/vehicle in use
        "12-KY-777,1234567891,223456789012345678,353872222222,Model-B",  # foreign tenant vehicle
        "UNKNOWN,1234567892,323456789012345678,353873333333,Model-C",   # missing vehicle
    ])
    batch = await create_review(seeded_db, "TENANT_A", content, super_context)
    assert batch["valid"] is False
    errors = ["; ".join(r["errors"]) for r in batch["rows"]]
    assert any("Tracker ID already used" in e for e in errors)
    assert any("Vehicle belongs to another franchise" in e for e in errors)
    assert any("Vehicle not found" in e for e in errors)


@pytest.mark.asyncio
async def test_create_review_idempotent_same_csv_returns_same_batch(seeded_db, super_context):
    content = _csv_bytes(["12-KY-999,2234567890,423456789012345678,353874444444,Model-A"])
    first = await create_review(seeded_db, "TENANT_A", content, super_context)
    second = await create_review(seeded_db, "TENANT_A", content, super_context)
    assert first["id"] == second["id"]
    assert len(second["rows"]) == 1


@pytest.mark.asyncio
async def test_validate_duplicates_and_missing_fields_flag_all_rows(seeded_db, super_context):
    content = _csv_bytes([
        "12-KY-999,7777777777,123456789012345678,353871111111,Model-A",
        "12 ky 999,7777777777,123456789012345678,353871111111,Model-B",
        "12KY999,8888888888,223456789012345678,,Model-C",
    ])
    batch = await create_review(seeded_db, "TENANT_A", content, super_context)
    assert batch["valid"] is False
    for row in batch["rows"][:2]:
        text = ";".join(row["errors"])
        assert "Duplicate tracker ID in CSV" in text
        assert "Duplicate ICCID in CSV" in text
        assert "Duplicate MSISDN in CSV" in text
        assert "Duplicate vehicle registration in CSV" in text
    assert any("Missing sim_msisdn" in err for err in batch["rows"][2]["errors"])


@pytest.mark.asyncio
async def test_parse_csv_rejects_wrong_column_count_and_empty_and_too_many_rows():
    with pytest.raises(Exception) as wrong_cols:
        parse_csv(_csv_bytes(["12-KY-999,1234567890,123456789012345678,353871111111"]))
    assert "wrong number of columns" in str(wrong_cols.value)

    with pytest.raises(Exception) as empty_csv:
        parse_csv("registration,tracker_id,sim_iccid,sim_msisdn,tracker_model\n".encode("utf-8"))
    assert "contains no tracker rows" in str(empty_csv.value)

    too_many = [f"12-KY-{i:03d},1234567{i:03d},1234567890123456{i:02d},35387{i:06d},QW" for i in range(201)]
    with pytest.raises(Exception) as overflow:
        parse_csv(_csv_bytes(too_many))
    assert "Maximum 200 rows per CSV" in str(overflow.value)


@pytest.mark.asyncio
async def test_review_rejects_payload_over_512kb(seeded_db):
    # 513 KB plain body should be rejected by review endpoint.
    huge = ("a" * (513 * 1024)).encode("utf-8")
    async with await _build_test_client(seeded_db, configured=True) as client:
        files = {"file": ("rows.csv", huge, "text/csv")}
        data = {"tenant_id": "TENANT_A"}
        res = await client.post("/api/platform/bulk-tracker-setup/review", data=data, files=files)
    assert res.status_code == 413


@pytest.mark.asyncio
async def test_concurrent_identical_review_uploads_single_saved_batch_with_unique_index(seeded_db, super_context):
    await seeded_db.tracker_setup_batches.create_index("id", unique=True)
    content = _csv_bytes(["12-KY-999,6234567890,823456789012345678,353878888888,Model-A"])
    first, second = await asyncio.gather(
        create_review(seeded_db, "TENANT_A", content, super_context),
        create_review(seeded_db, "TENANT_A", content, super_context),
    )
    assert first["id"] == second["id"]
    assert await seeded_db.tracker_setup_batches.count_documents({"id": first["id"]}) == 1


@pytest.mark.asyncio
async def test_activation_rejects_competing_claims_across_tenants_atomically(seeded_db, super_context):
    batch_a = await create_review(
        seeded_db,
        "TENANT_A",
        _csv_bytes(["12-KY-999,7234567890,923456789012345678,353879999999,Model-A"]),
        super_context,
    )
    batch_b = await create_review(
        seeded_db,
        "TENANT_B",
        _csv_bytes(["12-KY-777,7234567890,923456789012345678,353870000001,Model-B"]),
        super_context,
    )
    async with await _build_test_client(seeded_db, configured=True) as client:
        first = await client.post(f"/api/platform/bulk-tracker-setup/batches/{batch_a['id']}/activate")
        second = await client.post(f"/api/platform/bulk-tracker-setup/batches/{batch_b['id']}/activate")
    assert first.status_code == 200
    assert second.status_code == 409
    assert "already used or reserved" in second.json()["detail"]
    claims = await seeded_db.tracker_setup_claims.find({}, {"_id": 1, "owner": 1}).to_list(None)
    assert claims
    assert all(c["owner"].startswith(f"bulk:{batch_a['id']}:") for c in claims)


@pytest.mark.asyncio
async def test_retry_endpoint_returns_503_when_not_configured(seeded_db, super_context):
    batch = await create_review(
        seeded_db,
        "TENANT_A",
        _csv_bytes(["12-KY-999,8334567890,133456789012345678,353870000002,Model-A"]),
        super_context,
    )
    await seeded_db.tracker_setup_batches.update_one(
        {"id": batch["id"]},
        {"$set": {"started_at": "2026-01-01T00:00:00+00:00", "rows.0.status": "Failed"}},
    )
    async with await _build_test_client(seeded_db, configured=False) as client:
        res = await client.post(f"/api/platform/bulk-tracker-setup/batches/{batch['id']}/rows/0/retry")
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_retry_endpoint_returns_409_when_row_lease_held(seeded_db, super_context):
    batch = await create_review(
        seeded_db,
        "TENANT_A",
        _csv_bytes(["12-KY-999,9334567890,233456789012345678,353870000003,Model-A"]),
        super_context,
    )
    await seeded_db.tracker_setup_batches.update_one(
        {"id": batch["id"]},
        {"$set": {
            "started_at": "2026-01-01T00:00:00+00:00",
            "rows.0.status": "Failed",
            "rows.0.lease_until": 4102444800,
        }},
    )
    async with await _build_test_client(seeded_db, configured=True) as client:
        res = await client.post(f"/api/platform/bulk-tracker-setup/batches/{batch['id']}/rows/0/retry")
    assert res.status_code == 409


async def _build_test_client(db, configured: bool):
    app = FastAPI()
    app.include_router(build_router(db, FakeWorker(configured=configured)), prefix="/api")
    app.dependency_overrides[require_super_admin] = lambda: SimpleNamespace(user_id="SUPER_1", user_email="superadmin@quickwing.com")
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_review_invalid_never_inserts_claims_or_trackers(seeded_db):
    async with await _build_test_client(seeded_db, configured=False) as client:
        files = {"file": ("rows.csv", _csv_bytes(["BAD-REG,,123,123,Model"]), "text/csv")}
        data = {"tenant_id": "TENANT_A"}
        res = await client.post("/api/platform/bulk-tracker-setup/review", data=data, files=files)
    assert res.status_code == 200
    body = res.json()
    assert body["valid"] is False
    assert await seeded_db.tracker_setup_claims.count_documents({}) == 0
    assert await seeded_db.tracker_devices.count_documents({"provisioning_batch_id": body["id"]}) == 0


@pytest.mark.asyncio
async def test_activate_requires_configured_and_blocks_outbound(seeded_db, super_context):
    batch = await create_review(
        seeded_db,
        "TENANT_A",
        _csv_bytes(["12-KY-999,3334567890,523456789012345678,353875555555,Model-A"]),
        super_context,
    )
    async with await _build_test_client(seeded_db, configured=False) as client:
        res = await client.post(f"/api/platform/bulk-tracker-setup/batches/{batch['id']}/activate")
    assert res.status_code == 503
    assert "not configured" in res.json()["detail"].lower()
    assert await seeded_db.tracker_setup_claims.count_documents({}) == 0


@pytest.mark.asyncio
async def test_activate_conflict_releases_claims(seeded_db, super_context):
    batch = await create_review(
        seeded_db,
        "TENANT_A",
        _csv_bytes(["12-KY-999,4334567890,623456789012345678,353876666666,Model-A"]),
        super_context,
    )
    # create conflict after review, before activate
    await seeded_db.tracker_devices.insert_one({
        "id": "DEV_CONFLICT", "tenant_id": "TENANT_A", "imei": "4334567890", "sim_iccid": "999",
        "sim_number": "353870000000", "car_id": "CAR_A1", "is_active": True,
    })
    async with await _build_test_client(seeded_db, configured=True) as client:
        res = await client.post(f"/api/platform/bulk-tracker-setup/batches/{batch['id']}/activate")
    assert res.status_code == 409
    assert await seeded_db.tracker_setup_claims.count_documents({}) == 0


@pytest.mark.asyncio
async def test_activate_idempotent_double_call(seeded_db, super_context):
    batch = await create_review(
        seeded_db,
        "TENANT_A",
        _csv_bytes(["12-KY-999,5334567890,723456789012345678,353877777777,Model-A"]),
        super_context,
    )
    async with await _build_test_client(seeded_db, configured=True) as client:
        res1, res2 = await asyncio.gather(
            client.post(f"/api/platform/bulk-tracker-setup/batches/{batch['id']}/activate"),
            client.post(f"/api/platform/bulk-tracker-setup/batches/{batch['id']}/activate"),
        )
    assert res1.status_code == 200 and res2.status_code == 200
    current = await seeded_db.tracker_setup_batches.find_one({"id": batch["id"]}, {"_id": 0})
    assert bool(current.get("started_at")) is True
    assert len(current["rows"]) == 1
