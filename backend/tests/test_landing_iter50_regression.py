"""Iteration 50 landing/backend regression tests.

Modules covered:
- Public contact endpoint contract and validation
- Landing static media availability (video)
"""

import os
from datetime import datetime, timezone

import pytest
import requests


def _base_url() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # fallback to frontend env file only when test runner env is missing the var
        with open("/app/frontend/.env", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    assert url, "REACT_APP_BACKEND_URL is required"
    return url.rstrip("/")


BASE_URL = _base_url()


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestLandingContactEndpoint:
    """Public contact endpoint checks for landing integration."""

    def test_contact_submit_success(self, api_client):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        payload = {
            "name": f"QA Iter50 {stamp}",
            "email": f"qa.iter50.{stamp}@example.com",
            "company": "QA Fleet",
            "phone": "+353850000000",
            "message": "QA iteration 50 end-to-end landing contact verification",
            "type": "general",
        }
        response = api_client.post(f"{BASE_URL}/api/public/contact", json=payload, timeout=30)
        assert response.status_code == 200, response.text

        data = response.json()
        assert data.get("ok") is True
        assert isinstance(data.get("id"), str)
        assert len(data["id"]) > 0

    def test_contact_missing_name_returns_400(self, api_client):
        response = api_client.post(
            f"{BASE_URL}/api/public/contact",
            json={"name": "", "email": "qa@example.com", "type": "general"},
            timeout=20,
        )
        assert response.status_code == 400

        data = response.json()
        assert "detail" in data

    def test_contact_missing_email_returns_400(self, api_client):
        response = api_client.post(
            f"{BASE_URL}/api/public/contact",
            json={"name": "QA Missing Email", "email": "", "type": "general"},
            timeout=20,
        )
        assert response.status_code == 400

        data = response.json()
        assert "detail" in data


def test_demo_video_is_served():
    """Landing product demo media must be reachable from public host."""
    response = requests.get(
        f"{BASE_URL}/video/quick-wing-demo.mp4",
        headers={"Range": "bytes=0-2047"},
        timeout=30,
        stream=True,
    )
    assert response.status_code in (200, 206)
