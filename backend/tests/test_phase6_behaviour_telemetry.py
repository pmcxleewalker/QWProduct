"""Phase 6 Backend Tests — Fleet Telemetry + Driver Behaviour."""
import os
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-media-hub-77.preview.emergentagent.com").rstrip("/")
TENANT_A = "f95fbe53-46cc-4f29-af6b-b9ea51758cbd"  # test-fleet
FORD_ID = "2f028b73-b82e-427e-992c-ccc99857e52d"
HYUNDAI_ID = "39faf6ff-0e95-4be8-a24b-30b2b433cb4c"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "superadmin@quickwing.com", "password": "Super123"})
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}", "X-Tenant-ID": TENANT_A, "Content-Type": "application/json"}


# ---------------- Fleet Telemetry ----------------

class TestFleetTelemetry:
    def test_telemetry_returns_two_cars(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/tracker/telemetry", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "telemetry" in data
        rows = data["telemetry"]
        car_ids = {row["car_id"] for row in rows}
        assert FORD_ID in car_ids
        assert HYUNDAI_ID in car_ids
        # Validate required fields on Ford
        ford = next(r for r in rows if r["car_id"] == FORD_ID)
        assert "connection_status" in ford
        assert ford["connection_status"] in ("live", "idle", "offline")
        assert "mileage_today_km" in ford
        assert isinstance(ford["mileage_today_km"], (int, float))
        assert ford["mileage_today_km"] >= 0
        assert "last_update" in ford
        assert "minutes_since_update" in ford
        assert "position" in ford
        if ford["position"]:
            for k in ("speed", "voltage", "ignition", "gps_signal"):
                assert k in ford["position"]

    def test_connection_status_transitions(self, admin_headers):
        # Directly manipulate tracker_positions in mongo for the Ford car via a helper endpoint would be ideal;
        # instead we'll use motor via a small async script.
        import motor.motor_asyncio
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")

        async def flip_and_check(minutes_ago: int, expected: str):
            client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            new_ts = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
            # save original
            orig = await db.tracker_positions.find_one({"tenant_id": TENANT_A, "car_id": FORD_ID}, {"last_update": 1, "_id": 0})
            await db.tracker_positions.update_one(
                {"tenant_id": TENANT_A, "car_id": FORD_ID},
                {"$set": {"last_update": new_ts}}
            )
            client.close()
            r = requests.get(f"{BASE_URL}/api/tracker/telemetry", headers=admin_headers)
            assert r.status_code == 200
            rows = r.json()["telemetry"]
            ford = next(x for x in rows if x["car_id"] == FORD_ID)
            return ford["connection_status"], orig

        loop = asyncio.new_event_loop()
        try:
            live, orig = loop.run_until_complete(flip_and_check(1, "live"))
            assert live == "live", f"Expected live, got {live}"
            idle, _ = loop.run_until_complete(flip_and_check(30, "idle"))
            assert idle == "idle"
            offline, _ = loop.run_until_complete(flip_and_check(180, "offline"))
            assert offline == "offline"
            # restore
            if orig and orig.get("last_update"):
                async def restore():
                    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
                    await client[db_name].tracker_positions.update_one(
                        {"tenant_id": TENANT_A, "car_id": FORD_ID},
                        {"$set": {"last_update": orig["last_update"]}}
                    )
                    client.close()
                loop.run_until_complete(restore())
        finally:
            loop.close()

    def test_geocode_dublin_and_cache(self, admin_headers):
        import motor.motor_asyncio
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")

        async def clear_cache():
            client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
            await client[db_name].geocode_cache.delete_many({"key": "53.3498,-6.2603"})
            client.close()

        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(clear_cache())
            r = requests.get(f"{BASE_URL}/api/tracker/geocode?lat=53.3498&lon=-6.2603", headers=admin_headers)
            assert r.status_code == 200, r.text
            addr = r.json().get("address")
            # Occasionally Nominatim may 429; tolerate a None but log
            if addr is None:
                pytest.skip("Nominatim returned nothing (possible rate limit)")
            assert isinstance(addr, str) and len(addr) > 0
            assert "Dublin" in addr or "Ireland" in addr or "Éire" in addr

            # 2nd call should hit cache (no external HTTP). We can't easily
            # measure that from the outside, but we can verify the row exists.
            async def check_cache():
                client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
                row = await client[db_name].geocode_cache.find_one({"key": "53.3498,-6.2603"})
                client.close()
                return row
            row = loop.run_until_complete(check_cache())
            assert row is not None, "geocode_cache row not inserted after first call"
            assert row.get("address") == addr

            # 2nd http call — should return same
            r2 = requests.get(f"{BASE_URL}/api/tracker/geocode?lat=53.3498&lon=-6.2603", headers=admin_headers)
            assert r2.status_code == 200
            assert r2.json().get("address") == addr
        finally:
            loop.close()


# ---------------- Driver Behaviour Events ----------------

class TestBehaviourEvents:
    def test_list_returns_seeded_events(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/behaviour/events?limit=100", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        events = data["events"]
        # There should be at least 7 seeded events; may be more if poller has fired
        assert len(events) >= 7, f"Expected >=7 events, got {len(events)}"
        # Field validation
        for e in events[:1]:
            for f in ("car_name", "staff_name", "details", "timestamp", "type"):
                assert f in e

    def test_filter_by_type_harsh_braking(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/behaviour/events?type=harsh_braking&limit=100", headers=admin_headers)
        assert r.status_code == 200
        events = r.json()["events"]
        assert all(e["type"] == "harsh_braking" for e in events)
        # Seeded count is 2 (or more if poller added)
        assert len(events) >= 2

    def test_filter_by_car_ford(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/behaviour/events?car_id={FORD_ID}&limit=100", headers=admin_headers)
        assert r.status_code == 200
        events = r.json()["events"]
        assert all(e["car_id"] == FORD_ID for e in events)
        assert len(events) >= 3

    def test_filter_by_staff_alice(self, admin_headers):
        # Discover Alice's staff_id from a listing
        r = requests.get(f"{BASE_URL}/api/behaviour/events?limit=100", headers=admin_headers)
        events = r.json()["events"]
        alice = next((e for e in events if e.get("staff_name") == "Alice Murphy"), None)
        assert alice, "No Alice Murphy event found in seed"
        sid = alice["staff_id"]
        r2 = requests.get(f"{BASE_URL}/api/behaviour/events?staff_id={sid}&limit=100", headers=admin_headers)
        assert r2.status_code == 200
        rows = r2.json()["events"]
        assert all(e["staff_id"] == sid for e in rows)
        assert len(rows) >= 4

    def test_filter_by_date_range(self, admin_headers):
        # future window → 0
        future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        far = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        r = requests.get(f"{BASE_URL}/api/behaviour/events?from_date={future}&to_date={far}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_filter_invalid_type_rejected(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/behaviour/events?type=bogus", headers=admin_headers)
        assert r.status_code == 400


class TestBehaviourSummary:
    def test_summary_totals(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/behaviour/summary?window_days=7", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["window_days"] == 7
        assert "by_type" in data
        assert "top_staff" in data
        by_type = data["by_type"]
        # Seeded: speeding 3, harsh_braking 2, harsh_acceleration 1, disconnection 1 (or more with poller)
        assert by_type.get("speeding", 0) >= 3
        assert by_type.get("harsh_braking", 0) >= 2
        assert by_type.get("harsh_acceleration", 0) >= 1
        assert by_type.get("disconnection", 0) >= 1
        assert data["total"] >= 7
        # top_staff sorted desc
        counts = [s["count"] for s in data["top_staff"]]
        assert counts == sorted(counts, reverse=True)
        # Alice should be top
        if data["top_staff"]:
            assert data["top_staff"][0]["staff_name"] == "Alice Murphy"
            assert data["top_staff"][0]["count"] >= 4


# ---------------- Tenant Isolation ----------------

class TestTenantIsolation:
    def test_other_tenant_cannot_see_test_fleet_events(self, admin_headers):
        # tenant B from prior tests
        tenant_b = "1ca4ea67-3094-40b7-9cfe-024a712de1f6"
        # login as super admin, impersonate B
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "superadmin@quickwing.com", "password": "Super123"})
        tok = r.json()["access_token"]
        h_b = {"Authorization": f"Bearer {tok}", "X-Tenant-ID": tenant_b}
        r2 = requests.get(f"{BASE_URL}/api/behaviour/events?limit=100", headers=h_b)
        if r2.status_code == 200:
            events = r2.json()["events"]
            # None of Test Fleet's cars should show
            assert not any(e["car_id"] in (FORD_ID, HYUNDAI_ID) for e in events)
        # telemetry: should not include Test Fleet cars
        r3 = requests.get(f"{BASE_URL}/api/tracker/telemetry", headers=h_b)
        if r3.status_code == 200:
            rows = r3.json()["telemetry"]
            assert not any(row["car_id"] in (FORD_ID, HYUNDAI_ID) for row in rows)

    def test_filter_to_other_tenant_car_returns_empty(self, admin_headers):
        # a car that belongs to a different tenant — Test Fleet asking for its ID should get 0
        # We just pass a random uuid
        r = requests.get(f"{BASE_URL}/api/behaviour/events?car_id=00000000-0000-0000-0000-000000000000", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["count"] == 0


# ---------------- Poller / Service Function ----------------

class TestBehaviourServiceFunction:
    def test_detect_harsh_braking_creates_event(self, admin_headers):
        """Direct service-level test to avoid poller wait."""
        import motor.motor_asyncio
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        import sys
        sys.path.insert(0, "/app/backend")
        from services import driver_behaviour_service as behav  # noqa: E402

        async def run():
            client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            ts = datetime.now(timezone.utc).isoformat()
            car = {"id": FORD_ID, "name": "Ford Focus", "registration": "TEST-1"}
            await behav.detect_harsh_braking(db, TENANT_A, car, prev_speed=50, new_speed=25,
                                             timestamp=ts, lat=53.34, lon=-6.26)
            # Verify inserted
            row = await db.driver_behaviour_events.find_one(
                {"tenant_id": TENANT_A, "car_id": FORD_ID, "type": "harsh_braking", "timestamp": ts},
                {"_id": 0},
            )
            client.close()
            return row

        loop = asyncio.new_event_loop()
        try:
            row = loop.run_until_complete(run())
        finally:
            loop.close()
        assert row is not None
        assert row["type"] == "harsh_braking"
        assert row["details"].startswith("Braked from 50")

        # Cleanup this synthetic event
        async def cleanup():
            client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
            await client[db_name].driver_behaviour_events.delete_one({"id": row["id"]})
            client.close()
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(cleanup())
        finally:
            loop.close()

    def test_detect_harsh_braking_ignored_when_prev_too_slow(self, admin_headers):
        import motor.motor_asyncio
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        import sys
        sys.path.insert(0, "/app/backend")
        from services import driver_behaviour_service as behav

        async def run():
            client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            ts = "2000-01-01T00:00:00+00:00"  # unique
            car = {"id": FORD_ID, "name": "Ford Focus"}
            await behav.detect_harsh_braking(db, TENANT_A, car, prev_speed=8, new_speed=0,
                                             timestamp=ts, lat=0, lon=0)
            row = await db.driver_behaviour_events.find_one(
                {"tenant_id": TENANT_A, "car_id": FORD_ID, "timestamp": ts})
            client.close()
            return row

        loop = asyncio.new_event_loop()
        try:
            row = loop.run_until_complete(run())
        finally:
            loop.close()
        assert row is None, "Should not create event when prev_speed < 10"
