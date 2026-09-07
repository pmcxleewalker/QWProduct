"""Tests for P0 fix (Object Storage) and Guided Tour narration/TTS."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-media-hub-77.preview.emergentagent.com").rstrip("/")

# Fallback: also read from frontend .env if not set
if "REACT_APP_BACKEND_URL" not in os.environ:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass


# ---------- Auth helpers ----------
def _login(email, password, tenant_slug=None):
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": email, "password": password}
    if tenant_slug:
        payload["tenant_slug"] = tenant_slug
    r = requests.post(url, json=payload, timeout=30)
    return r


@pytest.fixture(scope="module")
def tenant_admin_token():
    r = _login("victim.admin@example.com", "Admin123", tenant_slug="test-fleet")
    if r.status_code != 200:
        # try without tenant_slug
        r = _login("victim.admin@example.com", "Admin123")
    assert r.status_code == 200, f"Tenant admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def super_admin_token():
    r = _login("superadmin@quickwing.com", "Super123")
    assert r.status_code == 200, f"Super admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token
    return token


# ---------- Logo upload (Object Storage) ----------
def _tiny_png_bytes():
    # 1x1 transparent PNG
    import base64
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )


def test_tenant_logo_upload_and_roundtrip(tenant_admin_token):
    files = {"file": ("logo.png", _tiny_png_bytes(), "image/png")}
    headers = {"Authorization": f"Bearer {tenant_admin_token}"}
    r = requests.post(f"{BASE_URL}/api/tenant/upload-logo", headers=headers, files=files, timeout=60)
    assert r.status_code == 200, f"upload-logo failed: {r.status_code} {r.text}"
    data = r.json()
    logo_url = data.get("logo_url") or data.get("url")
    assert logo_url, f"No logo_url in response: {data}"
    assert "/api/uploads/logos/" in logo_url, f"Unexpected logo_url: {logo_url}"

    # GET the logo (public)
    full = logo_url if logo_url.startswith("http") else f"{BASE_URL}{logo_url}"
    g = requests.get(full, timeout=30)
    assert g.status_code == 200, f"GET {full} => {g.status_code}"
    assert g.headers.get("content-type", "").startswith("image/"), f"content-type={g.headers.get('content-type')}"
    assert len(g.content) > 0


# ---------- Content-worker asset upload ----------
def test_content_worker_asset_upload_and_roundtrip(super_admin_token):
    files = {"file": ("sample.png", _tiny_png_bytes(), "image/png")}
    headers = {"Authorization": f"Bearer {super_admin_token}"}
    data = {"title": "TEST_asset", "asset_type": "image"}
    r = requests.post(
        f"{BASE_URL}/api/content-worker/assets/upload",
        headers=headers,
        files=files,
        data=data,
        timeout=60,
    )
    assert r.status_code in (200, 201), f"asset upload failed: {r.status_code} {r.text}"
    body = r.json()
    asset = body.get("asset") or body
    url = asset.get("original_file_url") or asset.get("url") or body.get("original_file_url")
    assert url, f"No original_file_url in response: {body}"
    assert "/api/content-worker/files/" in url, f"Unexpected file url: {url}"

    full = url if url.startswith("http") else f"{BASE_URL}{url}"
    g = requests.get(full, timeout=30)
    assert g.status_code == 200, f"GET {full} => {g.status_code}"
    ctype = g.headers.get("content-type", "")
    assert ctype.startswith("image/") or ctype == "application/octet-stream", f"content-type={ctype}"
    assert len(g.content) > 0


# ---------- Tour narration TTS ----------
def test_tour_narration_returns_url_and_audio(tenant_admin_token):
    headers = {"Authorization": f"Bearer {tenant_admin_token}"}
    text = "Welcome to Quick Wing"
    r = requests.post(f"{BASE_URL}/api/tour/narration", headers=headers, json={"text": text}, timeout=90)
    assert r.status_code == 200, f"narration failed: {r.status_code} {r.text}"
    data = r.json()
    url = data.get("url")
    assert url and url.startswith("/api/tour/tts/") and url.endswith(".mp3"), f"Bad url: {url}"

    full = f"{BASE_URL}{url}"
    g = requests.get(full, timeout=60)
    assert g.status_code == 200, f"GET tts => {g.status_code}"
    assert g.headers.get("content-type", "").startswith("audio/"), f"content-type={g.headers.get('content-type')}"
    assert len(g.content) > 1000, f"audio too small: {len(g.content)} bytes"


def test_tour_narration_cache_same_text_same_url(tenant_admin_token):
    headers = {"Authorization": f"Bearer {tenant_admin_token}"}
    text = "Welcome to Quick Wing"
    r1 = requests.post(f"{BASE_URL}/api/tour/narration", headers=headers, json={"text": text}, timeout=90)
    r2 = requests.post(f"{BASE_URL}/api/tour/narration", headers=headers, json={"text": text}, timeout=90)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["url"] == r2.json()["url"], "Cache miss: same text produced different urls"


def test_tour_narration_different_text_different_url(tenant_admin_token):
    headers = {"Authorization": f"Bearer {tenant_admin_token}"}
    r1 = requests.post(f"{BASE_URL}/api/tour/narration", headers=headers, json={"text": "Welcome to Quick Wing"}, timeout=90)
    r2 = requests.post(f"{BASE_URL}/api/tour/narration", headers=headers, json={"text": "This is your fleet overview"}, timeout=90)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["url"] != r2.json()["url"], "Different text produced same url"
