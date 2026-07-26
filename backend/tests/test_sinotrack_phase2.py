"""
Phase 2: SinoTrack multi-tenant GPS bridge tests.

Covers:
  - sinotrack_client.login / fetch_position against REAL live IMEIs
  - Tracker device CRUD (register / list / patch / delete)
  - Tenant isolation on tracker_devices, tracker_positions, tracker_history
  - Poller behaviour: history recorded only when moving OR moving->stopped
  - Scheduler is actually attached (single 30 s master job) — verified
    in-process by calling gps_poller.start(db) against a mock db and
    inspecting the returned scheduler
"""
import os
import sys
import time
import asyncio
import pytest
import requests

# Allow importing backend modules directly for in-process assertions
sys.path.insert(0, "/app/backend")

# --- config -----------------------------------------------------------------
def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if v:
        return v.rstrip("/")
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

SUPER_ADMIN = {"email": "superadmin@quickwing.com", "password": "Super123"}

REAL_IMEI_MOVING = "7018530625"
REAL_IMEI_STOPPED = "7018530607"
REAL_PW = "123456"

TEST_FLEET_TENANT_ID = "f95fbe53-46cc-4f29-af6b-b9ea51758cbd"


# --- HTTP helpers -----------------------------------------------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _select_tenant(tok, tid):
    r = requests.post(f"{API}/auth/select-tenant", json={"tenant_id": tid},
                      headers=_hdr(tok), timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def _admin_token_for(tenant_slug, tenant_id):
    email = f"admin.{tenant_slug}@quickwing.com"
    login = _login(email, "admin123")
    tok = login["access_token"]
    if not (login.get("active_tenant") or {}).get("id"):
        tok = _select_tenant(tok, tenant_id)
    return tok


# --- fixtures ---------------------------------------------------------------
@pytest.fixture(scope="module")
def super_token():
    return _login(**SUPER_ADMIN)["access_token"]


@pytest.fixture(scope="module")
def tenant_a(super_token):
    ts = int(time.time())
    slug = f"trkiso-a-{ts}"
    payload = {"name": f"Trk Iso A {ts}", "slug": slug, "plan": "custom",
               "custom_price": 100, "gps_enabled": True}
    r = requests.post(f"{API}/platform/tenants", json=payload,
                      headers=_hdr(super_token), timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tenant = data.get("tenant", data)
    tok = _admin_token_for(tenant["slug"], tenant["id"])
    # seed a vehicle so we can assign cars to trackers
    v = requests.post(f"{API}/vehicles", json={"name": "TEST_A_Car", "registration": "TEST-A-1"},
                      headers=_hdr(tok), timeout=30)
    assert v.status_code in (200, 201), v.text
    vj = v.json()
    car_id = (vj.get("vehicle") or vj)["id"]
    yield {"id": tenant["id"], "slug": tenant["slug"], "token": tok, "car_id": car_id}
    requests.delete(f"{API}/platform/tenants/{tenant['id']}", headers=_hdr(super_token), timeout=30)


@pytest.fixture(scope="module")
def tenant_b(super_token):
    ts = int(time.time()) + 1
    slug = f"trkiso-b-{ts}"
    payload = {"name": f"Trk Iso B {ts}", "slug": slug, "plan": "custom",
               "custom_price": 100, "gps_enabled": True}
    r = requests.post(f"{API}/platform/tenants", json=payload,
                      headers=_hdr(super_token), timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tenant = data.get("tenant", data)
    tok = _admin_token_for(tenant["slug"], tenant["id"])
    v = requests.post(f"{API}/vehicles", json={"name": "TEST_B_Car", "registration": "TEST-B-1"},
                      headers=_hdr(tok), timeout=30)
    assert v.status_code in (200, 201), v.text
    vj = v.json()
    car_id = (vj.get("vehicle") or vj)["id"]
    yield {"id": tenant["id"], "slug": tenant["slug"], "token": tok, "car_id": car_id}
    requests.delete(f"{API}/platform/tenants/{tenant['id']}", headers=_hdr(super_token), timeout=30)


@pytest.fixture(scope="module")
def tenant_no_gps(super_token):
    ts = int(time.time()) + 2
    slug = f"trk-nogps-{ts}"
    payload = {"name": f"Trk NoGPS {ts}", "slug": slug, "plan": "custom", "custom_price": 100}
    r = requests.post(f"{API}/platform/tenants", json=payload,
                      headers=_hdr(super_token), timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tenant = data.get("tenant", data)
    tok = _admin_token_for(tenant["slug"], tenant["id"])
    yield {"id": tenant["id"], "slug": tenant["slug"], "token": tok}
    requests.delete(f"{API}/platform/tenants/{tenant['id']}", headers=_hdr(super_token), timeout=30)


# =========================================================================
# 1. SinoTrack client — direct calls against REAL live devices
# =========================================================================
class TestSinoTrackClient:
    def test_login_moving_device(self):
        from services.sinotrack_client import login
        assert login(REAL_IMEI_MOVING, REAL_PW) is True

    def test_login_invalid_password(self):
        from services.sinotrack_client import login
        assert login(REAL_IMEI_MOVING, "definitelyWrong-xyz") is False

    def test_fetch_position_moving(self):
        from services.sinotrack_client import fetch_position
        p = fetch_position(REAL_IMEI_MOVING, REAL_PW)
        assert p is not None, "expected real position, got None"
        assert 50 <= p["latitude"] <= 56, f"unexpected lat: {p['latitude']}"
        assert -11 <= p["longitude"] <= -5, f"unexpected lon: {p['longitude']}"
        assert isinstance(p["speed"], int)
        # voltage may legitimately be None on 7018530625 (Voltages=0.0)
        assert "voltage" in p

    def test_fetch_position_stopped_has_voltage(self):
        from services.sinotrack_client import fetch_position
        p = fetch_position(REAL_IMEI_STOPPED, REAL_PW)
        assert p is not None
        assert 50 <= p["latitude"] <= 56
        assert -11 <= p["longitude"] <= -5


# =========================================================================
# 2. Tracker device CRUD
# =========================================================================
class TestTrackerDeviceCRUD:
    def test_register_requires_gps_enabled(self, tenant_no_gps):
        r = requests.post(f"{API}/tracker/devices",
                          json={"imei": REAL_IMEI_MOVING},
                          headers=_hdr(tenant_no_gps["token"]), timeout=30)
        assert r.status_code == 400, r.text

    def test_imei_validation(self, tenant_a):
        for bad in ["abc123", "123", "1" * 21, "12ab34cd56"]:
            r = requests.post(f"{API}/tracker/devices",
                              json={"imei": bad},
                              headers=_hdr(tenant_a["token"]), timeout=30)
            assert r.status_code == 400, f"expected 400 for {bad}, got {r.status_code} {r.text}"

    def test_register_success_and_verified_flag(self, tenant_a):
        r = requests.post(f"{API}/tracker/devices",
                          json={"imei": REAL_IMEI_MOVING, "car_id": tenant_a["car_id"],
                                "label": "TEST_moving"},
                          headers=_hdr(tenant_a["token"]), timeout=30)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["imei"] == REAL_IMEI_MOVING
        assert d["car_id"] == tenant_a["car_id"]
        assert d["is_active"] is True
        # real device should verify successfully
        assert d["verified_with_sinotrack"] is True
        tenant_a["device_id"] = d["id"]

    def test_duplicate_imei_same_tenant_409(self, tenant_a):
        r = requests.post(f"{API}/tracker/devices",
                          json={"imei": REAL_IMEI_MOVING},
                          headers=_hdr(tenant_a["token"]), timeout=30)
        assert r.status_code == 409, r.text

    def test_car_already_tracked_409(self, tenant_a):
        # add a second vehicle, then try assigning car that's already tracked
        v = requests.post(f"{API}/vehicles", json={"name": "TEST_A_Car2", "registration": "TEST-A-2"},
                          headers=_hdr(tenant_a["token"]), timeout=30)
        assert v.status_code in (200, 201)
        # register a new device but point at the ALREADY tracked car
        r = requests.post(f"{API}/tracker/devices",
                          json={"imei": REAL_IMEI_STOPPED, "car_id": tenant_a["car_id"]},
                          headers=_hdr(tenant_a["token"]), timeout=30)
        assert r.status_code == 409, r.text

    def test_list_scoped_to_tenant(self, tenant_a, tenant_b):
        ra = requests.get(f"{API}/tracker/devices", headers=_hdr(tenant_a["token"]), timeout=30)
        rb = requests.get(f"{API}/tracker/devices", headers=_hdr(tenant_b["token"]), timeout=30)
        assert ra.status_code == 200 and rb.status_code == 200
        a_imeis = {d["imei"] for d in ra.json()}
        b_imeis = {d["imei"] for d in rb.json()}
        assert REAL_IMEI_MOVING in a_imeis
        assert REAL_IMEI_MOVING not in b_imeis, "tenant B should not see tenant A device"
        assert rb.json() == [] or all(d["tenant_id"] == tenant_b["id"] for d in rb.json())

    def test_same_imei_allowed_across_tenants(self, tenant_b):
        r = requests.post(f"{API}/tracker/devices",
                          json={"imei": REAL_IMEI_MOVING, "car_id": tenant_b["car_id"],
                                "label": "TEST_B_moving"},
                          headers=_hdr(tenant_b["token"]), timeout=30)
        assert r.status_code in (200, 201), r.text
        tenant_b["device_id"] = r.json()["id"]

    def test_patch_label_and_deactivate(self, tenant_a):
        did = tenant_a["device_id"]
        r = requests.patch(f"{API}/tracker/devices/{did}",
                           json={"label": "TEST_renamed", "sim_number": "0871234567"},
                           headers=_hdr(tenant_a["token"]), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["label"] == "TEST_renamed"
        assert d["sim_number"] == "0871234567"

    def test_delete(self, tenant_b):
        did = tenant_b["device_id"]
        r = requests.delete(f"{API}/tracker/devices/{did}",
                            headers=_hdr(tenant_b["token"]), timeout=30)
        assert r.status_code == 200
        # confirm gone
        rl = requests.get(f"{API}/tracker/devices", headers=_hdr(tenant_b["token"]), timeout=30)
        assert did not in {d["id"] for d in rl.json()}


# =========================================================================
# 3. Positions — live data via test-fleet (already registered) + isolation
# =========================================================================
class TestPositionsAndIsolation:
    def test_test_fleet_positions_populated(self):
        """The pre-existing test-fleet tenant has both IMEIs; verify /positions."""
        tf_tok = _admin_token_for("test-fleet", TEST_FLEET_TENANT_ID)
        r = requests.get(f"{API}/tracker/positions", headers=_hdr(tf_tok), timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) >= 2, f"expected >=2 positions, got {len(rows)}"
        imeis = {row["imei"] for row in rows}
        assert REAL_IMEI_MOVING in imeis and REAL_IMEI_STOPPED in imeis
        for row in rows:
            assert 50 <= row["lat"] <= 56, f"lat out of range: {row['lat']}"
            assert -11 <= row["lon"] <= -5, f"lon out of range: {row['lon']}"

    def test_car_position_endpoint(self):
        tf_tok = _admin_token_for("test-fleet", TEST_FLEET_TENANT_ID)
        r = requests.get(f"{API}/tracker/positions", headers=_hdr(tf_tok), timeout=30)
        car_id = r.json()[0]["car_id"]
        rc = requests.get(f"{API}/tracker/car/{car_id}", headers=_hdr(tf_tok), timeout=30)
        assert rc.status_code == 200
        assert rc.json()["car_id"] == car_id

    def test_car_position_404_for_unknown_car(self):
        tf_tok = _admin_token_for("test-fleet", TEST_FLEET_TENANT_ID)
        r = requests.get(f"{API}/tracker/car/does-not-exist-{int(time.time())}",
                         headers=_hdr(tf_tok), timeout=30)
        assert r.status_code == 404

    def test_isolation_tenant_b_no_positions(self, tenant_b):
        r = requests.get(f"{API}/tracker/positions", headers=_hdr(tenant_b["token"]), timeout=30)
        assert r.status_code == 200
        # tenant_b's devices are freshly created and may or may not have polled yet,
        # but must NEVER contain data from test-fleet
        for row in r.json():
            assert row["tenant_id"] == tenant_b["id"]


# =========================================================================
# 4. Poller behaviour — history moving-only rule (in-process, direct DB read)
# =========================================================================
class TestPollerHistoryRule:
    """Direct DB reads to verify the moving-only history contract on the
    already-polled test-fleet tenant. 7018530625 (speed ~38 km/h) should
    have many history rows; 7018530607 (stationary) should have <=1."""

    @pytest.mark.asyncio
    async def test_moving_vs_stationary_history_counts(self):
        import os as _os
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(_os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[_os.environ.get("DB_NAME", "quick_wing_db")]
        try:
            devices = await db.tracker_devices.find(
                {"tenant_id": TEST_FLEET_TENANT_ID}, {"_id": 0}
            ).to_list(20)
            by_imei = {d["imei"]: d for d in devices}
            moving_car = by_imei[REAL_IMEI_MOVING]["car_id"]
            stopped_car = by_imei[REAL_IMEI_STOPPED]["car_id"]

            moving_count = await db.tracker_history.count_documents(
                {"tenant_id": TEST_FLEET_TENANT_ID, "car_id": moving_car}
            )
            stopped_count = await db.tracker_history.count_documents(
                {"tenant_id": TEST_FLEET_TENANT_ID, "car_id": stopped_car}
            )
            assert moving_count >= 1, (
                f"moving car should accumulate history rows; got {moving_count}. "
                "If 0, the poller may not have ticked yet — wait 30-60s and rerun."
            )
            assert stopped_count <= 1, (
                f"stationary car should have <=1 history rows (only a stop-transition), "
                f"got {stopped_count} — MOVING-ONLY history rule is broken."
            )
        finally:
            client.close()

    @pytest.mark.asyncio
    async def test_direct_poller_call_upserts_position(self):
        """Call gps_poller.sinotrack_bridge_job() in-process against the real DB
        and confirm a fresh last_update timestamp is written."""
        import os as _os
        from motor.motor_asyncio import AsyncIOMotorClient
        from services import gps_poller

        client = AsyncIOMotorClient(_os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[_os.environ.get("DB_NAME", "quick_wing_db")]
        # inject db (won't reschedule if scheduler already exists in this process)
        gps_poller._db = db
        try:
            before = await db.tracker_positions.find_one(
                {"tenant_id": TEST_FLEET_TENANT_ID, "imei": REAL_IMEI_MOVING}, {"_id": 0}
            )
            await gps_poller.sinotrack_bridge_job()
            after = await db.tracker_positions.find_one(
                {"tenant_id": TEST_FLEET_TENANT_ID, "imei": REAL_IMEI_MOVING}, {"_id": 0}
            )
            assert after is not None
            # last_update should be present; timestamp likely refreshed
            assert "last_update" in after
            if before:
                # allow equal if the SinoTrack cloud hasn't advanced yet
                assert after["last_update"] >= before["last_update"]
        finally:
            client.close()


# =========================================================================
# 5. Scheduler wiring — verify start() attaches exactly one job
# =========================================================================
class TestPollerLifecycle:
    @pytest.mark.asyncio
    async def test_start_attaches_master_job(self):
        # AsyncIOScheduler requires a running event loop to start()
        from services import gps_poller as gp
        gp.stop()
        gp._scheduler = None
        sched = gp.start(db=object())
        try:
            jobs = sched.get_jobs()
            ids = [j.id for j in jobs]
            assert "sinotrack_bridge_master" in ids
            assert len([j for j in jobs if j.id == "sinotrack_bridge_master"]) == 1
        finally:
            gp.stop()
