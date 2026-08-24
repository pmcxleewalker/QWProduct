"""Regression test for Auditor Pack PDF endpoint (iteration 41)."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")


def _login(email, password, tenant_slug=None):
    payload = {"email": email, "password": password}
    if tenant_slug:
        payload["tenant_slug"] = tenant_slug
    r = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"]


def test_auditor_pack_pdf_download():
    token = _login("admin.test-fleet@quickwing.com", "admin123", "test-fleet")
    r = requests.get(
        f"{BASE_URL}/api/tenant/reports/compliance-pack/pdf",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    assert r.status_code == 200, f"PDF endpoint failed: {r.status_code} {r.text[:400]}"
    assert r.headers.get("content-type", "").startswith("application/pdf"), r.headers
    assert r.content[:4] == b"%PDF", "Response is not a valid PDF"
    assert len(r.content) > 1000, f"PDF too small: {len(r.content)} bytes"


def test_auditor_pack_requires_admin():
    # Staff should not be allowed
    token = _login("teststaff@quickwing.com", "Staff123", "test-fleet")
    r = requests.get(
        f"{BASE_URL}/api/tenant/reports/compliance-pack/pdf",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


def test_auditor_pack_unauth():
    r = requests.get(f"{BASE_URL}/api/tenant/reports/compliance-pack/pdf", timeout=20)
    assert r.status_code in (401, 403)
