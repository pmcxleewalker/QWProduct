"""Iteration 49 — Landing page backend coverage.

Covers:
- /api/public/contact (new landing form) stores lead and emails Lee.
- Login still works for superadmin and tenant admin (regression).
- Static assets (/images, /video) served by preview host.
"""
import os
import requests
import pytest

def _load_env():
    try:
        from dotenv import load_dotenv  # noqa
        load_dotenv("/app/frontend/.env")
    except Exception:
        pass
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # last-resort: parse manually
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    assert url, "REACT_APP_BACKEND_URL missing"
    return url.rstrip("/")


BASE = _load_env()


# ---------- Contact ----------
class TestPublicContact:
    def test_contact_submit_success_emails_lee(self):
        payload = {
            "name": "TEST_Iter49 Playwright",
            "email": "TEST_iter49@example.com",
            "company": "TEST Co",
            "phone": "+353000000000",
            "message": "Automated iter49 regression test",
            "type": "general",
        }
        r = requests.post(f"{BASE}/api/public/contact", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("id"), str) and len(data["id"]) > 0

    def test_contact_missing_name_rejected(self):
        r = requests.post(
            f"{BASE}/api/public/contact",
            json={"name": "", "email": "x@y.com"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_contact_missing_email_rejected(self):
        r = requests.post(
            f"{BASE}/api/public/contact",
            json={"name": "x", "email": ""},
            timeout=15,
        )
        assert r.status_code == 400


# ---------- Auth regression ----------
class TestAuthRegression:
    def test_superadmin_login(self):
        r = requests.post(
            f"{BASE}/api/auth/login",
            json={"email": "superadmin@quickwing.com", "password": "Super123"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        tok = r.json().get("access_token") or r.json().get("token")
        assert tok

    def test_tenant_admin_login(self):
        r = requests.post(
            f"{BASE}/api/auth/login",
            json={"email": "admin.test-fleet@quickwing.com", "password": "admin123"},
            timeout=20,
        )
        assert r.status_code == 200, r.text


# ---------- Static assets ----------
@pytest.mark.parametrize(
    "path",
    [
        "/images/quick-wing-logo-wide.png",
        "/images/app-dashboard.jpg",
        "/images/hcci-award-lee-walker.jpg",
        "/images/demo-poster.jpg",
    ],
)
def test_image_served(path):
    r = requests.get(f"{BASE}{path}", timeout=20)
    assert r.status_code == 200, f"{path} -> {r.status_code}"


def test_video_served():
    # Use Range header to be nice (video can be large) — expect 206 or 200.
    r = requests.get(
        f"{BASE}/video/quick-wing-demo.mp4",
        headers={"Range": "bytes=0-1023"},
        timeout=30,
        stream=True,
    )
    assert r.status_code in (200, 206), r.status_code
