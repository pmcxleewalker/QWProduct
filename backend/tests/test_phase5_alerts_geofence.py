"""Phase 5 backend tests — Alerts (list/count/ack/bulk-ack) + Vehicle Geofence.

Requires REACT_APP_BACKEND_URL, MONGO_URL, DB_NAME env vars.
Re-seeds 5 open alerts before each test class that consumes them.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

SUPER_EMAIL = "superadmin@quickwing.com"
SUPER_PASS = "Super123"

TEST_FLEET_TID = "f95fbe53-46cc-4f29-af6b-b9ea51758cbd"
OTHER_TID = "1ca4ea67-3094-40b7-9cfe-024a712de1f6"  # test-iso-e6c7af (tenant B)

FORD_FOCUS = "2f028b73-b82e-427e-992c-ccc99857e52d"
HYUNDAI_I30 = "39faf6ff-0e95-4be8-a24b-30b2b433cb4c"


# ---------------- helpers ----------------

def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _select(token, tenant_id):
    r = requests.post(f"{BASE_URL}/api/auth/select-tenant",
                      json={"tenant_id": tenant_id},
                      headers={"Authorization": f"Bearer {token}"}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _reseed():
    """Re-run the seed script so we always have exactly 5 open alerts."""
    from tests import seed_phase5_alerts
    import asyncio
    asyncio.run(seed_phase5_alerts.seed())


# ---------------- fixtures ----------------

@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def a_headers(super_token):
    """Tenant A (Test Fleet) auth headers."""
    tok = _select(super_token, TEST_FLEET_TID)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def b_headers(super_token):
    """Tenant B (test-iso) auth headers."""
    tok = _select(super_token, OTHER_TID)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture
def fresh_alerts():
    """Re-seed alerts before test, and clean up after."""
    _reseed()
    yield
    _reseed()


# ================ LIST alerts ================

class TestListAlerts:
    def test_list_returns_shape_and_counts(self, a_headers, fresh_alerts):
        r = requests.get(f"{BASE_URL}/api/tracker/alerts",
                         headers=a_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "alerts" in data and "counts" in data
        assert isinstance(data["alerts"], list)
        assert data["counts"]["total"] == 5
        # per-type breakdown
        assert data["counts"].get("speeding") == 2
        assert data["counts"].get("unplug") == 1
        assert data["counts"].get("offline") == 1
        assert data["counts"].get("geofence_exit") == 1

    def test_list_sorted_critical_first(self, a_headers, fresh_alerts):
        r = requests.get(f"{BASE_URL}/api/tracker/alerts",
                         headers=a_headers, timeout=15)
        alerts = r.json()["alerts"]
        # First two should be severity=critical
        assert alerts[0]["severity"] == "critical"
        assert alerts[1]["severity"] == "critical"
        assert alerts[2]["severity"] != "critical"

    def test_list_default_hides_acked(self, a_headers, fresh_alerts):
        # Ack one and confirm default list length drops
        alerts = requests.get(f"{BASE_URL}/api/tracker/alerts",
                              headers=a_headers, timeout=15).json()["alerts"]
        aid = alerts[0]["id"]
        ack = requests.post(f"{BASE_URL}/api/tracker/alerts/{aid}/ack",
                            headers=a_headers, timeout=15)
        assert ack.status_code == 200
        after = requests.get(f"{BASE_URL}/api/tracker/alerts",
                             headers=a_headers, timeout=15).json()
        assert after["counts"]["total"] == 4
        # With ?acknowledged=true it should include the acked one
        hist = requests.get(f"{BASE_URL}/api/tracker/alerts?acknowledged=true",
                            headers=a_headers, timeout=15).json()
        ids = [a["id"] for a in hist["alerts"]]
        assert aid in ids


# ================ COUNT endpoint ================

class TestCount:
    def test_count_matches_seed(self, a_headers, fresh_alerts):
        r = requests.get(f"{BASE_URL}/api/tracker/alerts/count",
                         headers=a_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 5
        assert data["critical"] == 2  # speeding-critical + unplug-critical


# ================ ACK single ================

class TestAckSingle:
    def test_ack_single_only_own_tenant(self, a_headers, b_headers, fresh_alerts):
        alerts = requests.get(f"{BASE_URL}/api/tracker/alerts",
                              headers=a_headers, timeout=15).json()["alerts"]
        aid = alerts[0]["id"]
        # Tenant B tries to ack tenant A's alert -> 404
        r_b = requests.post(f"{BASE_URL}/api/tracker/alerts/{aid}/ack",
                            headers=b_headers, timeout=15)
        assert r_b.status_code == 404
        # Tenant A can ack
        r_a = requests.post(f"{BASE_URL}/api/tracker/alerts/{aid}/ack",
                            headers=a_headers, timeout=15)
        assert r_a.status_code == 200
        # Second ack -> 404
        r_dup = requests.post(f"{BASE_URL}/api/tracker/alerts/{aid}/ack",
                              headers=a_headers, timeout=15)
        assert r_dup.status_code == 404


# ================ BULK ack ================

class TestBulkAck:
    def test_bulk_ack_by_type(self, a_headers, fresh_alerts):
        r = requests.post(f"{BASE_URL}/api/tracker/alerts/ack-bulk",
                          headers=a_headers, json={"type": "speeding"},
                          timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["acknowledged"] == 2
        # Remaining list should have 3
        remain = requests.get(f"{BASE_URL}/api/tracker/alerts",
                              headers=a_headers, timeout=15).json()
        assert remain["counts"]["total"] == 3
        assert remain["counts"].get("speeding", 0) == 0

    def test_bulk_ack_all(self, a_headers, fresh_alerts):
        r = requests.post(f"{BASE_URL}/api/tracker/alerts/ack-bulk",
                          headers=a_headers, json={}, timeout=15)
        assert r.status_code == 200
        assert r.json()["acknowledged"] == 5
        remain = requests.get(f"{BASE_URL}/api/tracker/alerts",
                              headers=a_headers, timeout=15).json()
        assert remain["counts"]["total"] == 0

    def test_bulk_ack_unknown_type(self, a_headers, fresh_alerts):
        r = requests.post(f"{BASE_URL}/api/tracker/alerts/ack-bulk",
                          headers=a_headers, json={"type": "nonsense"},
                          timeout=15)
        assert r.status_code == 400

    def test_bulk_ack_only_own_tenant(self, a_headers, b_headers, fresh_alerts):
        # Tenant B bulk-acks — should touch 0 alerts (has none)
        r = requests.post(f"{BASE_URL}/api/tracker/alerts/ack-bulk",
                          headers=b_headers, json={}, timeout=15)
        assert r.status_code == 200
        assert r.json()["acknowledged"] == 0
        # Tenant A's alerts unaffected
        after = requests.get(f"{BASE_URL}/api/tracker/alerts",
                             headers=a_headers, timeout=15).json()
        assert after["counts"]["total"] == 5


# ================ Tenant isolation on list/count ================

class TestTenantIsolation:
    def test_tenant_b_sees_none_of_a(self, a_headers, b_headers, fresh_alerts):
        b_list = requests.get(f"{BASE_URL}/api/tracker/alerts",
                              headers=b_headers, timeout=15).json()
        a_ids = {a["id"] for a in requests.get(
            f"{BASE_URL}/api/tracker/alerts",
            headers=a_headers, timeout=15).json()["alerts"]}
        b_ids = {a["id"] for a in b_list["alerts"]}
        assert a_ids.isdisjoint(b_ids)
        # Count endpoint too
        b_count = requests.get(f"{BASE_URL}/api/tracker/alerts/count",
                               headers=b_headers, timeout=15).json()
        # Tenant B may or may not have alerts, but none should equal A's 5
        # and specifically none of A's IDs in B's list.
        assert isinstance(b_count["total"], int)


# ================ GEOFENCE endpoint ================

class TestGeofence:
    def test_set_and_clear_geofence(self, a_headers):
        payload = {"geofence_center_lat": 53.35, "geofence_center_lon": -6.26,
                   "geofence_radius_km": 25, "geofence_label": "HQ Dublin"}
        r = requests.put(f"{BASE_URL}/api/vehicles/{FORD_FOCUS}/geofence",
                         headers=a_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["geofence_center_lat"] == 53.35
        assert data["geofence_radius_km"] == 25
        assert data["geofence_label"] == "HQ Dublin"

        # Clear
        clr = {"geofence_center_lat": None, "geofence_center_lon": None,
               "geofence_radius_km": None, "geofence_label": None}
        r2 = requests.put(f"{BASE_URL}/api/vehicles/{FORD_FOCUS}/geofence",
                          headers=a_headers, json=clr, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["geofence_center_lat"] is None

    def test_partial_geofence_rejected(self, a_headers):
        payload = {"geofence_center_lat": 53.35, "geofence_center_lon": None,
                   "geofence_radius_km": 25}
        r = requests.put(f"{BASE_URL}/api/vehicles/{FORD_FOCUS}/geofence",
                         headers=a_headers, json=payload, timeout=15)
        assert r.status_code == 400

    def test_radius_out_of_range(self, a_headers):
        payload = {"geofence_center_lat": 53.35, "geofence_center_lon": -6.26,
                   "geofence_radius_km": 6000}
        r = requests.put(f"{BASE_URL}/api/vehicles/{FORD_FOCUS}/geofence",
                         headers=a_headers, json=payload, timeout=15)
        assert r.status_code == 400

    def test_cross_tenant_returns_404(self, b_headers):
        payload = {"geofence_center_lat": 53.35, "geofence_center_lon": -6.26,
                   "geofence_radius_km": 25}
        r = requests.put(f"{BASE_URL}/api/vehicles/{FORD_FOCUS}/geofence",
                         headers=b_headers, json=payload, timeout=15)
        assert r.status_code == 404
