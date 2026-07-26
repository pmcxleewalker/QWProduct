# Quick Wing SaaS — Multi-Tenant SinoTrack GPS Bridge Prompt

Copy and paste the prompt below into your new build session.

---

## PROMPT START

Build a **multi-tenant SinoTrack GPS bridge** for Quick Wing, a fleet management SaaS. Each tenant (company) is fully isolated with its own data. GPS tracking is an **opt-in add-on** — not all tenants use it.

### CONTEXT: How the SinoTrack Bridge Works

SinoTrack ST-902L-4GE OBD trackers have **locked firmware** — you cannot point them at your own server. They only report to SinoTrack's cloud at `https://246.sinotrack.com`. The bridge works by **reverse-engineering their cloud API** to pull positions every 30 seconds via a server-side poller.

**API Protocol (DO NOT CHANGE — this is reverse-engineered and working):**

```python
SINOTRACK_SERVER = "https://246.sinotrack.com"
APP_ID = base64.b64encode(b"246.sinotrack.com/").decode()

def _call_sinotrack(token_raw: str, user: str = "", app_id: str = "") -> dict:
    token = base64.b64encode(token_raw.encode()).decode()
    ts = str(int(time.time() * 1000))
    rand = str(random.randint(10000000000000, 99999999999999))
    sign_input = f"{ts}{rand}{user}{app_id}{token}"
    sign = hashlib.md5(sign_input.encode()).hexdigest()
    r = httpx.post(f"{SINOTRACK_SERVER}/APP/AppJson.asp", data={
        "strAppID": app_id, "strUser": user,
        "nTimeStamp": ts, "strRandom": rand,
        "strSign": sign, "strToken": token,
    }, timeout=10)
    return r.json()

# Login per device:
login_token = f"Proc_LoginIMEI\x11N'{imei}',N'{password}'\x11\x11\x1b3"

# Fetch position:
pos_token = f"Proc_GetLastPosition\x11N'{imei}'\x11\x11\x1b58"
```

**Position data returned** includes: `dbLat`, `dbLon`, `nSpeed`, `nDirection`, `nGPSSignal`, `nGSMSignal`, `nMileage`, `nTime` (unix epoch), and voltage from `strOther` field (parse `Voltages=XX.X`). Default device password is `123456`.

---

### ARCHITECTURE REQUIREMENTS

**1. Tenant Model**

```
tenants: {
  id, name, slug, domain,
  gps_enabled: Boolean (default false),   ← THE CHECKBOX
  gps_settings: {
    speed_limit_kmh: 120,        # Configurable per tenant
    poll_interval_seconds: 30,   # Configurable per tenant
    history_retention_days: 60,  # How long to keep journey data
    device_password: "123456",   # SinoTrack default, can be changed per tenant
  },
  created_at, is_active
}
```

**2. Tenant Onboarding Flow**

- During tenant setup, show a **checkbox**: "Enable GPS Fleet Tracking (SinoTrack)"
- If checked → set `gps_enabled: true`, create default `gps_settings`, bridge starts polling for that tenant
- If unchecked → no GPS collections created, no polling, no GPS UI shown
- Tenant admin can **enable/disable GPS later** from their settings page (same checkbox)
- When GPS is toggled ON later → initialize GPS collections + start polling
- When GPS is toggled OFF → stop polling (data is retained, just not actively updated)

**3. Per-Tenant Database Isolation**

Every GPS-related collection MUST be scoped by `tenant_id`. Use one of:

- **Option A (recommended):** Single database, all collections prefixed/filtered by `tenant_id` field
- **Option B:** Separate database per tenant (e.g., `quickwing_tenant_{id}`)

GPS collections per tenant (only created when `gps_enabled: true`):

```
tracker_devices:    { tenant_id, id, imei, car_id, sim_number, apn, is_active, label }
tracker_positions:  { tenant_id, car_id, tracker_id, lat, lon, speed, voltage, status, last_update }
tracker_history:    { tenant_id, tracker_id, car_id, lat, lon, speed, direction, voltage, ignition, timestamp }
tracker_alerts:     { tenant_id, tracker_id, car_id, type, speed, lat, lon, timestamp, acknowledged }
shared_trips:       { tenant_id, share_id, car_id, car_name, registration, date, points, trips, expires_at }
```

**Every query** on these collections MUST include `tenant_id` in the filter. No tenant can ever see another tenant's tracker data.

**4. Bridge Poller — Isolated Per Tenant**

The SinoTrack bridge runs as a **single background scheduler** (APScheduler or similar) but iterates over **all GPS-enabled tenants**:

```python
async def sinotrack_bridge_job():
    """Master polling loop — runs every 30s, processes all GPS-enabled tenants."""
    tenants = await db.tenants.find({"gps_enabled": True, "is_active": True}).to_list(500)
    for tenant in tenants:
        try:
            await sync_tenant_positions(tenant)
        except Exception as e:
            logger.error(f"Bridge error for tenant {tenant['id']}: {e}")

async def sync_tenant_positions(tenant):
    """Sync all tracker positions for a single tenant. Fully isolated."""
    tenant_id = tenant["id"]
    poll_interval = tenant.get("gps_settings", {}).get("poll_interval_seconds", 30)
    speed_limit = tenant.get("gps_settings", {}).get("speed_limit_kmh", 120)
    device_password = tenant.get("gps_settings", {}).get("device_password", "123456")

    devices = await db.tracker_devices.find(
        {"tenant_id": tenant_id, "is_active": True}
    ).to_list(500)

    for device in devices:
        car_id = device.get("car_id")
        if not car_id:
            continue
        imei = device["imei"]
        position = fetch_position(imei, device_password)  # Calls SinoTrack cloud API
        if not position or position["latitude"] == 0:
            continue

        # Write to tenant-scoped collections (ALWAYS include tenant_id):
        await db.tracker_positions.update_one(
            {"tenant_id": tenant_id, "car_id": car_id},
            {"$set": {... position data ..., "tenant_id": tenant_id}},
            upsert=True
        )
        # Journey history — only record when car is MOVING (speed > 0)
        # or just transitioned from moving to stopped (one final stop point)
        # Skip continuous stationary pings — they bloat DB and distort driver scores
        ...
        # Speed alerts (tenant-configurable threshold)
        if position["speed"] > speed_limit:
            await db.tracker_alerts.insert_one({
                "tenant_id": tenant_id, ...alert data...
            })
        # Unplug detection (voltage drop)
        ...
```

**5. Key Bridge Behaviors (proven in production)**

- **Journey recording:** Only save to `tracker_history` when `speed > 0` (car moving) OR when car just stopped after moving (one final stop point). NEVER save continuous stationary pings — they fill the DB with useless data and skew driver scores.
- **Ignition detection:** `speed > 0 OR voltage > 13V`
- **Offline detection:** If no position returned but was previously "online", mark as "offline"
- **Unplug detection:** If voltage drops from >10V to <5V between consecutive polls, create alert
- **Speed alerts:** Configurable per tenant (default 120 km/h)

**6. API Endpoints (all tenant-scoped)**

All endpoints must resolve `tenant_id` from the authenticated user's session/token:

```
GET  /api/tracker/positions           — All live positions for current tenant
GET  /api/tracker/car/{car_id}        — Single car position
POST /api/tracker/devices             — Register new tracker (IMEI)
GET  /api/tracker/devices             — List all trackers for tenant
GET  /api/tracker/history/{car_id}    — Journey history (date param, filters stationary noise)
GET  /api/tracker/telemetry           — Fleet telemetry cards for dashboard
GET  /api/tracker/alerts              — Speeding/unplug alerts
POST /api/tracker/trips/share         — Create shareable trip link (public, no auth, 60-day expiry)
GET  /api/tracker/trips/shared/{id}   — Public trip viewer (no auth needed)
GET  /api/tracker/trips/shared/{id}/pdf  — Download trip as PDF report
GET  /api/tracker/trips/shared/{id}/csv  — Download raw GPS data as CSV
```

**7. Frontend GPS Toggle**

- **Tenant settings page:** Checkbox "Enable GPS Fleet Tracking"
- When enabled, show: Tracker management UI, Live Map, Fleet telemetry cards, Journey playback, Driver scores, Route sharing
- When disabled, hide all GPS-related UI — show nothing, no empty states
- **Per-car "Live" button** on car cards across all pages (only shows if GPS is enabled AND car has a tracker assigned)
- **Journey playback** with animated map, play/pause, 1x/2x/4x/8x speed, trip scrubber, clickable trip list

**8. Data Retention & Cleanup**

- Cron job runs daily (3am), per tenant:
  - Delete `tracker_history` older than tenant's `history_retention_days` (default 60)
  - Delete expired `shared_trips`
- Shared trip links expire after 60 days (configurable per tenant)

**9. Driver Scoring (GPS-telemetry based, per tenant)**

Score weights (only uses MOVING data, speed > 0):

- Speeding: 35% — points above tenant's speed limit
- Harsh Braking: 30% — speed drops ≥15 km/h between consecutive points
- Harsh Acceleration: 15% — speed gains ≥20 km/h between consecutive points
- Night Driving: 10% — driving between 10pm–6am
- Smooth Driving: 10% — low variance in speed changes (3 km/h avg change = perfect)

Grade: A (≥90), B (≥75), C (≥60), D (≥40), F (<40)

**10. Security Constraints**

- Tenant isolation is CRITICAL — a bug that leaks Tenant A's GPS data to Tenant B is a P0 security incident
- Every DB query MUST include `tenant_id`
- Shared trip links are the ONLY public endpoints (no auth) — they contain snapshotted data, not live queries
- Device IMEIs are sensitive — never expose in public endpoints
- SinoTrack credentials (device passwords) stored per-tenant in `gps_settings`, never logged

### TECH STACK

- Backend: Python FastAPI + Motor (async MongoDB)
- Frontend: React + Tailwind + Leaflet (react-leaflet) for maps
- Scheduler: APScheduler (AsyncIOScheduler)
- HTTP Client: httpx (for SinoTrack API calls)
- PDF: fpdf2
- Maps: OpenStreetMap tiles + Nominatim geocoding

## PROMPT END
