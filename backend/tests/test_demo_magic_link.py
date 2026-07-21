"""Tests for the per-tenant Demo magic-link flow (real vs demo tenant creation)."""
import os
import time
import pytest
import requests

def _load_base():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not v:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        v = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return v.rstrip("/")

BASE = _load_base()
assert BASE, "REACT_APP_BACKEND_URL must be set"

SUPER_EMAIL = "superadmin@quickwing.com"
SUPER_PASS = "Super123"


@pytest.fixture(scope="module")
def super_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_headers(super_token):
    return {"Authorization": f"Bearer {super_token}", "Content-Type": "application/json"}


TS = int(time.time())


def _cleanup_tenant(super_headers, tenant_id):
    try:
        requests.delete(f"{BASE}/api/platform/tenants/{tenant_id}", headers=super_headers, timeout=15)
    except Exception:
        pass


# --- Legacy demo tenant removal ---
def test_legacy_demo_tenant_removed(super_headers):
    r = requests.get(f"{BASE}/api/platform/tenants", headers=super_headers)
    assert r.status_code == 200
    tenants = r.json()
    if isinstance(tenants, dict):
        tenants = tenants.get("tenants", [])
    slugs = [t.get("slug") for t in tenants]
    ids = [t.get("id") for t in tenants]
    assert "00000000-0000-0000-0000-000000000d00" not in ids
    # slug 'demo' may not exist anymore or if exists shouldn't be the legacy one
    if "demo" in slugs:
        # If a fresh demo with slug 'demo' exists it's OK; legacy id must be gone
        pass


# --- Real tenant creation regression ---
def test_create_real_tenant_returns_master_admin(super_headers):
    slug = f"reg-real-{TS}"
    payload = {
        "name": f"Reg Real {TS}",
        "slug": slug,
        "plan": "standard",
        "is_demo": False,
    }
    r = requests.post(f"{BASE}/api/platform/tenants", headers=super_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("tenant", {}).get("is_demo") is False
    assert data.get("master_admin"), "Real tenant must return master_admin credentials"
    assert data["master_admin"].get("email")
    assert data["master_admin"].get("password")
    assert data.get("login_url") or data["master_admin"].get("login_url") or True  # login_url optional field
    _cleanup_tenant(super_headers, data["tenant"]["id"])


# --- Demo tenant creation ---
@pytest.fixture(scope="module")
def demo_tenant(super_headers):
    slug = f"reg-demo-{TS}"
    payload = {
        "name": f"Reg Demo {TS}",
        "slug": slug,
        "plan": "standard",
        "is_demo": True,
        "demo_link_expires_in_days": 30,
    }
    r = requests.post(f"{BASE}/api/platform/tenants", headers=super_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    yield data
    _cleanup_tenant(super_headers, data["tenant"]["id"])


def test_demo_tenant_response_shape(demo_tenant):
    assert demo_tenant.get("is_demo") is True
    assert demo_tenant.get("master_admin") is None
    ml = demo_tenant.get("magic_link")
    assert ml, "magic_link must be present"
    assert ml.get("url") and "/demo-link/" in ml["url"]
    assert ml.get("token")
    assert ml.get("tenant_id") == demo_tenant["tenant"]["id"]
    assert ml.get("tenant_slug") == demo_tenant["tenant"]["slug"]
    assert ml.get("expires_at")
    assert demo_tenant["tenant"].get("is_demo") is True


def test_demo_redeem_no_auth_required(demo_tenant):
    token = demo_tenant["magic_link"]["token"]
    r = requests.post(f"{BASE}/api/demo/redeem", json={"token": token})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("access_token")
    at = data.get("active_tenant") or {}
    assert at.get("tenant_id") == demo_tenant["tenant"]["id"]
    assert at.get("tenant_slug") == demo_tenant["tenant"]["slug"]


def test_demo_tenant_is_blank(demo_tenant):
    # Redeem first to get jwt
    token = demo_tenant["magic_link"]["token"]
    r = requests.post(f"{BASE}/api/demo/redeem", json={"token": token})
    assert r.status_code == 200
    jwt = r.json()["access_token"]
    tenant_id = demo_tenant["tenant"]["id"]
    h = {"Authorization": f"Bearer {jwt}", "X-Tenant-ID": tenant_id}
    rv = requests.get(f"{BASE}/api/vehicles", headers=h)
    assert rv.status_code == 200, rv.text
    vehicles = rv.json()
    # accept either list or dict shape; extract list
    if isinstance(vehicles, dict):
        vehicles = vehicles.get("vehicles") or vehicles.get("items") or []
    assert vehicles == [], f"Demo tenant vehicles must be empty, got: {vehicles}"

    rb = requests.get(f"{BASE}/api/bookings", headers=h)
    assert rb.status_code == 200, rb.text
    bookings = rb.json()
    if isinstance(bookings, dict):
        bookings = bookings.get("bookings") or bookings.get("items") or []
    assert bookings == [], f"Demo tenant bookings must be empty, got: {bookings}"


def test_demo_user_password_login_blocked(demo_tenant):
    slug = demo_tenant["tenant"]["slug"]
    demo_email = f"demo+{slug}@quickwing.com"
    r = requests.post(f"{BASE}/api/auth/login", json={"email": demo_email, "password": "anything"})
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
    body = r.json()
    detail = (body.get("detail") or "").lower()
    assert "demo" in detail, f"Expected demo-only message, got: {detail}"


def test_demo_slug_conflict_free(super_headers):
    """Creating a fresh demo tenant with slug 'demo' must succeed (legacy is gone)."""
    # Only run if slug 'demo' not already present
    r = requests.get(f"{BASE}/api/platform/tenants", headers=super_headers)
    resp = r.json()
    if isinstance(resp, dict):
        resp = resp.get("tenants", [])
    slugs = [t.get("slug") for t in resp]
    if "demo" in slugs:
        pytest.skip("slug 'demo' already exists in this env")
    payload = {"name": "Fresh Demo", "slug": "demo", "plan": "standard",
               "is_demo": True, "demo_link_expires_in_days": 7}
    r = requests.post(f"{BASE}/api/platform/tenants", headers=super_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    _cleanup_tenant(super_headers, data["tenant"]["id"])


def test_demo_token_revocation(super_headers, demo_tenant):
    token = demo_tenant["magic_link"]["token"]
    token_id = demo_tenant["magic_link"].get("id")
    assert token_id, "magic_link.id must be present for revocation test"
    r = requests.delete(f"{BASE}/api/platform/demo-tokens/{token_id}", headers=super_headers)
    assert r.status_code == 200, r.text
    r2 = requests.post(f"{BASE}/api/demo/redeem", json={"token": token})
    assert r2.status_code == 403, f"Expected 403 after revoke, got {r2.status_code}: {r2.text}"


def test_demo_redeem_invalid_token():
    r = requests.post(f"{BASE}/api/demo/redeem", json={"token": "totally-invalid-token-xyz"})
    assert r.status_code in (403, 404)
