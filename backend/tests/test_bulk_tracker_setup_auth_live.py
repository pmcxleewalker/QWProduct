"""Live API auth/authorization checks for bulk tracker setup and tenant isolation."""
import os
from pathlib import Path

import pytest
import requests


def _base_url() -> str:
    if os.environ.get("REACT_APP_BACKEND_URL"):
        return os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL is required")


BASE_URL = _base_url()
SUPER_EMAIL = "superadmin@quickwing.com"
SUPER_PASSWORD = "Super123"
VICTIM_EMAIL = "victim.admin@example.com"
VICTIM_PASSWORD = "Admin123"


@pytest.fixture(scope="module")
def super_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD}, timeout=30)
    if response.status_code != 200:
        pytest.skip("Super admin login failed on preview")
    data = response.json()
    assert data["user"]["role"] == "super_admin"
    return data["access_token"]


@pytest.fixture(scope="module")
def victim_session():
    response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": VICTIM_EMAIL, "password": VICTIM_PASSWORD}, timeout=30)
    if response.status_code != 200:
        pytest.skip("Victim admin login failed on preview")
    data = response.json()
    return {
        "token": data["access_token"],
        "tenant_id": data.get("active_tenant", {}).get("tenant_id") or (data.get("tenants") or [{}])[0].get("tenant_id"),
    }


def test_bulk_requires_auth():
    response = requests.get(f"{BASE_URL}/api/platform/bulk-tracker-setup", timeout=30)
    assert response.status_code in (401, 403)


def test_superadmin_can_access_bulk_list_and_template(super_token):
    headers = {"Authorization": f"Bearer {super_token}"}
    index = requests.get(f"{BASE_URL}/api/platform/bulk-tracker-setup", headers=headers, timeout=30)
    template = requests.get(f"{BASE_URL}/api/platform/bulk-tracker-setup/template", headers=headers, timeout=30)
    assert index.status_code == 200
    assert "configured" in index.json() and "batches" in index.json()
    assert template.status_code == 200
    assert "registration,tracker_id,sim_iccid,sim_msisdn,tracker_model" in template.text


def test_victim_admin_denied_all_bulk_endpoints(victim_session):
    headers = {"Authorization": f"Bearer {victim_session['token']}"}
    fake_batch = "deadbeefdeadbeefdeadbeefdeadbeef"
    fake_row = "0"

    endpoints = [
        ("GET", "/api/platform/bulk-tracker-setup", None),
        ("GET", "/api/platform/bulk-tracker-setup/template", None),
        ("GET", f"/api/platform/bulk-tracker-setup/batches/{fake_batch}", None),
        ("POST", f"/api/platform/bulk-tracker-setup/batches/{fake_batch}/activate", None),
        ("POST", f"/api/platform/bulk-tracker-setup/batches/{fake_batch}/rows/{fake_row}/retry", None),
    ]

    for method, path, body in endpoints:
        resp = requests.request(method, f"{BASE_URL}{path}", headers=headers, json=body, timeout=30)
        assert resp.status_code == 403, f"Expected 403 for {path}, got {resp.status_code}"

    files = {"file": ("test.csv", "registration,tracker_id,sim_iccid,sim_msisdn,tracker_model\n12-KY-999,1234567890,123456789012345678,353871111111,QW\n", "text/csv")}
    data = {"tenant_id": victim_session["tenant_id"]}
    review = requests.post(f"{BASE_URL}/api/platform/bulk-tracker-setup/review", headers=headers, files=files, data=data, timeout=30)
    assert review.status_code == 403


def test_crafted_x_tenant_header_cannot_escape(victim_session, super_token):
    victim_headers = {"Authorization": f"Bearer {victim_session['token']}"}
    super_headers = {"Authorization": f"Bearer {super_token}"}

    tenants = requests.get(f"{BASE_URL}/api/platform/tenants", headers=super_headers, timeout=30)
    assert tenants.status_code == 200
    other = next((t for t in tenants.json().get("tenants", []) if t.get("id") != victim_session["tenant_id"]), None)
    if not other:
        pytest.skip("No second tenant available for X-Tenant-ID isolation check")

    escaped_headers = {**victim_headers, "X-Tenant-ID": other["id"]}
    normal_vehicles = requests.get(f"{BASE_URL}/api/vehicles", headers=victim_headers, timeout=30)
    escaped_vehicles = requests.get(f"{BASE_URL}/api/vehicles", headers=escaped_headers, timeout=30)
    normal_trackers = requests.get(f"{BASE_URL}/api/tracker/devices", headers=victim_headers, timeout=30)
    escaped_trackers = requests.get(f"{BASE_URL}/api/tracker/devices", headers=escaped_headers, timeout=30)

    assert normal_vehicles.status_code == 200
    assert escaped_vehicles.status_code == 200
    assert normal_trackers.status_code == 200
    assert escaped_trackers.status_code == 200

    normal_vehicle_ids = {row.get("id") for row in normal_vehicles.json()}
    escaped_vehicle_ids = {row.get("id") for row in escaped_vehicles.json()}
    assert escaped_vehicle_ids == normal_vehicle_ids

    normal_tracker_ids = {row.get("id") for row in normal_trackers.json()}
    escaped_tracker_ids = {row.get("id") for row in escaped_trackers.json()}
    assert escaped_tracker_ids == normal_tracker_ids
