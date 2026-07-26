"""
Phase 1: SinoTrack GPS multi-tenant toggle plumbing tests.

Covers:
  - GET /api/tenant/settings returns default gps block for un-toggled tenants
  - PUT /api/tenant/settings/gps enable / partial update / disable retention
  - Clamping of speed_limit_kmh, poll_interval_seconds, history_retention_days
  - Admin-only guard (staff -> 403)
  - POST /api/platform/tenants honours gps_enabled at creation
"""
import os
import time
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if v:
        return v.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

SUPER_ADMIN = {"email": "superadmin@quickwing.com", "password": "Super123"}


# ------------- helpers ---------------------------------------------------

def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _select_tenant(token, tenant_id):
    r = requests.post(
        f"{API}/auth/select-tenant",
        json={"tenant_id": tenant_id},
        headers=_auth_headers(token),
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


# ------------- fixtures --------------------------------------------------

@pytest.fixture(scope="module")
def super_token():
    return _login(**SUPER_ADMIN)["access_token"]


@pytest.fixture(scope="module")
def tenant_no_gps(super_token):
    """Real tenant created with gps_enabled omitted (=false)."""
    ts = int(time.time())
    slug = f"gpstest-off-{ts}"
    payload = {"name": f"GPS Off {ts}", "slug": slug, "plan": "custom", "custom_price": 100}
    r = requests.post(f"{API}/platform/tenants", json=payload,
                      headers=_auth_headers(super_token), timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tenant = data.get("tenant", data)
    yield {
        "id": tenant["id"],
        "slug": tenant["slug"],
        "admin_email": data.get("master_admin_email") or f"admin.{slug}@quickwing.com",
        "admin_password": data.get("master_admin_password") or "admin123",
    }
    requests.delete(f"{API}/platform/tenants/{tenant['id']}",
                    headers=_auth_headers(super_token), timeout=30)


@pytest.fixture(scope="module")
def tenant_with_gps(super_token):
    """Real tenant created with gps_enabled=true — should have gps_settings seeded."""
    ts = int(time.time()) + 1
    slug = f"gpstest-on-{ts}"
    payload = {"name": f"GPS On {ts}", "slug": slug, "plan": "custom",
               "custom_price": 100, "gps_enabled": True}
    r = requests.post(f"{API}/platform/tenants", json=payload,
                      headers=_auth_headers(super_token), timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tenant = data.get("tenant", data)
    yield {
        "id": tenant["id"],
        "slug": tenant["slug"],
        "raw_response": data,
        "tenant_obj": tenant,
        "admin_email": data.get("master_admin_email") or f"admin.{slug}@quickwing.com",
        "admin_password": data.get("master_admin_password") or "admin123",
    }
    requests.delete(f"{API}/platform/tenants/{tenant['id']}",
                    headers=_auth_headers(super_token), timeout=30)


@pytest.fixture()
def admin_token_off(tenant_no_gps):
    login = _login(tenant_no_gps["admin_email"], tenant_no_gps["admin_password"])
    tok = login["access_token"]
    # Ensure tenant is selected
    if not (login.get("active_tenant") or {}).get("id"):
        tok = _select_tenant(tok, tenant_no_gps["id"])
    return tok


@pytest.fixture()
def admin_token_on(tenant_with_gps):
    login = _login(tenant_with_gps["admin_email"], tenant_with_gps["admin_password"])
    tok = login["access_token"]
    if not (login.get("active_tenant") or {}).get("id"):
        tok = _select_tenant(tok, tenant_with_gps["id"])
    return tok


# ------------- create-tenant tests --------------------------------------

class TestCreateTenantGpsFlag:
    def test_gps_enabled_omitted_defaults_false(self, tenant_no_gps, super_token):
        r = requests.get(f"{API}/platform/tenants/{tenant_no_gps['id']}",
                         headers=_auth_headers(super_token), timeout=30)
        assert r.status_code == 200
        t = r.json()
        assert t.get("gps_enabled", False) is False
        assert t.get("gps_settings") in (None, {})

    def test_gps_enabled_true_seeds_defaults(self, tenant_with_gps):
        t = tenant_with_gps["tenant_obj"]
        assert t.get("gps_enabled") is True
        gs = t.get("gps_settings") or {}
        assert gs.get("speed_limit_kmh") == 120
        assert gs.get("poll_interval_seconds") == 30
        assert gs.get("history_retention_days") == 60
        assert gs.get("device_password") == "123456"


# ------------- GET /api/tenant/settings ---------------------------------

class TestTenantSettingsGpsBlock:
    def test_get_settings_default_gps_block(self, admin_token_off):
        r = requests.get(f"{API}/tenant/settings",
                         headers=_auth_headers(admin_token_off), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "gps" in data
        gps = data["gps"]
        assert gps["enabled"] is False
        assert gps["speed_limit_kmh"] == 120
        assert gps["poll_interval_seconds"] == 30
        assert gps["history_retention_days"] == 60
        assert gps["device_password"] == "123456"


# ------------- PUT /api/tenant/settings/gps ------------------------------

class TestUpdateGpsSettings:
    def test_enable_seeds_defaults(self, admin_token_off):
        r = requests.put(f"{API}/tenant/settings/gps", json={"enabled": True},
                         headers=_auth_headers(admin_token_off), timeout=30)
        assert r.status_code == 200, r.text
        gps = r.json()["gps"]
        assert gps["enabled"] is True
        assert gps["speed_limit_kmh"] == 120
        assert gps["poll_interval_seconds"] == 30
        assert gps["history_retention_days"] == 60
        assert gps["device_password"] == "123456"
        # subsequent GET reflects it
        r2 = requests.get(f"{API}/tenant/settings",
                          headers=_auth_headers(admin_token_off), timeout=30)
        assert r2.json()["gps"]["enabled"] is True

    def test_partial_update_without_toggling(self, admin_token_off):
        # ensure enabled true already from prior test in same tenant_no_gps
        payload = {
            "speed_limit_kmh": 100,
            "poll_interval_seconds": 60,
            "history_retention_days": 90,
            "device_password": "newpass",
        }
        r = requests.put(f"{API}/tenant/settings/gps", json=payload,
                         headers=_auth_headers(admin_token_off), timeout=30)
        assert r.status_code == 200, r.text
        gps = r.json()["gps"]
        assert gps["enabled"] is True  # unchanged
        assert gps["speed_limit_kmh"] == 100
        assert gps["poll_interval_seconds"] == 60
        assert gps["history_retention_days"] == 90
        assert gps["device_password"] == "newpass"

    def test_disable_retains_overrides(self, admin_token_off):
        r = requests.put(f"{API}/tenant/settings/gps", json={"enabled": False},
                         headers=_auth_headers(admin_token_off), timeout=30)
        assert r.status_code == 200, r.text
        gps = r.json()["gps"]
        assert gps["enabled"] is False
        # overrides retained
        assert gps["speed_limit_kmh"] == 100
        assert gps["poll_interval_seconds"] == 60
        assert gps["history_retention_days"] == 90
        assert gps["device_password"] == "newpass"

    def test_clamping_low(self, admin_token_on):
        r = requests.put(f"{API}/tenant/settings/gps", json={
            "speed_limit_kmh": 5,
            "poll_interval_seconds": 1,
            "history_retention_days": 1,
        }, headers=_auth_headers(admin_token_on), timeout=30)
        assert r.status_code == 200, r.text
        gps = r.json()["gps"]
        assert gps["speed_limit_kmh"] == 30
        assert gps["poll_interval_seconds"] == 10
        assert gps["history_retention_days"] == 7

    def test_clamping_high(self, admin_token_on):
        r = requests.put(f"{API}/tenant/settings/gps", json={
            "speed_limit_kmh": 1000,
            "poll_interval_seconds": 9999,
            "history_retention_days": 9999,
        }, headers=_auth_headers(admin_token_on), timeout=30)
        assert r.status_code == 200, r.text
        gps = r.json()["gps"]
        assert gps["speed_limit_kmh"] == 300
        assert gps["poll_interval_seconds"] == 600
        assert gps["history_retention_days"] == 730


# ------------- Admin-only guard -----------------------------------------

class TestAdminOnly:
    def test_staff_gets_403(self, admin_token_on, tenant_with_gps):
        # Create a staff user via /api/tenant/users
        ts = int(time.time())
        staff_email = f"TEST_staff+{ts}@quickwing.com"
        r = requests.post(
            f"{API}/tenant/users",
            params={"role": "staff"},
            json={"email": staff_email, "name": "T Staff", "password": "Staff123!"},
            headers=_auth_headers(admin_token_on), timeout=30,
        )
        if r.status_code not in (200, 201):
            pytest.skip(f"cannot create staff user: {r.status_code} {r.text}")
        # Login as staff
        login = _login(staff_email, "Staff123!")
        stok = login["access_token"]
        if not (login.get("active_tenant") or {}).get("id"):
            stok = _select_tenant(stok, tenant_with_gps["id"])
        r2 = requests.put(f"{API}/tenant/settings/gps", json={"enabled": True},
                          headers=_auth_headers(stok), timeout=30)
        assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text}"
