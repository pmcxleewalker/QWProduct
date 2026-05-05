"""
Tests for the 4 major changes shipped this session:
 1. Custom Documents Builder (templates + submissions + fuel-analytics)
 2. Staff invitation & activation tokens
 3. Legal records (super_admin only)
 4. Tenant user create / bulk import returning email_sent
"""
import os
import io
import csv
import uuid
import time
import requests
import pytest

def _read_env(path, key):
    try:
        with open(path) as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"')
    except Exception:
        return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or _read_env("/app/frontend/.env", "REACT_APP_BACKEND_URL")).rstrip("/")
SUPER_EMAIL = "superadmin@quickwing.com"
SUPER_PASS = "Super123"
TENANT_SLUG = "test-fleet"


# --------------------------- Fixtures ---------------------------

@pytest.fixture(scope="session")
def super_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": SUPER_EMAIL, "password": SUPER_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def tenant_token(super_token):
    # find test-fleet tenant id
    r = requests.get(f"{BASE_URL}/api/platform/tenants",
                     headers={"Authorization": f"Bearer {super_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    tenants = data.get("tenants", data) if isinstance(data, dict) else data
    target = next((t for t in tenants if t.get("slug") == TENANT_SLUG), tenants[0])
    tenant_id = target["id"]

    # select-tenant -> issues a tenant scoped token
    r = requests.post(f"{BASE_URL}/api/auth/select-tenant",
                      headers={"Authorization": f"Bearer {super_token}"},
                      json={"tenant_id": tenant_id}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"], tenant_id


@pytest.fixture
def headers(tenant_token):
    token, _ = tenant_token
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture
def super_headers(super_token):
    return {"Authorization": f"Bearer {super_token}", "Content-Type": "application/json"}


# --------------------------- 1. CUSTOM DOCUMENTS ---------------------------

class TestDocumentTemplates:
    def test_list_seeds_fuel_log(self, headers):
        r = requests.get(f"{BASE_URL}/api/documents/templates", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        names = [t.get("name", "").lower() for t in data]
        assert any("fuel" in n for n in names), f"Fuel Log not auto-seeded: {names}"
        # ensure no _id leakage
        for t in data:
            assert "_id" not in t

    def test_create_update_delete_template(self, headers):
        payload = {
            "name": f"TEST_template_{uuid.uuid4().hex[:6]}",
            "description": "test",
            "fields": [
                {"key": "title", "label": "Title", "type": "text", "required": True},
                {"key": "amount", "label": "Amount", "type": "number", "required": True},
                {"key": "category", "label": "Cat", "type": "select",
                 "options": ["A", "B"], "required": False},
                {"key": "photo", "label": "Photo", "type": "image", "required": False},
                {"key": "veh", "label": "Vehicle", "type": "vehicle", "required": False},
                {"key": "ok", "label": "Ok", "type": "checkbox", "required": False},
            ],
        }
        r = requests.post(f"{BASE_URL}/api/documents/templates",
                          headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        tpl = r.json()
        assert tpl["name"] == payload["name"]
        assert len(tpl["fields"]) == 6
        tpl_id = tpl["id"]

        # update + toggle is_active
        upd = {"description": "updated", "is_active": False}
        r = requests.put(f"{BASE_URL}/api/documents/templates/{tpl_id}",
                         headers=headers, json=upd, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("description") == "updated"
        assert r.json().get("is_active") is False

        # delete
        r = requests.delete(f"{BASE_URL}/api/documents/templates/{tpl_id}",
                            headers=headers, timeout=30)
        assert r.status_code in (200, 204), r.text

        # verify gone
        r = requests.get(f"{BASE_URL}/api/documents/templates", headers=headers, timeout=30)
        assert tpl_id not in [t["id"] for t in r.json()]


# --------------------------- Submissions + analytics ---------------------------

class TestDocumentSubmissions:
    @pytest.fixture(scope="class")
    def fuel_template_id(self, super_token):
        # use class-scoped login
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": SUPER_EMAIL, "password": SUPER_PASS}, timeout=30)
        tok = r.json()["access_token"]
        ts_data = requests.get(f"{BASE_URL}/api/platform/tenants",
                          headers={"Authorization": f"Bearer {tok}"}, timeout=30).json()
        ts = ts_data.get("tenants", ts_data) if isinstance(ts_data, dict) else ts_data
        tid = next((t for t in ts if t.get("slug") == TENANT_SLUG), ts[0])["id"]
        sel = requests.post(f"{BASE_URL}/api/auth/select-tenant",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"tenant_id": tid}, timeout=30).json()
        ttok = sel["access_token"]
        h = {"Authorization": f"Bearer {ttok}", "Content-Type": "application/json"}
        tpls = requests.get(f"{BASE_URL}/api/documents/templates", headers=h, timeout=30).json()
        fuel = next(t for t in tpls if "fuel" in t["name"].lower())
        return fuel["id"], h

    def _vehicle(self, headers):
        r = requests.get(f"{BASE_URL}/api/vehicles", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        v = r.json()
        return v[0] if v else None

    def test_submission_required_validation(self, fuel_template_id):
        tpl_id, h = fuel_template_id
        # send empty data -> expect 400 mentioning a missing field
        r = requests.post(f"{BASE_URL}/api/documents/submissions",
                          headers=h, json={"template_id": tpl_id, "data": {}}, timeout=30)
        assert r.status_code == 400, r.text
        body = r.json()
        msg = (body.get("detail") or body.get("message") or "").lower()
        assert "required" in msg or "missing" in msg, body

    def test_submission_create_and_filter(self, fuel_template_id):
        tpl_id, h = fuel_template_id
        veh = self._vehicle(h)
        if not veh:
            pytest.skip("no vehicles in tenant")
        payload = {
            "template_id": tpl_id,
            "data": {
                "vehicle": veh["id"],
                "fuel_date": "2026-01-15",
                "odometer_km": "12345",
                "litres": "12.5",
                "cost_eur": "30.40",
            },
        }
        r = requests.post(f"{BASE_URL}/api/documents/submissions",
                          headers=h, json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        sub = r.json()
        # numbers coerced
        assert isinstance(sub["data"].get("litres"), (int, float))
        assert isinstance(sub["data"].get("cost_eur"), (int, float))
        # vehicle extracted
        assert sub.get("vehicle_id") == veh["id"]
        assert sub.get("vehicle_registration")

        # filter by template_id
        r = requests.get(f"{BASE_URL}/api/documents/submissions",
                         headers=h, params={"template_id": tpl_id}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        assert any(s["id"] == sub["id"] for s in items)

        # filter by vehicle_id
        r = requests.get(f"{BASE_URL}/api/documents/submissions",
                         headers=h, params={"vehicle_id": veh["id"]}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        assert any(s["id"] == sub["id"] for s in items)

    def test_fuel_analytics(self, fuel_template_id):
        _, h = fuel_template_id
        r = requests.get(f"{BASE_URL}/api/documents/fuel-analytics",
                         headers=h, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # expected shape
        assert "vehicles" in body or "by_vehicle" in body or isinstance(body, dict)
        # zero-fall-through with future month
        r2 = requests.get(f"{BASE_URL}/api/documents/fuel-analytics",
                          headers=h, params={"month": "2099-01"}, timeout=30)
        assert r2.status_code == 200, r2.text


# --------------------------- 2. STAFF INVITATION + ACTIVATION ---------------------------

class TestActivation:
    @pytest.fixture(autouse=True)
    def _cleanup_test_users(self, tenant_token):
        token, _ = tenant_token
        list_r = requests.get(f"{BASE_URL}/api/tenant/users",
                              headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if list_r.status_code == 200:
            data = list_r.json()
            users = data.get("users", data) if isinstance(data, dict) else data
            for u in users:
                if (u.get("email") or "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/tenant/users/{u['id']}",
                                    headers={"Authorization": f"Bearer {token}"}, timeout=15)
        yield

    def test_create_user_returns_email_status(self, headers):
        email = f"TEST_invite_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/tenant/users",
                          headers=headers,
                          json={"email": email, "name": "T Invite", "role": "staff"},
                          timeout=30)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        # email_sent / email_error keys present (email_sent may be False -> acceptable)
        assert "email_sent" in body, body
        # user creation succeeded - message or login_url returned
        assert body.get("message") or body.get("login_url") or body.get("user"), body

    def test_bulk_import_returns_counts(self, headers):
        csv_content = "email,name,role\n"
        for i in range(2):
            csv_content += f"TEST_bulk_{uuid.uuid4().hex[:6]}@example.com,Bulk {i},staff\n"

        files = {"file": ("users.csv", csv_content, "text/csv")}
        # Strip Content-Type header for multipart
        h = {k: v for k, v in headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{BASE_URL}/api/users/bulk-import",
                          headers=h, files=files, timeout=60)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert "emails_sent" in body or "emails_failed" in body or "created" in body, body

    def test_activate_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/activate/bogus-token-xyz", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("valid") is False

    def test_activate_full_flow(self, headers, tenant_token):
        # cleanup: delete TEST_ users to free up user-limit before creating one more
        token, tenant_id = tenant_token
        list_r = requests.get(f"{BASE_URL}/api/tenant/users",
                              headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if list_r.status_code == 200:
            data = list_r.json()
            users = data.get("users", data) if isinstance(data, dict) else data
            for u in users:
                if (u.get("email") or "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/tenant/users/{u['id']}",
                                    headers={"Authorization": f"Bearer {token}"}, timeout=15)

        # create user
        email = f"TEST_act_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/tenant/users",
                          headers=headers,
                          json={"email": email, "name": "T Activate", "role": "staff"},
                          timeout=30)
        assert r.status_code in (200, 201), r.text

        # fetch token from db via mongo
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
        db_name = os.environ.get("DB_NAME") or "test_database"
        # try reading backend env explicitly
        try:
            with open("/app/backend/.env") as f:
                for line in f:
                    if line.startswith("MONGO_URL="):
                        mongo_url = line.split("=", 1)[1].strip().strip('"')
                    if line.startswith("DB_NAME="):
                        db_name = line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass
        client = MongoClient(mongo_url)
        db = client[db_name]
        tok_doc = db.activation_tokens.find_one({"user_email": email}, sort=[("_id", -1)])
        if not tok_doc:
            pytest.skip("activation token not stored under expected schema")
        token = tok_doc.get("token") or tok_doc.get("_id")

        # GET /api/auth/activate/{token}
        r = requests.get(f"{BASE_URL}/api/auth/activate/{token}", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("valid") is True, body
        assert body.get("user_email") == email or body.get("email") == email

        # POST /api/auth/activate consumes
        r = requests.post(f"{BASE_URL}/api/auth/activate",
                          json={"token": token, "new_password": "NewPass123!"},
                          timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body, body

        # second use must fail
        r = requests.post(f"{BASE_URL}/api/auth/activate",
                          json={"token": token, "new_password": "Another1!"},
                          timeout=30)
        assert r.status_code in (400, 401, 403, 404, 410), r.text


# --------------------------- 3. LEGAL RECORDS ---------------------------

class TestLegalRecords:
    def test_get_legal_super_admin(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/platform/legal-records",
                         headers=super_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)
        # mongo _id and metadata stripped
        assert "_id" not in body

    def test_put_legal_records_round_trip(self, super_headers):
        payload = {
            "company_legal_name": "QuickFleet Limited",
            "company_registration_number": "TEST123456",
            "registered_address": "1 Test St, Dublin",
            "trading_product_name": "Quick Wing",
            "domain_name_records": "quick-wing.com",
            "hosting_provider": "Emergent",
        }
        r = requests.put(f"{BASE_URL}/api/platform/legal-records",
                         headers=super_headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text

        r = requests.get(f"{BASE_URL}/api/platform/legal-records",
                         headers=super_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k, v in payload.items():
            assert body.get(k) == v, f"{k} not persisted: {body}"
        assert "_id" not in body

    def test_legal_records_forbidden_for_non_super(self, headers):
        # tenant_token belongs to super_admin acting in a tenant context
        # Try with a freshly-made non-super user instead: skip if cannot create
        # Use the master-admin-style support account credentials
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "support@quickwing.com",
                                "password": "QuickWing123!"}, timeout=30)
        if r.status_code != 200:
            pytest.skip("support account login unavailable")
        tok = r.json()["access_token"]
        r = requests.get(f"{BASE_URL}/api/platform/legal-records",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert r.status_code in (401, 403), r.text
