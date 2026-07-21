"""Verify magic-link URLs are derived from request host (X-Forwarded-Host / Host)
rather than the FRONTEND_URL env var.

Design note: the Kubernetes ingress rewrites X-Forwarded-Host before it reaches
the backend, so header-derivation tests use the internal loopback port (8001)
to inject headers directly. The 'default preview host' test uses the public URL
to prove the ORIGINAL bug (URL pointing to cartrack-19.emergent.host) is fixed.
"""
import os
import time
import pytest
import requests
from urllib.parse import urlparse


def _load_public_base():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not v:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    v = line.split("=", 1)[1].strip()
                    break
    return v.rstrip("/")


PUBLIC_BASE = _load_public_base()
PREVIEW_HOST = urlparse(PUBLIC_BASE).hostname
INTERNAL_BASE = "http://localhost:8001"
assert PUBLIC_BASE and PREVIEW_HOST

SUPER_EMAIL = "superadmin@quickwing.com"
SUPER_PASS = "Super123"


def _login(base):
    r = requests.post(f"{base}/api/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def super_headers_public():
    return _login(PUBLIC_BASE)


@pytest.fixture(scope="module")
def super_headers_internal():
    return _login(INTERNAL_BASE)


TS = int(time.time())
_created = []


def teardown_module(mod):
    try:
        h = _login(INTERNAL_BASE)
        for tid in _created:
            requests.delete(f"{INTERNAL_BASE}/api/platform/tenants/{tid}", headers=h, timeout=10)
    except Exception:
        pass


def _create_demo(base, headers, suffix, extra=None):
    hdrs = dict(headers)
    if extra:
        hdrs.update(extra)
    payload = {
        "name": f"HD {suffix}",
        "slug": f"hd-{TS}-{suffix}",
        "admin_email": f"hd-{TS}-{suffix}@example.com",
        "admin_password": "Passw0rd!",
        "is_demo": True,
        "demo_expires_in_days": 7,
    }
    r = requests.post(f"{base}/api/platform/tenants", json=payload, headers=hdrs, timeout=25)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    data = r.json()
    tid = data.get("id") or data.get("tenant", {}).get("id")
    if tid:
        _created.append(tid)
    return data


# ---- Public URL tests: prove the ORIGINAL bug (wrong Emergent host) is fixed ----

def test_create_demo_url_uses_current_preview_host_public(super_headers_public):
    data = _create_demo(PUBLIC_BASE, super_headers_public, "pub-a")
    ml = data.get("magic_link") or {}
    url = ml.get("url", "")
    assert url, f"missing magic_link.url in {data}"
    # URL must be on the same preview host the admin is browsing
    assert url.startswith(f"https://{PREVIEW_HOST}/demo-link/"), url
    # Explicitly not the previously-reported wrong deployment
    assert "cartrack" not in url, url


def test_list_tenants_urls_use_current_preview_host_public(super_headers_public):
    r = requests.get(f"{PUBLIC_BASE}/api/platform/tenants", headers=super_headers_public, timeout=20)
    assert r.status_code == 200
    tenants = r.json()
    if isinstance(tenants, dict):
        tenants = tenants.get("tenants", [])
    demos = [t for t in tenants if t.get("magic_link")]
    assert demos
    for t in demos:
        assert t["magic_link"]["url"].startswith(f"https://{PREVIEW_HOST}/"), t["magic_link"]["url"]


def test_list_demo_tokens_urls_use_preview_host_public(super_headers_public):
    r = requests.get(f"{PUBLIC_BASE}/api/platform/demo-tokens", headers=super_headers_public, timeout=20)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and rows
    for row in rows:
        assert PREVIEW_HOST in row["url"], row["url"]
        assert "cartrack" not in row["url"]


def test_regenerate_uses_preview_host_public(super_headers_public):
    data = _create_demo(PUBLIC_BASE, super_headers_public, "pub-b")
    tid = data.get("id") or data.get("tenant", {}).get("id")
    r = requests.post(f"{PUBLIC_BASE}/api/platform/tenants/{tid}/magic-link", headers=super_headers_public, json={}, timeout=20)
    assert r.status_code in (200, 201), r.text
    assert r.json()["url"].startswith(f"https://{PREVIEW_HOST}/demo-link/")


# ---- Internal-loopback tests: prove X-Forwarded-Host / Proto ARE honoured ----

def test_create_demo_honours_x_forwarded_host_internal(super_headers_internal):
    data = _create_demo(INTERNAL_BASE, super_headers_internal, "int-a",
                        extra={"X-Forwarded-Host": "quick-wing.com", "X-Forwarded-Proto": "https"})
    url = (data.get("magic_link") or {}).get("url", "")
    assert url.startswith("https://quick-wing.com/demo-link/"), url


def test_create_demo_falls_back_to_host_header_internal(super_headers_internal):
    data = _create_demo(INTERNAL_BASE, super_headers_internal, "int-b",
                        extra={"Host": "qtrack-4.emergent.host"})
    url = (data.get("magic_link") or {}).get("url", "")
    # host header should be used when X-Forwarded-Host is absent
    assert "qtrack-4.emergent.host" in url, url


def test_list_tenants_honours_x_forwarded_host_internal(super_headers_internal):
    h = dict(super_headers_internal); h["X-Forwarded-Host"] = "quick-wing.com"; h["X-Forwarded-Proto"] = "https"
    r = requests.get(f"{INTERNAL_BASE}/api/platform/tenants", headers=h, timeout=20)
    assert r.status_code == 200
    tenants = r.json()
    if isinstance(tenants, dict):
        tenants = tenants.get("tenants", [])
    demos = [t for t in tenants if t.get("magic_link")]
    assert demos
    for t in demos:
        assert t["magic_link"]["url"].startswith("https://quick-wing.com/"), t["magic_link"]["url"]


def test_regenerate_honours_x_forwarded_host_internal(super_headers_internal):
    data = _create_demo(INTERNAL_BASE, super_headers_internal, "int-c")
    tid = data.get("id") or data.get("tenant", {}).get("id")
    h = dict(super_headers_internal); h["X-Forwarded-Host"] = "quick-wing.com"; h["X-Forwarded-Proto"] = "https"
    r = requests.post(f"{INTERNAL_BASE}/api/platform/tenants/{tid}/magic-link", headers=h, json={}, timeout=20)
    assert r.status_code in (200, 201), r.text
    assert r.json()["url"].startswith("https://quick-wing.com/demo-link/"), r.json()["url"]


def test_list_demo_tokens_honours_x_forwarded_host_internal(super_headers_internal):
    h = dict(super_headers_internal); h["X-Forwarded-Host"] = "quick-wing.com"; h["X-Forwarded-Proto"] = "https"
    r = requests.get(f"{INTERNAL_BASE}/api/platform/demo-tokens", headers=h, timeout=20)
    assert r.status_code == 200
    rows = r.json()
    assert rows
    for row in rows:
        assert row["url"].startswith("https://quick-wing.com/"), row["url"]


# ---- End-to-end: magic-link URL actually works (redeemable) ----

def test_magic_link_url_is_functional_e2e(super_headers_public):
    data = _create_demo(PUBLIC_BASE, super_headers_public, "e2e")
    ml = data.get("magic_link") or {}
    url = ml["url"]
    token = ml["token"]
    assert PREVIEW_HOST in url and "/demo-link/" in url
    # Redeem via API using token — proves URL host + token wiring
    redeem = requests.post(f"{PUBLIC_BASE}/api/demo/redeem", json={"token": token}, timeout=20)
    assert redeem.status_code == 200, redeem.text
    body = redeem.json()
    assert body.get("access_token")
    # backend returns 'active_tenant' with tenant_id
    at = body.get("active_tenant") or {}
    assert at.get("tenant_id"), body


# ---- Regression ----

def test_real_tenant_creation_unaffected(super_headers_public):
    payload = {
        "name": f"Real HD {TS}",
        "slug": f"real-hd2-{TS}",
        "admin_email": f"realhd-{TS}@example.com",
        "admin_password": "Passw0rd!",
    }
    r = requests.post(f"{PUBLIC_BASE}/api/platform/tenants", json=payload, headers=super_headers_public, timeout=25)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tid = data.get("id") or data.get("tenant", {}).get("id")
    if tid:
        _created.append(tid)
    assert not data.get("magic_link"), f"real tenant should not have magic_link: {data}"
