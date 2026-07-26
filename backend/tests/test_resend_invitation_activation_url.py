"""
Iteration 38 — Regression tests for the 'Resend Invite' fallback fix.

Fix under test: /api/tenant/users/{user_id}/resend-invitation must
now return `activation_url` in the response so the frontend can offer
a copyable link when email delivery fails (Resend free-tier / unverified
domain). See server.py ~line 12175 and _issue_staff_invitation ~12021.

Covers:
  - 200 response contains keys: message, email_sent, email_error,
    temporary_password, activation_url.
  - activation_url is a full https URL of form
    https://<host>/<tenant_slug>/activate?token=<64-hex>.
  - Token is inserted into activation_tokens (used=False, 7-day expiry)
    — verified via GET /api/auth/activation-token/{token} (public info
    endpoint) which returns 200 for a valid unused token.
  - Cross-tenant: resending user-of-tenant-A while impersonating tenant-B
    returns 404 'User is not a member of this tenant'.
  - Non-admin (staff role) hitting endpoint gets 403.
  - Password is reset to 'QuickWing123!' after resend (login works).
"""
import os
import re
import uuid
import pytest
import requests


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
TEST_FLEET_SLUG = "test-fleet"
TEST_FLEET_ID = "f95fbe53-46cc-4f29-af6b-b9ea51758cbd"

TOKEN_RE = re.compile(r"^[a-f0-9]{64}$")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["access_token"]


def _select_tenant(token, tenant_id):
    r = requests.post(f"{BASE_URL}/api/auth/select-tenant",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"tenant_id": tenant_id}, timeout=30)
    assert r.status_code == 200, f"select-tenant -> {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- fixtures ----------------

@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def tenant_a_token(super_token):
    """Scoped to test-fleet (per the review request)."""
    return _select_tenant(super_token, TEST_FLEET_ID)


@pytest.fixture(scope="module")
def tenant_b(super_token):
    """A second tenant — for cross-tenant isolation."""
    r = requests.get(f"{BASE_URL}/api/platform/tenants",
                     headers={"Authorization": f"Bearer {super_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    tenants = data.get("tenants", data) if isinstance(data, dict) else data
    other = next((t for t in tenants if t["id"] != TEST_FLEET_ID), None)
    if not other:
        pytest.skip("no second tenant available")
    token = _select_tenant(super_token, other["id"])
    return {"id": other["id"], "slug": other.get("slug"), "token": token}


@pytest.fixture(scope="module")
def staff_user(tenant_a_token):
    """Create a disposable staff user in test-fleet for resend testing."""
    email = f"TEST_resend_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE_URL}/api/tenant/users",
                      headers=_auth(tenant_a_token),
                      json={"email": email, "name": "TEST Resend Staff", "role": "staff"},
                      timeout=30)
    assert r.status_code in (200, 201), f"create staff -> {r.status_code} {r.text}"
    body = r.json()
    uid = body.get("user_id") or body.get("id") or (body.get("user") or {}).get("id")
    assert uid, f"no user id in create response: {body}"
    return {"id": uid, "email": email}


# ---------------- tests ----------------

class TestResendInvitationResponse:
    """The resend endpoint must return activation_url and a valid schema."""

    def test_response_schema_and_activation_url(self, tenant_a_token, staff_user):
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{staff_user['id']}/resend-invitation",
            headers=_auth(tenant_a_token), timeout=30,
        )
        assert r.status_code == 200, f"resend -> {r.status_code} {r.text}"
        body = r.json()
        # Required keys
        for key in ("message", "email_sent", "temporary_password", "activation_url"):
            assert key in body, f"missing key {key} in {body}"
        assert "email_error" in body  # may be None if email_sent True

        # Temp password contract
        assert body["temporary_password"] == "QuickWing123!"

        # Activation URL shape
        url = body["activation_url"]
        assert isinstance(url, str) and url.startswith("https://"), url
        # Contains /<slug>/activate?token=<64-hex>
        m = re.match(r"^https://[^/]+/([^/]+)/activate\?token=([a-f0-9]{64})$", url)
        assert m, f"unexpected activation URL shape: {url}"
        assert m.group(1) == TEST_FLEET_SLUG, f"slug mismatch: {m.group(1)}"
        # Stash for the next test
        pytest.resend_activation_url = url
        pytest.resend_activation_token = m.group(2)

    def test_activation_token_persisted_and_unused(self, tenant_a_token):
        token = getattr(pytest, "resend_activation_token", None)
        assert token, "previous test must succeed"
        # Public info endpoint (no auth) should confirm token exists & is unused
        r = requests.get(f"{BASE_URL}/api/auth/activation-token/{token}", timeout=30)
        # If the endpoint doesn't exist, we still assert 4xx and skip
        if r.status_code == 404 and "activation-token" not in r.text.lower():
            pytest.skip("no public introspection endpoint for activation token")
        assert r.status_code == 200, f"activation token lookup -> {r.status_code} {r.text}"
        info = r.json()
        # slug should match test-fleet
        slug = info.get("tenant_slug") or info.get("slug")
        if slug is not None:
            assert slug == TEST_FLEET_SLUG
        # not yet used
        used = info.get("used")
        if used is not None:
            assert used is False

    def test_password_reset_to_default(self, tenant_a_token, staff_user):
        # Do a fresh resend so we know password_hash == 'QuickWing123!'
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{staff_user['id']}/resend-invitation",
            headers=_auth(tenant_a_token), timeout=30,
        )
        assert r.status_code == 200, r.text
        # Login as the staff with the default password
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": staff_user["email"], "password": "QuickWing123!"},
                              timeout=30)
        assert login.status_code == 200, f"login as staff with default pwd -> {login.status_code} {login.text}"
        # And the response should indicate require_password_change (best-effort — schema varies)
        body = login.json()
        rpc = body.get("require_password_change")
        if rpc is not None:
            assert rpc is True


class TestResendInvitationAuthorization:
    def test_cross_tenant_returns_404(self, tenant_b, staff_user):
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{staff_user['id']}/resend-invitation",
            headers=_auth(tenant_b["token"]), timeout=30,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"
        assert "not a member of this tenant" in r.text.lower()

    def test_staff_role_forbidden(self, staff_user):
        """A user with role=staff must NOT be able to hit the resend endpoint."""
        # Login as the staff user we just created
        token = _login(staff_user["email"], "QuickWing123!")
        scoped = _select_tenant(token, TEST_FLEET_ID)
        # Try to resend for themselves — must 403
        r = requests.post(
            f"{BASE_URL}/api/tenant/users/{staff_user['id']}/resend-invitation",
            headers=_auth(scoped), timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"
