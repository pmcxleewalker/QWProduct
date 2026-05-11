"""
Regression tests for the invite/reset-password bug fix (iteration 24).

Bug: /api/tenant/users/{user_id}/resend-invitation was querying
db.tenant_users (empty collection) instead of db.memberships, so every
re-invite attempt 404'd with "User is not a member of this tenant".
Fix landed in server.py at line ~10365.

Also covers:
 - POST /api/tenant/users (create staff -> membership row)
 - POST /api/tenant/users/{user_id}/reset-password
 - Tenant isolation: a user created in tenant A must NOT be visible to
   tenant B's resend-invitation endpoint (404 expected).
 - GDPR endpoints that previously crashed due to undefined uuid4()
     - GET    /api/users/me/data-export
     - DELETE /api/users/me
     - POST   /api/users/me/consent
"""
import os
import uuid
import requests
import pytest


# ---------------------- env / constants ----------------------

def _read_env(path, key):
    try:
        with open(path) as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"')
    except Exception:
        return None


BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or _read_env("/app/frontend/.env", "REACT_APP_BACKEND_URL")
).rstrip("/")

SUPER_EMAIL = "superadmin@quickwing.com"
SUPER_PASS = "Super123"


# ---------------------- helpers ----------------------

def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _list_tenants(super_token: str):
    r = requests.get(
        f"{BASE_URL}/api/platform/tenants",
        headers={"Authorization": f"Bearer {super_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    return data.get("tenants", data) if isinstance(data, dict) else data


def _select_tenant(token: str, tenant_id: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/select-tenant",
        headers={"Authorization": f"Bearer {token}"},
        json={"tenant_id": tenant_id},
        timeout=30,
    )
    assert r.status_code == 200, f"select-tenant failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


# ---------------------- fixtures ----------------------

@pytest.fixture(scope="session")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="session")
def tenants(super_token):
    ts = _list_tenants(super_token)
    assert len(ts) >= 1, "Need at least one tenant"
    return ts


@pytest.fixture(scope="session")
def tenant_a(super_token, tenants):
    # Prefer the test-fleet tenant the previous testing agent created
    primary = next((t for t in tenants if t.get("slug") == "test-fleet"), tenants[0])
    token = _select_tenant(super_token, primary["id"])
    return {"id": primary["id"], "slug": primary.get("slug"), "token": token}


@pytest.fixture(scope="session")
def tenant_b(super_token, tenants, tenant_a):
    other = next((t for t in tenants if t["id"] != tenant_a["id"]), None)
    if not other:
        # Create a disposable second tenant on the fly for isolation tests
        slug = f"test-iso-{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            headers={"Authorization": f"Bearer {super_token}", "Content-Type": "application/json"},
            json={
                "name": f"TEST Iso {slug}",
                "slug": slug,
                "plan": "standard",
            },
            timeout=30,
        )
        if r.status_code not in (200, 201):
            pytest.skip(f"Could not create 2nd tenant for isolation tests: {r.status_code} {r.text}")
        body = r.json()
        # response shape: { tenant: {...}, master_admin: {...} } OR flat
        tid = (body.get("tenant") or body).get("id") or body.get("tenant_id")
        if not tid:
            pytest.skip(f"create_tenant response missing id: {body}")
        other = {"id": tid, "slug": slug}
    token = _select_tenant(super_token, other["id"])
    return {"id": other["id"], "slug": other.get("slug"), "token": token}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ==================== TESTS ====================

# Tenant user management — create / resend / reset
class TestTenantUserManagement:
    def test_create_staff_writes_to_memberships(self, tenant_a, super_token):
        """POST /api/tenant/users must create a row in db.memberships
        (not db.tenant_users which is empty). Verify by listing tenant users."""
        email = f"TEST_staff_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(
            f"{BASE_URL}/api/tenant/users",
            headers=_auth(tenant_a["token"]),
            json={"email": email, "name": "TEST Staff Member"},
            timeout=30,
        )
        assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
        body = r.json()
        user_id = body.get("user_id") or body.get("id") or (body.get("user") or {}).get("id")
        assert user_id, f"No user_id in response: {body}"

        # Sanity: GET tenant users should return the new user
        r2 = requests.get(
            f"{BASE_URL}/api/tenant/users",
            headers=_auth(tenant_a["token"]),
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        users = r2.json()
        if isinstance(users, dict):
            users = users.get("users", [])
        ids = [u.get("id") or u.get("user_id") for u in users]
        assert user_id in ids, f"Newly-created user {user_id} not visible to tenant"

        # store for later tests
        pytest.created_user_id = user_id
        pytest.created_user_email = email

    def test_resend_invitation_returns_200(self, tenant_a):
        """Primary bug fix: resend-invitation must now return 200 'Invitation re-sent'
        for a user that lives in db.memberships."""
        user_id = getattr(pytest, "created_user_id", None)
        assert user_id, "Previous create test must run first"

        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{user_id}/resend-invitation",
            headers=_auth(tenant_a["token"]),
            timeout=30,
        )
        assert r.status_code == 200, f"resend failed: {r.status_code} {r.text}"
        body = r.json()
        # Either email succeeded ("Invitation re-sent") or DKIM failed
        # ("User reset; email failed") — both are non-error 200 paths.
        assert body.get("message"), f"missing message: {body}"
        assert "email_sent" in body
        assert "temporary_password" in body
        assert body.get("temporary_password") == "QuickWing123!"

    def test_resend_invitation_for_bogus_user_returns_404(self, tenant_a):
        """Random uuid should NOT be in memberships -> 404 with the
        exact production error message."""
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{uuid.uuid4().hex}/resend-invitation",
            headers=_auth(tenant_a["token"]),
            timeout=30,
        )
        assert r.status_code == 404, r.text
        assert "not a member of this tenant" in r.text.lower()

    def test_reset_password_round_trip(self, tenant_a):
        """Admin can reset the staff password and the new password works."""
        user_id = getattr(pytest, "created_user_id", None)
        email = getattr(pytest, "created_user_email", None)
        assert user_id and email

        new_pwd = "NewTestPass123!"
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{user_id}/reset-password",
            headers=_auth(tenant_a["token"]),
            json={"admin_password": SUPER_PASS, "new_password": new_pwd},
            timeout=30,
        )
        assert r.status_code == 200, f"reset failed: {r.status_code} {r.text}"
        body = r.json()
        assert "reset successfully" in body.get("message", "").lower()

        # Verify the user can now login with the new password
        login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": new_pwd},
            timeout=30,
        )
        assert login.status_code == 200, f"login with new password failed: {login.text}"

    def test_reset_password_wrong_admin_password_returns_401(self, tenant_a):
        user_id = getattr(pytest, "created_user_id", None)
        assert user_id
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{user_id}/reset-password",
            headers=_auth(tenant_a["token"]),
            json={"admin_password": "WRONG", "new_password": "Whatever123!"},
            timeout=30,
        )
        assert r.status_code == 401, r.text


# Tenant isolation — a user_id from tenant A must NOT resolve in tenant B
class TestTenantIsolation:
    def test_resend_invitation_from_different_tenant_returns_404(
        self, tenant_a, tenant_b
    ):
        user_id = getattr(pytest, "created_user_id", None)
        if not user_id:
            pytest.skip("create test must succeed first")
        # tenant_b's admin token should NOT see this user
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{user_id}/resend-invitation",
            headers=_auth(tenant_b["token"]),
            timeout=30,
        )
        assert r.status_code == 404, (
            f"Tenant isolation broken! Tenant {tenant_b['id']} can re-invite a "
            f"user that belongs to tenant {tenant_a['id']}. {r.status_code} {r.text}"
        )
        assert "not a member of this tenant" in r.text.lower()

    def test_reset_password_from_different_tenant_returns_404(
        self, tenant_a, tenant_b
    ):
        user_id = getattr(pytest, "created_user_id", None)
        if not user_id:
            pytest.skip("create test must succeed first")
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{user_id}/reset-password",
            headers=_auth(tenant_b["token"]),
            json={"admin_password": SUPER_PASS, "new_password": "Whatever123!"},
            timeout=30,
        )
        # Either 401 (admin pw wrong for tenant_b admin) or 404 (user not found)
        # — what we MUST NOT see is 200 (cross-tenant password reset).
        assert r.status_code in (401, 404), (
            f"Cross-tenant password reset succeeded! {r.status_code} {r.text}"
        )


# GDPR endpoints — verify no NameError from old undefined uuid4 references
class TestGDPREndpoints:
    """The fix replaced bare uuid4() (undefined) with uuid.uuid4().
    These endpoints must now respond with non-500 codes."""

    def _make_disposable_user(self, super_token, tenant_a):
        email = f"TEST_gdpr_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(
            f"{BASE_URL}/api/tenant/users",
            headers=_auth(tenant_a["token"]),
            json={"email": email, "name": "TEST GDPR"},
            timeout=30,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        user_id = body.get("user_id") or (body.get("user") or {}).get("id")
        temp_pwd = body.get("temporary_password")
        # If api didn't return temp pwd, force a reset to a known value
        if not temp_pwd:
            temp_pwd = "GDPRTestPass123!"
            rr = requests.post(
                f"{BASE_URL}/api/tenant/users/{user_id}/reset-password",
                headers=_auth(tenant_a["token"]),
                json={"admin_password": SUPER_PASS, "new_password": temp_pwd},
                timeout=30,
            )
            assert rr.status_code == 200, rr.text
        # login as the new user, then select-tenant
        token = _login(email, temp_pwd)
        scoped = _select_tenant(token, tenant_a["id"])
        return email, user_id, scoped

    def test_data_export(self, super_token, tenant_a):
        email, user_id, token = self._make_disposable_user(super_token, tenant_a)
        r = requests.get(
            f"{BASE_URL}/api/users/me/data-export",
            headers=_auth(token),
            timeout=30,
        )
        assert r.status_code == 200, f"data-export crashed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("user_profile", {}).get("email") == email
        assert "memberships" in body and "bookings" in body

    def test_record_consent(self, super_token, tenant_a):
        email, user_id, token = self._make_disposable_user(super_token, tenant_a)
        r = requests.post(
            f"{BASE_URL}/api/users/me/consent",
            headers=_auth(token),
            json={"consent_type": "privacy_policy", "consented": True, "version": "1.0"},
            timeout=30,
        )
        assert r.status_code == 200, f"consent crashed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("consent_id"), f"no consent_id returned: {body}"

    def test_delete_account(self, super_token, tenant_a):
        email, user_id, token = self._make_disposable_user(super_token, tenant_a)
        r = requests.delete(
            f"{BASE_URL}/api/users/me",
            headers=_auth(token),
            timeout=30,
        )
        assert r.status_code == 200, f"delete-account crashed: {r.status_code} {r.text}"
        # subsequent login should fail
        login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": "GDPRTestPass123!"},
            timeout=30,
        )
        assert login.status_code in (401, 403, 404), login.text
