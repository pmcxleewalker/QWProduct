"""Smoke tests for the perf quick-wins added in Feb 2026:

  • Date-window filter on GET /api/bookings (`?from=&to=`)
  • TTL cache + invalidation on /api/tenant/settings, /api/vehicles, /api/locations

These are intentionally fast and run against the local backend.

Usage:
    cd /app/backend && python -m pytest tests/test_cache_and_filters.py -v
"""
from __future__ import annotations

import os
import time

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
    """Login as test-fleet admin and select tenant. Returns (token, tenant_id)."""
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    r.raise_for_status()
    payload = r.json()
    token = payload["access_token"]
    tenant_id = payload["tenants"][0]["tenant_id"]
    requests.post(
        f"{API}/auth/select-tenant/{tenant_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    return token, tenant_id


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


def test_tenant_settings_cache_hit(auth):
    """Second read should return identical body (cached)."""
    token, _ = auth
    r1 = requests.get(f"{API}/tenant/settings", headers=_hdr(token), timeout=10)
    r2 = requests.get(f"{API}/tenant/settings", headers=_hdr(token), timeout=10)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json() == r2.json()


def test_tenant_settings_cache_invalidated_on_put(auth):
    """PUT /tenant/settings/compliance should bust the cache so next GET sees new value."""
    token, _ = auth
    # Read once to populate cache
    requests.get(f"{API}/tenant/settings", headers=_hdr(token), timeout=10)
    # Mutate
    requests.put(
        f"{API}/tenant/settings/compliance",
        headers=_hdr(token),
        json={"tax_warning_days": 45},
        timeout=10,
    )
    after = requests.get(f"{API}/tenant/settings", headers=_hdr(token), timeout=10).json()
    assert after["compliance"]["tax_warning_days"] == 45
    # Restore
    requests.put(
        f"{API}/tenant/settings/compliance",
        headers=_hdr(token),
        json={"tax_warning_days": 60},
        timeout=10,
    )
    restored = requests.get(f"{API}/tenant/settings", headers=_hdr(token), timeout=10).json()
    assert restored["compliance"]["tax_warning_days"] == 60


def test_vehicles_cache_response_stable(auth):
    """Two consecutive GETs should return identical payloads."""
    token, _ = auth
    a = requests.get(f"{API}/vehicles", headers=_hdr(token), timeout=10).json()
    b = requests.get(f"{API}/vehicles", headers=_hdr(token), timeout=10).json()
    assert a == b


def test_locations_cache_response_stable(auth):
    token, _ = auth
    a = requests.get(f"{API}/locations", headers=_hdr(token), timeout=10).json()
    b = requests.get(f"{API}/locations", headers=_hdr(token), timeout=10).json()
    assert a == b


def test_bookings_date_window_filter(auth):
    """`?from=` and `?to=` overlap filter narrows the result set."""
    token, _ = auth
    full = requests.get(f"{API}/bookings?limit=2000", headers=_hdr(token), timeout=10).json()
    future = requests.get(
        f"{API}/bookings?from=2030-01-01&limit=2000",
        headers=_hdr(token),
        timeout=10,
    ).json()
    # Future-only window must be a subset of the full list
    assert len(future) <= len(full)
    # And must not include anything starting before 2030
    for b in future:
        end = b.get("end_time", "")
        assert end > "2030-01-01"


def test_bookings_aliased_query_params_dont_collide(auth):
    """from/to are reserved Python keywords; ensure FastAPI alias mapping works."""
    token, _ = auth
    r = requests.get(
        f"{API}/bookings?from=2026-06-01&to=2026-07-01&limit=2000",
        headers=_hdr(token),
        timeout=10,
    )
    assert r.status_code == 200
    for b in r.json():
        assert b["end_time"] > "2026-06-01"
        assert b["start_time"] < "2026-07-01"
