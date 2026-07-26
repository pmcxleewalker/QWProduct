"""
Phase 4 - Journey Playback backend tests.

Covers:
- GET /api/tracker/history/{car_id}?date=YYYY-MM-DD  (shape, tenant scope)
- POST /api/tracker/history/{car_id}/seed-demo?days=N  (idempotent seed)
- Trip grouping unit tests (via seed + fetch, and via direct history inserts)
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

SUPER_EMAIL = "superadmin@quickwing.com"
SUPER_PASS = "Super123"

TEST_FLEET_TENANT_ID = "f95fbe53-46cc-4f29-af6b-b9ea51758cbd"
FORD_FOCUS_ID = "2f028b73-b82e-427e-992c-ccc99857e52d"
HYUNDAI_I30_ID = "39faf6ff-0e95-4be8-a24b-30b2b433cb4c"


# ---------------- fixtures ----------------

def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()


def _select_tenant(token, tenant_id):
    r = requests.post(
        f"{BASE_URL}/api/auth/select-tenant",
        json={"tenant_id": tenant_id},
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)["access_token"]


@pytest.fixture(scope="module")
def test_fleet_token(super_token):
    return _select_tenant(super_token, TEST_FLEET_TENANT_ID)


@pytest.fixture(scope="module")
def test_fleet_headers(test_fleet_token):
    return {"Authorization": f"Bearer {test_fleet_token}"}


def _ymd(offset_days=0):
    d = datetime.now(timezone.utc) - timedelta(days=offset_days)
    return d.strftime("%Y-%m-%d")


# ---------------- History endpoint shape ----------------

class TestHistoryEndpointShape:
    def test_history_response_shape(self, test_fleet_headers):
        # Seed first to guarantee data on yesterday
        requests.post(
            f"{BASE_URL}/api/tracker/history/{FORD_FOCUS_ID}/seed-demo?days=3",
            headers=test_fleet_headers, timeout=30,
        )
        r = requests.get(
            f"{BASE_URL}/api/tracker/history/{FORD_FOCUS_ID}?date={_ymd(1)}",
            headers=test_fleet_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("car_id", "car_name", "registration", "date", "trip_count", "trips"):
            assert k in data, f"missing key {k}"
        assert data["car_id"] == FORD_FOCUS_ID
        assert isinstance(data["trips"], list)
        assert data["trip_count"] == len(data["trips"])
        if data["trips"]:
            t = data["trips"][0]
            for k in ("id", "start_time", "end_time", "duration_min", "max_speed",
                      "avg_speed", "point_count", "points"):
                assert k in t, f"trip missing {k}"
            assert t["point_count"] == len(t["points"])
            # No stationary-only trips returned
            assert t["max_speed"] >= 1
            p = t["points"][0]
            for k in ("lat", "lon", "speed", "direction", "voltage", "timestamp"):
                assert k in p

    def test_history_empty_date_returns_empty_trips(self, test_fleet_headers):
        # Distant past should have zero trips
        r = requests.get(
            f"{BASE_URL}/api/tracker/history/{FORD_FOCUS_ID}?date=2001-01-01",
            headers=test_fleet_headers, timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["trip_count"] == 0
        assert data["trips"] == []


# ---------------- Seed endpoint ----------------

class TestSeedDemoEndpoint:
    def test_seed_returns_ok(self, test_fleet_headers):
        r = requests.post(
            f"{BASE_URL}/api/tracker/history/{FORD_FOCUS_ID}/seed-demo?days=3",
            headers=test_fleet_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "inserted" in data
        assert data.get("days") == 3

    def test_seed_idempotent(self, test_fleet_headers):
        # 2nd call should insert 0 (already >20 rows per day)
        r = requests.post(
            f"{BASE_URL}/api/tracker/history/{FORD_FOCUS_ID}/seed-demo?days=3",
            headers=test_fleet_headers, timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["inserted"] == 0

    def test_seed_404_on_non_demo_car(self, test_fleet_headers):
        # Random non-existent car => 404
        fake_id = str(uuid.uuid4())
        r = requests.post(
            f"{BASE_URL}/api/tracker/history/{fake_id}/seed-demo?days=1",
            headers=test_fleet_headers, timeout=15,
        )
        assert r.status_code == 404


# ---------------- Tenant isolation ----------------

class TestTenantIsolation:
    def test_cross_tenant_history_returns_404(self, super_token):
        # Use platform tenants endpoint to find a non-test-fleet tenant
        r2 = requests.get(
            f"{BASE_URL}/api/platform/tenants",
            headers={"Authorization": f"Bearer {super_token}"}, timeout=10,
        )
        assert r2.status_code == 200
        tenants = r2.json().get("tenants", [])
        other = [t for t in tenants if t.get("id") != TEST_FLEET_TENANT_ID and t.get("status") == "active"]
        if not other:
            pytest.skip("Super admin has no non-test-fleet tenant to compare against")
        other_id = other[0]["id"]
        other_token = _select_tenant(super_token, other_id)
        r3 = requests.get(
            f"{BASE_URL}/api/tracker/history/{FORD_FOCUS_ID}?date={_ymd(1)}",
            headers={"Authorization": f"Bearer {other_token}"}, timeout=15,
        )
        assert r3.status_code == 404, f"Cross-tenant read should 404, got {r3.status_code}: {r3.text}"


# ---------------- Trip grouping (uses direct DB insert via mongo) ----------------

class TestTripGrouping:
    """Insert synthetic points directly and verify grouping.

    Uses a temporary car under test-fleet so tenant scope is preserved.
    """

    @pytest.fixture(scope="class")
    def temp_car_id(self, test_fleet_headers):
        # Create a temp vehicle under test-fleet
        payload = {
            "name": "TEST_TripGrouping",
            "registration": f"TEST-{uuid.uuid4().hex[:6].upper()}",
            "vehicle_type": "sedan",
        }
        r = requests.post(f"{BASE_URL}/api/vehicles", json=payload,
                          headers=test_fleet_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        car_id = body.get("id") or body.get("vehicle", {}).get("id")
        assert car_id, f"could not extract car id from {body}"
        yield car_id
        # cleanup
        requests.delete(f"{BASE_URL}/api/vehicles/{car_id}",
                        headers=test_fleet_headers, timeout=15)

    def _insert_points(self, car_id, timestamps_speeds):
        """Insert history rows directly via mongo."""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]

        async def _do():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            rows = []
            for ts, speed in timestamps_speeds:
                rows.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": TEST_FLEET_TENANT_ID,
                    "tracker_id": "test-tracker",
                    "car_id": car_id,
                    "lat": 53.35, "lon": -6.26,
                    "speed": speed, "direction": 90,
                    "voltage": 12.5, "ignition": speed > 0,
                    "timestamp": ts.isoformat(),
                })
            await db.tracker_history.insert_many(rows)
            client.close()
        asyncio.run(_do())

    def _cleanup_points(self, car_id):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]

        async def _do():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            await db.tracker_history.delete_many({"car_id": car_id})
            client.close()
        asyncio.run(_do())

    def test_gap_over_3min_creates_new_trip(self, temp_car_id, test_fleet_headers):
        self._cleanup_points(temp_car_id)
        base = datetime.now(timezone.utc).replace(hour=10, minute=0, second=0, microsecond=0)
        # Trip 1: 3 points moving
        pts = [
            (base, 20),
            (base + timedelta(seconds=30), 25),
            (base + timedelta(seconds=60), 30),
            # 4 min gap => new trip
            (base + timedelta(minutes=5), 15),
            (base + timedelta(minutes=5, seconds=30), 22),
            (base + timedelta(minutes=6), 28),
        ]
        self._insert_points(temp_car_id, pts)
        ymd = base.strftime("%Y-%m-%d")
        r = requests.get(
            f"{BASE_URL}/api/tracker/history/{temp_car_id}?date={ymd}",
            headers=test_fleet_headers, timeout=15,
        )
        assert r.status_code == 200
        trips = r.json()["trips"]
        assert len(trips) == 2, f"Expected 2 trips (4min gap), got {len(trips)}"
        self._cleanup_points(temp_car_id)

    def test_gap_under_3min_stays_single_trip(self, temp_car_id, test_fleet_headers):
        self._cleanup_points(temp_car_id)
        base = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
        pts = [
            (base, 20),
            (base + timedelta(seconds=30), 25),
            # 2 min gap => same trip
            (base + timedelta(minutes=2, seconds=30), 30),
            (base + timedelta(minutes=3), 35),
        ]
        self._insert_points(temp_car_id, pts)
        ymd = base.strftime("%Y-%m-%d")
        r = requests.get(
            f"{BASE_URL}/api/tracker/history/{temp_car_id}?date={ymd}",
            headers=test_fleet_headers, timeout=15,
        )
        assert r.status_code == 200
        trips = r.json()["trips"]
        assert len(trips) == 1, f"Expected 1 trip (2min gap), got {len(trips)}"
        assert trips[0]["max_speed"] == 35
        self._cleanup_points(temp_car_id)

    def test_stationary_trip_dropped(self, temp_car_id, test_fleet_headers):
        self._cleanup_points(temp_car_id)
        base = datetime.now(timezone.utc).replace(hour=14, minute=0, second=0, microsecond=0)
        # All speed=0 => trip should be dropped
        pts = [
            (base, 0),
            (base + timedelta(seconds=30), 0),
            (base + timedelta(seconds=60), 0),
        ]
        self._insert_points(temp_car_id, pts)
        ymd = base.strftime("%Y-%m-%d")
        r = requests.get(
            f"{BASE_URL}/api/tracker/history/{temp_car_id}?date={ymd}",
            headers=test_fleet_headers, timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["trips"] == []
        self._cleanup_points(temp_car_id)
