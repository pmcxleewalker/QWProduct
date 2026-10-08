"""
Iteration 48 regression: Demo + Tenant isolation + Super admin + Support admin
Covers: /api/platform/*, /api/auth/select-tenant, /api/auth/me, demo redeem, impersonate.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-media-hub-77.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token, tenant_id=None):
    h = {"Authorization": f"Bearer {token}"}
    if tenant_id:
        h["X-Tenant-ID"] = tenant_id
    return h


# ---------- Super admin fixture ----------
@pytest.fixture(scope="module")
def super_token():
    return _login("superadmin@quickwing.com", "Super123")


@pytest.fixture(scope="module")
def tenants(super_token):
    r = requests.get(f"{API}/platform/tenants", headers=_h(super_token), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data.get("tenants") or data.get("items") or data if isinstance(data, list) else data.get("tenants", [])
    if isinstance(data, dict) and "tenants" in data:
        items = data["tenants"]
    return items


@pytest.fixture(scope="module")
def test_fleet_tenant(tenants):
    for t in tenants:
        if t.get("slug") == "test-fleet":
            return t
    pytest.skip("test-fleet tenant not found")


@pytest.fixture(scope="module")
def demo_setup(super_token):
    """Create a fresh demo tenant & redeem magic link."""
    slug = f"iso-demo-{uuid.uuid4().hex[:6]}"
    payload = {
        "name": f"Iter48 Demo {slug}",
        "slug": slug,
        "is_demo": True,
        "prospect_name": "Iter48 Prospect",
        "prospect_email": f"prospect+{slug}@example.com",
    }
    r = requests.post(f"{API}/platform/tenants", headers=_h(super_token), json=payload, timeout=60)
    assert r.status_code in (200, 201), f"create demo tenant failed: {r.status_code} {r.text}"
    body = r.json()
    tenant = body.get("tenant") or body
    tenant_id = tenant.get("id") or tenant.get("_id") or body.get("tenant_id")
    # Magic link may be returned at top level or inside tenant
    magic_obj = body.get("magic_link") or {}
    token = None
    if isinstance(magic_obj, dict):
        token = magic_obj.get("token")
        if not token and magic_obj.get("url"):
            token = magic_obj["url"].rsplit("/demo-link/", 1)[-1].split("?")[0]
    if not token:
        token = body.get("demo_token") or tenant.get("demo_token")
    assert token, f"could not extract demo token from create response: {body}"

    r2 = requests.post(f"{API}/demo/redeem", json={"token": token}, timeout=30)
    assert r2.status_code == 200, f"demo redeem failed: {r2.status_code} {r2.text}"
    j = r2.json()
    demo_access = j.get("access_token") or j.get("token")
    assert demo_access, f"no access_token in redeem response: {j}"
    return {"tenant_id": tenant_id, "slug": slug, "access_token": demo_access}


# ================= SUPER ADMIN =================
class TestSuperAdmin:
    def test_me_is_platform_admin(self, super_token):
        r = requests.get(f"{API}/auth/me", headers=_h(super_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        ctx = data.get("current_context") or {}
        assert ctx.get("is_platform_admin") is True, f"expected is_platform_admin True: {data}"

    def test_list_platform_tenants(self, super_token):
        r = requests.get(f"{API}/platform/tenants", headers=_h(super_token), timeout=30)
        assert r.status_code == 200

    def test_select_tenant(self, super_token, test_fleet_tenant):
        r = requests.post(
            f"{API}/auth/select-tenant",
            headers=_h(super_token),
            json={"tenant_id": test_fleet_tenant["id"]},
            timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_impersonate_and_stop(self, super_token, test_fleet_tenant):
        tid = test_fleet_tenant["id"]
        r = requests.post(
            f"{API}/platform/tenants/{tid}/impersonate",
            headers=_h(super_token),
            timeout=30,
        )
        assert r.status_code in (200, 201), f"impersonate failed: {r.status_code} {r.text}"
        imp_token = r.json().get("access_token")
        assert imp_token
        r2 = requests.post(f"{API}/platform/stop-impersonation", headers=_h(imp_token), timeout=30)
        assert r2.status_code in (200, 204), f"stop-impersonation failed: {r2.status_code} {r2.text}"


# ================= TENANT OWNER (master_admin) =================
class TestTenantOwner:
    @pytest.fixture(scope="class")
    def owner_token(self):
        return _login("admin.test-fleet@quickwing.com", "admin123")

    def test_me_not_platform_admin(self, owner_token):
        r = requests.get(f"{API}/auth/me", headers=_h(owner_token), timeout=30)
        assert r.status_code == 200
        ctx = r.json().get("current_context") or {}
        assert ctx.get("is_platform_admin") is False

    def test_platform_tenants_forbidden(self, owner_token):
        r = requests.get(f"{API}/platform/tenants", headers=_h(owner_token), timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_platform_other_endpoints_forbidden(self, owner_token):
        for ep in ["/platform/stats", "/platform/users", "/platform/billing"]:
            r = requests.get(f"{API}{ep}", headers=_h(owner_token), timeout=30)
            # 403 expected, 404 acceptable if endpoint doesn't exist
            assert r.status_code in (403, 404), f"{ep}: {r.status_code}"

    def test_select_foreign_tenant_forbidden(self, owner_token, tenants, test_fleet_tenant):
        foreign = next((t for t in tenants if t["id"] != test_fleet_tenant["id"] and not t.get("is_demo")), None)
        if not foreign:
            pytest.skip("no foreign tenant to test")
        r = requests.post(
            f"{API}/auth/select-tenant",
            headers=_h(owner_token),
            json={"tenant_id": foreign["id"]},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_select_own_tenant_ok(self, owner_token, test_fleet_tenant):
        r = requests.post(
            f"{API}/auth/select-tenant",
            headers=_h(owner_token),
            json={"tenant_id": test_fleet_tenant["id"]},
            timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_access_own_tenant_data(self, owner_token, test_fleet_tenant):
        tid = test_fleet_tenant["id"]
        for ep in ["/vehicles", "/bookings"]:
            r = requests.get(f"{API}{ep}", headers=_h(owner_token, tid), timeout=30)
            assert r.status_code in (200, 204), f"{ep}: {r.status_code} {r.text[:200]}"


# ================= DEMO USER =================
class TestDemoIsolation:
    def test_demo_me_role_and_flag(self, demo_setup):
        r = requests.get(f"{API}/auth/me", headers=_h(demo_setup["access_token"]), timeout=30)
        assert r.status_code == 200
        data = r.json()
        ctx = data.get("current_context") or {}
        assert ctx.get("is_platform_admin") is False
        assert ctx.get("is_demo") is True, f"expected is_demo true: {data}"
        # role should be admin (not master_admin)
        role = ctx.get("role") or data.get("role")
        assert role in ("admin", None), f"demo role should be admin, got {role}"

    def test_demo_platform_forbidden(self, demo_setup):
        for ep in ["/platform/tenants", "/platform/stats", "/platform/users"]:
            r = requests.get(f"{API}{ep}", headers=_h(demo_setup["access_token"]), timeout=30)
            assert r.status_code in (403, 404), f"{ep}: {r.status_code}"
            # explicitly ensure not 200
            assert r.status_code != 200

    def test_demo_select_foreign_tenant_forbidden(self, demo_setup, tenants, test_fleet_tenant):
        r = requests.post(
            f"{API}/auth/select-tenant",
            headers=_h(demo_setup["access_token"]),
            json={"tenant_id": test_fleet_tenant["id"]},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_demo_impersonate_forbidden(self, demo_setup, test_fleet_tenant):
        r = requests.post(
            f"{API}/platform/tenants/{test_fleet_tenant['id']}/impersonate",
            headers=_h(demo_setup["access_token"]),
            timeout=30,
        )
        assert r.status_code == 403

    def test_demo_cross_tenant_header_blocked(self, demo_setup, test_fleet_tenant):
        """Even if X-Tenant-ID is spoofed, demo should see only its own tenant data."""
        tid = test_fleet_tenant["id"]
        r = requests.get(f"{API}/vehicles", headers=_h(demo_setup["access_token"], tid), timeout=30)
        # Either 403 or pinned-to-demo-tenant (not foreign data)
        if r.status_code == 200:
            # must not contain foreign tenant data - we can check via me endpoint being pinned
            me = requests.get(f"{API}/auth/me", headers=_h(demo_setup["access_token"], tid), timeout=30).json()
            ctx = me.get("current_context") or {}
            assert ctx.get("tenant_id") == demo_setup["tenant_id"], (
                f"demo session leaked to foreign tenant: ctx={ctx}"
            )
        else:
            assert r.status_code in (403, 404)


# ================= SUPPORT ADMIN =================
class TestSupportAdmin:
    @pytest.fixture(scope="class")
    def support_token(self):
        return _login("support@quickwing.com", "QuickWing123!")

    def test_me_not_platform_admin(self, support_token):
        r = requests.get(f"{API}/auth/me", headers=_h(support_token), timeout=30)
        assert r.status_code == 200
        ctx = r.json().get("current_context") or {}
        assert ctx.get("is_platform_admin") is False, f"support must NOT be platform admin: {ctx}"

    def test_platform_forbidden(self, support_token):
        r = requests.get(f"{API}/platform/tenants", headers=_h(support_token), timeout=30)
        assert r.status_code == 403

    def test_can_select_member_tenant(self, support_token, test_fleet_tenant):
        r = requests.post(
            f"{API}/auth/select-tenant",
            headers=_h(support_token),
            json={"tenant_id": test_fleet_tenant["id"]},
            timeout=30,
        )
        assert r.status_code == 200, r.text
