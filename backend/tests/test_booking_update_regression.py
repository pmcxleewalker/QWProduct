"""Regression tests for the PUT /api/bookings/{id} bug discovered Feb 2026.

A client reported "Failed to update booking" on production when editing a
booking via the EditBookingModal. Root cause was a chain of three problems:

  1. Frontend called `bookingAPI.edit(...)` which was undefined — the real
     method is `bookingAPI.update(...)`. The TypeError landed in the catch
     block with no `err.response`, so the modal showed the generic
     "Failed to update booking" fallback instead of any real reason.

  2. `BookingUpdate` Pydantic model was missing `car_id`, so the "Swap Car"
     flow silently succeeded (HTTP 200) without actually swapping the car.

  3. `BookingUpdate` was missing `notes`, and the frontend was using a
     `destination_notes` field that doesn't exist anywhere. Notes typed
     into the modal were silently discarded.

These tests guard against the regression by exercising PUT /api/bookings/{id}
with all four editable fields and confirming each one persists.
"""
from __future__ import annotations

import os

import pytest
import requests

API_URL = (
    os.environ.get("BACKEND_URL")
    or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
)
API = f"{API_URL.rstrip('/')}/api"

ADMIN_EMAIL = "admin.test-fleet@quickwing.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth():
    """Login + select tenant. Returns the tenant-scoped token."""
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    r.raise_for_status()
    payload = r.json()
    token = payload["access_token"]
    tenant_id = payload["tenants"][0]["tenant_id"]
    sel = requests.post(
        f"{API}/auth/select-tenant",
        headers={"Authorization": f"Bearer {token}"},
        json={"tenant_id": tenant_id},
        timeout=10,
    )
    sel.raise_for_status()
    return sel.json()["access_token"], tenant_id


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


def _get_or_create_booking(token):
    """Find or create a test booking and return its document."""
    bookings = requests.get(f"{API}/bookings?limit=5", headers=_hdr(token), timeout=10).json()
    if bookings:
        return bookings[0]
    # Create one — find a vehicle first
    vehicles = requests.get(f"{API}/vehicles", headers=_hdr(token), timeout=10).json()
    assert vehicles, "Need at least one vehicle in test-fleet to run this test"
    payload = {
        "car_id": vehicles[0]["id"],
        "user_name": "Test User",
        "start_time": "2030-01-01T10:00:00.000Z",
        "end_time": "2030-01-01T12:00:00.000Z",
        "purpose": "regression test",
    }
    r = requests.post(f"{API}/bookings", headers=_hdr(token), json=payload, timeout=10)
    r.raise_for_status()
    body = r.json()
    return body.get("booking", body)


def test_update_notes_persists(auth):
    """`notes` must round-trip through PUT — was being silently dropped."""
    token, _ = auth
    booking = _get_or_create_booking(token)
    new_notes = "regression check 2026-02"
    r = requests.put(
        f"{API}/bookings/{booking['id']}",
        headers=_hdr(token),
        json={"notes": new_notes},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("notes") == new_notes


def test_update_times_persists(auth):
    """Editing start/end time still works (the main user-facing flow)."""
    token, _ = auth
    booking = _get_or_create_booking(token)
    new_start = "2030-02-01T09:00:00.000Z"
    new_end = "2030-02-01T11:00:00.000Z"
    r = requests.put(
        f"{API}/bookings/{booking['id']}",
        headers=_hdr(token),
        json={"start_time": new_start, "end_time": new_end},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("start_time") == new_start
    assert body.get("end_time") == new_end


def test_update_car_id_persists(auth):
    """`car_id` must be accepted by BookingUpdate (was missing — Swap Car silently broken)."""
    token, _ = auth
    booking = _get_or_create_booking(token)
    vehicles = requests.get(f"{API}/vehicles", headers=_hdr(token), timeout=10).json()
    other = next((v for v in vehicles if v["id"] != booking["car_id"]), None)
    if not other:
        pytest.skip("Need at least 2 vehicles to test the Swap Car flow")
    # Move booking far in the future so there are no conflicts
    requests.put(
        f"{API}/bookings/{booking['id']}",
        headers=_hdr(token),
        json={"start_time": "2031-06-01T10:00:00.000Z", "end_time": "2031-06-01T12:00:00.000Z"},
        timeout=10,
    )
    r = requests.put(
        f"{API}/bookings/{booking['id']}",
        headers=_hdr(token),
        json={"car_id": other["id"]},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("car_id") == other["id"]
    # Put it back so other tests aren't surprised
    requests.put(
        f"{API}/bookings/{booking['id']}",
        headers=_hdr(token),
        json={"car_id": booking["car_id"]},
        timeout=10,
    )
