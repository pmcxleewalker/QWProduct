"""End-to-end tests for 3-tier per-vehicle subscription redesign (iteration 55).

Covers:
  * Public catalogue API
  * Public contact form plan_interest / fuel_card_interest validation
  * Legacy tenant protection (my-plan capabilities=null, no auto-migration)
  * Tenant subscription workflow (create -> review -> accept -> apply) and 409 on duplicate
  * Professional plan activation blocked
  * Legacy super-admin plan endpoint blocked when on per_vehicle_v1 / has active_agreement
  * Operational report exports CSV/PDF with plan gating + date window + empty data
"""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-media-hub-77.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TENANT_SLUG = "test-fleet"
TENANT_EMAIL = "victim.admin@example.com"
TENANT_PASS = "Admin123"
SUPER_EMAIL = "superadmin@quickwing.com"
SUPER_PASS = "Super123"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def tenant_token(session):
    r = session.post(f"{API}/auth/login", json={
        "email": TENANT_EMAIL, "password": TENANT_PASS, "tenant_slug": TENANT_SLUG})
    assert r.status_code == 200, r.text
    data = r.json()
    tenant_id = (data.get("active_tenant") or {}).get("tenant_id") or data["tenants"][0]["tenant_id"]
    return data["access_token"], tenant_id


@pytest.fixture(scope="module")
def super_token(session):
    r = session.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def th(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Public catalogue ----------
class TestPublicCatalog:
    def test_catalog_shape_and_prices(self, session):
        r = session.get(f"{API}/public/subscription-catalog")
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "per_vehicle_v1"
        assert data["currency"] == "EUR"
        assert data["billing_basis"] == "per_vehicle_month"
        plans = {p["id"]: p for p in data["plans"]}
        assert plans["standard"]["unit_price_cents"] == 650
        assert plans["essential"]["unit_price_cents"] == 850
        assert plans["professional"]["unit_price_cents"] == 1250
        assert plans["standard"]["status"] == "available"
        assert plans["essential"]["status"] == "available"
        assert plans["essential"].get("recommended") is True
        assert plans["professional"]["status"] == "coming_soon"
        assert isinstance(data["comparison"], list) and len(data["comparison"]) >= 10
        # comparison matrix shape
        row = data["comparison"][0]
        assert set(row.keys()) >= {"id", "label", "group", "included"}
        assert set(row["included"].keys()) == {"standard", "essential", "professional"}


# ---------- Public contact form ----------
class TestPublicContact:
    base_payload = lambda self: {
        "name": "QA Lead", "email": f"qa+{uuid.uuid4().hex[:8]}@example.com",
        "company": "QA Co", "message": "QA test entry — safe to delete"}

    def test_contact_valid_essential_with_fuelcard(self, session):
        p = self.base_payload(); p.update(plan_interest="essential", fuel_card_interest=True)
        r = session.post(f"{API}/public/contact", json=p)
        assert r.status_code in (200, 201), r.text

    def test_contact_valid_standard(self, session):
        p = self.base_payload(); p.update(plan_interest="standard", fuel_card_interest=False)
        r = session.post(f"{API}/public/contact", json=p)
        assert r.status_code in (200, 201), r.text

    def test_contact_rejects_fuelcard_on_standard(self, session):
        p = self.base_payload(); p.update(plan_interest="standard", fuel_card_interest=True)
        r = session.post(f"{API}/public/contact", json=p)
        assert r.status_code == 400, r.text

    def test_contact_rejects_fuelcard_no_plan(self, session):
        p = self.base_payload(); p.update(fuel_card_interest=True)
        r = session.post(f"{API}/public/contact", json=p)
        assert r.status_code == 400


# ---------- Legacy tenant protection ----------
class TestLegacyTenant:
    def test_my_plan_capabilities_null(self, session, tenant_token):
        token, _ = tenant_token
        r = session.get(f"{API}/my-plan", headers=th(token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("pricing_version") == "legacy"
        assert d.get("capabilities") is None
        # Legacy features retained
        assert d["features"].get("vehicle_booking") is True

    def test_legacy_super_admin_plan_blocked_only_when_on_v1(self, session, tenant_token, super_token):
        # test-fleet currently legacy. Change to 'standard' legacy should work OR return non-409.
        _, tenant_id = tenant_token
        r = session.put(f"{API}/platform/tenants/{tenant_id}/plan?new_plan=standard", headers=th(super_token))
        # Must NOT be a 409 for a legacy tenant with no active agreement+catalogue
        # (It can be 200 or something else; main assertion is that 409 appears for v1 tenants.)
        assert r.status_code != 409 or "workflow" not in r.text.lower(), r.text


# ---------- Tenant subscription workflow ----------
class TestSubscriptionWorkflow:
    def test_view_subscription(self, session, tenant_token):
        token, _ = tenant_token
        r = session.get(f"{API}/tenant/subscription", headers=th(token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "revision" in d
        assert "legacy" in d
        # No _id leak
        assert "_id" not in d

    def test_professional_rejected(self, session, tenant_token):
        token, _ = tenant_token
        view = session.get(f"{API}/tenant/subscription", headers=th(token)).json()
        rev = view["revision"]
        body = {"revision": rev, "idempotency_key": uuid.uuid4().hex,
                "plan": "professional", "effective_date": date.today().isoformat(),
                "reason": "QA professional block", "acknowledged": True}
        r = session.post(f"{API}/tenant/subscription/requests", json=body, headers=th(token))
        assert r.status_code == 409, r.text
        assert "coming soon" in r.text.lower() or "cannot be activated" in r.text.lower()

    def test_acknowledgement_required(self, session, tenant_token):
        token, _ = tenant_token
        view = session.get(f"{API}/tenant/subscription", headers=th(token)).json()
        body = {"revision": view["revision"], "idempotency_key": uuid.uuid4().hex,
                "plan": "essential", "effective_date": date.today().isoformat(),
                "reason": "no ack", "acknowledged": False}
        r = session.post(f"{API}/tenant/subscription/requests", json=body, headers=th(token))
        assert r.status_code == 400

    def test_full_lifecycle_and_duplicate_block(self, session, tenant_token, super_token):
        token, tenant_id = tenant_token
        # Clean up any open requests first by cancelling
        view = session.get(f"{API}/tenant/subscription", headers=th(token)).json()
        for req in view.get("requests", []):
            if req["status"] in {"requested", "quoted", "accepted"}:
                rev = session.get(f"{API}/tenant/subscription", headers=th(token)).json()["revision"]
                session.post(f"{API}/tenant/subscription/requests/{req['id']}/cancel",
                             json={"revision": rev, "idempotency_key": uuid.uuid4().hex},
                             headers=th(token))

        view = session.get(f"{API}/tenant/subscription", headers=th(token)).json()
        rev = view["revision"]
        body = {"revision": rev, "idempotency_key": uuid.uuid4().hex,
                "plan": "essential", "effective_date": date.today().isoformat(),
                "reason": "QA e2e lifecycle", "acknowledged": True}
        r = session.post(f"{API}/tenant/subscription/requests", json=body, headers=th(token))
        assert r.status_code == 200, r.text
        after_create = r.json()
        request_id = after_create["requests"][-1]["id"]
        rev = after_create["revision"]

        # Duplicate open request -> 409
        body2 = {"revision": rev, "idempotency_key": uuid.uuid4().hex,
                 "plan": "essential", "effective_date": date.today().isoformat(),
                 "reason": "second", "acknowledged": True}
        r2 = session.post(f"{API}/tenant/subscription/requests", json=body2, headers=th(token))
        assert r2.status_code == 409, r2.text

        # Super admin review (quote)
        review = {"revision": rev, "idempotency_key": uuid.uuid4().hex,
                  "decision": "quote", "notes": "QA quote",
                  "effective_date": date.today().isoformat(),
                  "vehicle_quantity": 5, "tax_treatment": "exclusive",
                  "hardware_terms": "Supplied + fitted by QW partner"}
        r = session.post(f"{API}/platform/subscriptions/{tenant_id}/requests/{request_id}/review",
                         json=review, headers=th(super_token))
        assert r.status_code == 200, r.text
        rev = r.json()["revision"]

        # Tenant accept
        accept = {"revision": rev, "idempotency_key": uuid.uuid4().hex, "accepted": True}
        r = session.post(f"{API}/tenant/subscription/requests/{request_id}/accept",
                         json=accept, headers=th(token))
        assert r.status_code == 200, r.text
        rev = r.json()["revision"]

        # Super admin apply (effective date = today)
        apply_body = {"revision": rev, "idempotency_key": uuid.uuid4().hex, "confirmed": True}
        r = session.post(f"{API}/platform/subscriptions/{tenant_id}/requests/{request_id}/apply",
                         json=apply_body, headers=th(super_token))
        assert r.status_code == 200, r.text
        applied = r.json()
        assert applied["active_agreement"]["plan"] == "essential"
        assert applied["active_agreement"]["pricing_version"] == "per_vehicle_v1"
        assert applied["billing_unchanged"] is True

        # my-plan reflects new agreement
        mp = session.get(f"{API}/my-plan", headers=th(token)).json()
        assert mp["pricing_version"] == "per_vehicle_v1"
        assert mp["capabilities"] is not None and "gps" in mp["capabilities"]

    def test_platform_subscriptions_index(self, session, super_token):
        r = session.get(f"{API}/platform/subscriptions", headers=th(super_token))
        assert r.status_code == 200
        assert "items" in r.json()

    def test_legacy_plan_endpoint_blocked_after_v1(self, session, tenant_token, super_token):
        _, tenant_id = tenant_token
        # test-fleet now has an active_agreement from previous test -> should 409
        r = session.put(f"{API}/platform/tenants/{tenant_id}/plan?new_plan=standard",
                        headers=th(super_token))
        assert r.status_code == 409, r.text
        assert "workflow" in r.text.lower()


# ---------- Operational report exports ----------
class TestExports:
    def test_bookings_csv_ok(self, session, tenant_token):
        token, _ = tenant_token
        start = (date.today() - timedelta(days=7)).isoformat()
        end = date.today().isoformat()
        r = session.get(f"{API}/tenant/subscription/reports/bookings/csv?start={start}&end={end}",
                        headers=th(token))
        # Tenant now on essential (lifecycle applied) -> 200 if data, 404 if empty
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            assert "text/csv" in r.headers.get("content-type", "")

    def test_window_too_large(self, session, tenant_token):
        token, _ = tenant_token
        start = (date.today() - timedelta(days=40)).isoformat()
        end = date.today().isoformat()
        r = session.get(f"{API}/tenant/subscription/reports/bookings/csv?start={start}&end={end}",
                        headers=th(token))
        assert r.status_code == 400, r.text

    def test_pdf_compliance(self, session, tenant_token):
        token, _ = tenant_token
        start = (date.today() - timedelta(days=1)).isoformat()
        end = date.today().isoformat()
        r = session.get(f"{API}/tenant/subscription/reports/compliance/pdf?start={start}&end={end}",
                        headers=th(token))
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            assert "application/pdf" in r.headers.get("content-type", "")

    def test_unknown_kind_404(self, session, tenant_token):
        token, _ = tenant_token
        start = date.today().isoformat(); end = date.today().isoformat()
        r = session.get(f"{API}/tenant/subscription/reports/garbage/csv?start={start}&end={end}",
                        headers=th(token))
        assert r.status_code == 404


# ---------- GPS gating via middleware ----------
class TestGpsGating:
    def test_tracker_endpoint_accessible_legacy_or_essential(self, session, tenant_token):
        """Legacy tenants (caps=null) and essential tenants both have gps capability.
        Tenant is now essential after lifecycle test; the route should not be plan-blocked."""
        token, _ = tenant_token
        r = session.get(f"{API}/tracker/devices", headers=th(token))
        # 200/404 acceptable; 403 would signal plan gating failure
        assert r.status_code != 403, r.text
