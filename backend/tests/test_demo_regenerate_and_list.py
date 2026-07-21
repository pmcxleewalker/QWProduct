"""Regression tests for demo magic-link regenerate + list_tenants enrichment.

Covers iteration 27 additions:
- GET /api/platform/tenants includes tenant.magic_link for demo tenants (and null when no active link)
- Real tenants must not have magic_link key set (or None)
- POST /api/platform/tenants/{id}/magic-link mints a new token, revokes old, refuses on real tenants
- Old token becomes 403 after regenerate; new token redeems successfully
- Custom plan fields accepted on create
"""
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
TS = int(time.time())


@pytest.fixture(scope="module")
def super_headers():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


def _cleanup(super_headers, tenant_id):
    try:
        requests.delete(f"{BASE}/api/platform/tenants/{tenant_id}", headers=super_headers, timeout=15)
    except Exception:
        pass


@pytest.fixture(scope="module")
def demo_tenant(super_headers):
    payload = {
        "name": f"Regen Demo {TS}",
        "slug": f"regen-demo-{TS}",
        "plan": "custom",
        "is_demo": True,
        "demo_link_expires_in_days": 14,
        "custom_max_vehicles": 10,
        "custom_max_users": 15,
        "custom_price": 0,
    }
    r = requests.post(f"{BASE}/api/platform/tenants", headers=super_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    yield data
    _cleanup(super_headers, data["tenant"]["id"])


@pytest.fixture(scope="module")
def real_tenant(super_headers):
    payload = {
        "name": f"Regen Real {TS}",
        "slug": f"regen-real-{TS}",
        "plan": "standard",
        "is_demo": False,
    }
    r = requests.post(f"{BASE}/api/platform/tenants", headers=super_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    yield data
    _cleanup(super_headers, data["tenant"]["id"])


# --- 1. Create demo with custom plan works and returns magic_link, no master_admin ---
def test_create_demo_custom_plan_shape(demo_tenant):
    assert demo_tenant.get("is_demo") is True
    assert demo_tenant.get("master_admin") is None
    ml = demo_tenant.get("magic_link")
    assert ml and ml.get("url") and "/demo-link/" in ml["url"]
    assert ml.get("token")


# --- 2. list_tenants enriches demo with magic_link and real without ---
def test_list_tenants_includes_magic_link_for_demo(super_headers, demo_tenant, real_tenant):
    r = requests.get(f"{BASE}/api/platform/tenants?limit=500", headers=super_headers)
    assert r.status_code == 200
    body = r.json()
    tenants = body["tenants"] if isinstance(body, dict) else body

    demo_id = demo_tenant["tenant"]["id"]
    real_id = real_tenant["tenant"]["id"]

    demo_row = next((t for t in tenants if t["id"] == demo_id), None)
    real_row = next((t for t in tenants if t["id"] == real_id), None)
    assert demo_row, "demo tenant missing from list"
    assert real_row, "real tenant missing from list"

    assert demo_row.get("is_demo") is True
    ml = demo_row.get("magic_link")
    assert ml, "demo tenant in list must expose magic_link"
    assert ml.get("url") and "/demo-link/" in ml["url"]
    assert ml.get("token")
    assert ml.get("expires_at")
    assert "use_count" in ml

    # Real tenant must not have magic_link populated
    assert not real_row.get("magic_link"), "real tenant must not expose magic_link"
    assert real_row.get("is_demo") in (False, None)


# --- 3. Regenerate endpoint mints a new distinct token ---
def test_regenerate_returns_new_token(super_headers, demo_tenant):
    tenant_id = demo_tenant["tenant"]["id"]
    old_token = demo_tenant["magic_link"]["token"]

    r = requests.post(
        f"{BASE}/api/platform/tenants/{tenant_id}/magic-link",
        headers=super_headers,
        json={"expires_in_days": 14},
    )
    assert r.status_code in (200, 201), r.text
    new = r.json()
    assert new.get("token") and new["token"] != old_token
    assert new.get("url") and "/demo-link/" in new["url"]
    assert new.get("tenant_id") == tenant_id
    # Stash on the fixture-dict for downstream tests
    demo_tenant["_new_magic_link"] = new
    demo_tenant["_old_token"] = old_token


# --- 4. Old token revoked, new token redeems ---
def test_old_token_revoked_after_regenerate(demo_tenant):
    old_token = demo_tenant["_old_token"]
    r = requests.post(f"{BASE}/api/demo/redeem", json={"token": old_token})
    assert r.status_code == 403, f"Expected 403 revoked, got {r.status_code}: {r.text}"


def test_new_token_redeems_ok(demo_tenant):
    new_token = demo_tenant["_new_magic_link"]["token"]
    r = requests.post(f"{BASE}/api/demo/redeem", json={"token": new_token})
    assert r.status_code == 200, r.text
    assert r.json().get("access_token")


# --- 5. Regenerate against a real tenant is 400 ---
def test_regenerate_on_real_tenant_rejected(super_headers, real_tenant):
    tenant_id = real_tenant["tenant"]["id"]
    r = requests.post(
        f"{BASE}/api/platform/tenants/{tenant_id}/magic-link",
        headers=super_headers,
        json={"expires_in_days": 14},
    )
    assert r.status_code == 400, r.text
    detail = (r.json().get("detail") or "").lower()
    assert "not a demo" in detail or "demo" in detail


# --- 6. When all links revoked, list returns magic_link=null for demo ---
def test_list_demo_null_when_all_revoked(super_headers):
    # Create a demo, revoke all its tokens, ensure list returns magic_link=None
    slug = f"regen-null-{TS}"
    payload = {"name": f"Regen Null {TS}", "slug": slug, "plan": "standard",
               "is_demo": True, "demo_link_expires_in_days": 7}
    r = requests.post(f"{BASE}/api/platform/tenants", headers=super_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tenant_id = data["tenant"]["id"]
    token_id = data["magic_link"]["id"]
    try:
        rd = requests.delete(f"{BASE}/api/platform/demo-tokens/{token_id}", headers=super_headers)
        assert rd.status_code == 200, rd.text

        rl = requests.get(f"{BASE}/api/platform/tenants?limit=500", headers=super_headers)
        assert rl.status_code == 200
        tenants = rl.json()["tenants"] if isinstance(rl.json(), dict) else rl.json()
        row = next((t for t in tenants if t["id"] == tenant_id), None)
        assert row is not None
        assert row.get("is_demo") is True
        assert row.get("magic_link") is None
    finally:
        _cleanup(super_headers, tenant_id)


# --- 7. Regenerate on unknown tenant returns 404 ---
def test_regenerate_unknown_tenant_404(super_headers):
    r = requests.post(
        f"{BASE}/api/platform/tenants/nonexistent-tenant-id-xyz/magic-link",
        headers=super_headers,
        json={"expires_in_days": 7},
    )
    assert r.status_code == 404
