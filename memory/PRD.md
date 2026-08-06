# Quick Wing Fleet Management - Multi-Tenant SaaS Platform

## Product Overview
Quick Wing is a comprehensive fleet management SaaS platform designed for multi-franchise operations. Each franchise (tenant) operates in complete data isolation while being managed from a central platform.


### Feature - Feb 2026 — Documents Inbox Unread Dot + Fleet Board Driver-name Pills

**Documents Inbox unread badge (red dot on sub-tab)**:
- New endpoints:
  - `GET /api/documents/inbox/unread-count` → returns `{count: int}` of unread `document_submitted` notifications for the current admin (returns 0 for non-admins).
  - `POST /api/documents/inbox/mark-read` → marks every unread `document_submitted` notification for the current admin as read, sets `read_at` timestamp. Returns `{marked: int}`.
- `TenantDashboard.js`:
  - New `docsInboxUnread` state, fetched on mount + polled every 60s (admins only).
  - When `activeTab==='reports' && activeSubTab==='documents'`, fires `POST /documents/inbox/mark-read` and clears the local count → dot disappears instantly.
  - Sub-tab pill row: rendered as a per-item lambda that adds an absolute-positioned 10px rose-500 dot (with white ring) top-right on the "Documents" pill when `docsInboxUnread > 0`. `data-testid="subtab-documents-unread-dot"`.

**Fleet Board driver-name pills**:
- `components/FleetBoard.js → Timeline`:
  - Track bumped from `h-3` → `h-8` to accommodate a proper pill height.
  - Each booking pill now `h-6`, rounded-full, blue-500, contains the driver name (`p.booking.user_name || .customer_name`) as an inline truncated label.
  - Label is only rendered when `widthPct >= 8` — so ultra-narrow slots keep just a colour bar without visual clutter. `data-testid="fleet-timeline-pill-label-<id>"` when shown.
  - Hover state: `h-7` + shadow — still clickable, still fires `onPillClick(booking)` to open the booking preview modal.

**Files touched**:
- `backend/server.py`: new unread-count + mark-read endpoints (before the existing `GET /documents/submissions`).
- `frontend/src/pages/TenantDashboard.js`: state, poller, mark-read effect, sub-tab dot rendering.
- `frontend/src/components/FleetBoard.js`: taller track + driver-name pill rendering.

**Verified**:
- Backend curl: baseline 0 → seed 3 notifications → count 3 → mark-read (marked=3) → count 0.
- Playwright: red dot rendered on Documents sub-tab (count 1), disappears after opening the tab (mark-read fired, count 0). Fleet Board pills show "Aswathy Mani…" and "Margaret O…" for two seeded bookings on the Ford Focus card, both truncated cleanly.
- Post-verify cleanup removed the seeded bookings and notifications.


### Feature - Feb 2026 — Documents Inbox + Multi-photo Fields + Admin Notifications; Removed Cost Analytics/Fuel Insights

**Removals**:
- **Fleet Reports**: dropped the `<CostAnalyticsDashboard>` render — the "Cost Analytics Dashboard" and "Cost by vehicle" cards no longer appear on the Reports tab.
- **Documents (admin)**: removed the `<FuelAnalyticsWidget />` "Fuel insights" panel — same data is now accessible via the Inbox filtered by "Fuel Log".

**Custom Documents — form builder upgrades**:
- **Multi-photo per image field**: new `max_images` (1-5) config on the `image` field type. Backend `TemplateField` model + `validate_fields` clamps to [1, 5]; `build_submission_doc` caps the accepted photo list to `max_images`; existing single-image behaviour preserved (default 1).
- **Template editor UI** (`CustomDocumentsAdmin.js`): when a field's type is `Image upload`, a `Max photos (1–5)` numeric input is shown with helper copy. Value persists via `PUT/POST /api/documents/templates`.
- **Staff form** (`CustomDocumentsStaff.js`): image field rendering now respects `max_images`. When cap > 1, staff can add multiple photos (multi-select + accumulate), each with its own remove button, all in a 2-col preview grid. Cap enforced client-side and server-side.
- **Admin notifications**: `POST /api/documents/submissions` now writes a `document_submitted` notification to every admin/master-admin of the tenant (skipping the submitter). Notification payload includes template name, submitter name and submission id — surfaces via the existing dashboard notification bell.
- **Documents Inbox** (`CustomDocumentsAdmin.js → DocumentsInbox`): brand-new global inbox above the templates grid. Lists ALL submissions across ALL templates, newest first, grouped by date bucket (Today · Yesterday · Earlier this week · Earlier this month · Older by month). Includes:
  - Debounced search across template name, submitter name/email and vehicle registration (server-side via new `?q=` query param on `GET /api/documents/submissions`).
  - Template filter dropdown (`All document types` + one entry per template).
  - Photo count badge per row, submitter and vehicle reg subline, time + date column, chevron detail.
  - Clicking a row opens the existing `SubmissionDetailModal` — reads image fields as arrays so multi-photo submissions render as a 2-col image grid; delete action wired.

**Files touched**:
- `backend/services/documents.py`: `TemplateField.max_images`, `validate_fields` clamp, `build_submission_doc` cap.
- `backend/server.py`: `GET /documents/submissions` accepts `q=`; `POST /documents/submissions` writes admin notifications after insert.
- `frontend/src/components/CustomDocumentsAdmin.js`: new `DocumentsInbox`, template editor gets max_images control, dropped FuelAnalyticsWidget import.
- `frontend/src/components/CustomDocumentsStaff.js`: multi-photo capture with per-photo remove.
- `frontend/src/pages/TenantDashboard.js`: removed CostAnalyticsDashboard render from Fleet Reports.

**Verified**:
- Backend curl: creating template with `max_images:5` persists; submitting 3 photos → 3 stored; submitting 8 photos → capped to 5.
- Playwright screenshots: Documents Inbox renders with date buckets and search, template editor shows Max photos (1-5) control, Fleet Reports no longer shows Cost Analytics Dashboard, Fuel insights widget is gone.
- Notification write is best-effort (wrapped in try/except so submission never fails).


### Feature - Feb 2026 — Fleet Board replaces "Car Calendars" in Tenant Dashboard

**What was built**: Replaced the old per-car "Car Bookings" (Free/Booked/Recurring hour-cell grid) sub-tab with the modern `FleetBoard` component in the Tenant Dashboard's Fleet section.

- Renamed the `car-calendars` sub-tab label from "Car Calendars" → "Fleet Board" (both admin and staff-user tab lists).
- Sub-tab now renders `<FleetBoard>` from `components/FleetBoard.js` — same component used on `/bookings`.
- Live Map explicitly excluded per user request ("not needed yet"); the tenant dashboard Fleet section now has: Live Status · Manage Vehicles · **Fleet Board** · All Cars Calendar.
- Search bar + brand chips preserved on top for large fleets.
- `Quick Book` and booking-pill clicks navigate to the tenant's `/bookings` page (with `?car=` or `?booking=` query) where the full new-booking form / booking preview modal lives — avoiding duplicated form state on the dashboard.
- `onCarsChanged` is wired to `fetchData` so drop-off updates from FleetBoard refresh dashboard state.

**Files touched**: `frontend/src/pages/TenantDashboard.js` (import FleetBoard, rename sub-tab, replace old sub-tab content with FleetBoard render).

**Verified**: Playwright screenshot as master_admin — Fleet Board renders inside dashboard with header, date nav (Today), counters (6 Available / 0 In Use / 0 Blocked / 6 cars), brand chips, and vehicle cards each showing timeline + Quick Book / Drop-off actions.


### Feature - Feb 2026 — Contact Form + Thank-You Page (Google Ads conversion URL)

**What was built**: A proper marketing contact flow at `/contact` (form) and `/thank-you` (conversion page).

- `/contact` (rewritten `pages/Contact.js`): Full name, Company name, Email, Phone (all required, client-side validated) + Message (optional). POSTs to existing `/api/public/contact`. On success → `navigate('/thank-you')`. Two-column layout with left pitch + right form card, matches the light Quick Wing aesthetic.
- `/thank-you` (new `pages/ThankYou.js`): Green check + "Thanks for getting in touch! Lee will be in touch with you shortly." + "Back to homepage" button. Purpose-built to be used as the Google Ads conversion tracking URL.
- **Nav link**: Added "Contact" link to Landing Page nav (top-right, between logo and Login).
- **Email notification** (`services/email_service.py::send_contact_lead_email`): Attempts to send to `lee@quick-wing.com` from the branded `invites@send.quick-wing.com` sender, falls back to `pmcxleewalker@gmail.com` (Resend account owner) via `onboarding@resend.dev` so the lead always reaches Lee even while the custom domain is unverified. Delivery status persisted on the `contact_requests` doc (`email_sent`, `email_delivered_to`, `email_error`).

**Action required (not code)**: Verify `send.quick-wing.com` DNS in Resend dashboard so primary delivery to `lee@quick-wing.com` works.

**Files touched**: `frontend/src/pages/Contact.js` (rewrite), `frontend/src/pages/ThankYou.js` (new), `frontend/src/pages/LandingPage.js` (nav Contact link), `frontend/src/App.js` (import + route), `backend/services/email_service.py` (new function), `backend/server.py` (endpoint fires email + records delivery).

**Verified**: Playwright E2E — empty-form validation blocks submit, filled form redirects to /thank-you, DB record shows `email_sent=true`, `email_delivered_to=pmcxleewalker@gmail.com`. Console-log confirmed fallback delivery ID from Resend.


### Feature - Feb 2026 — Landing Page Tabs + Quick Wing Plus Tier

**Restructure**: Landing Page split from one long scroll into four tabs (hero-embedded, sticky under nav): **Home**, **Features**, **ROI Calculator**, **Pricing**. State-based tab switching (no routing change), scroll-to-top on tab change.

- **Home**: Hero + "As featured in" (AI Six + Bluebird) + Founder message + Success Story + Final CTA
- **Features**: Split into "Included in every plan" (3 screenshot cards) and "Only on Plus" (4 icon cards: Live GPS, Journey Playback, Driver Behaviour, Smart Alerts), each Plus card carries a gold "Plus" pill
- **ROI Calculator**: The full interactive 5-slider calculator with live totals, moved to its own tab
- **Pricing**: Two-tier card layout — Quick Wing Standard from **€6.50/car/mo** (bookings + compliance) vs Quick Wing Plus from **€8.50/car/mo** (adds GPS + behaviour + alerts + playback). Plus card has gold gradient border, dark navy background, gold CTA button, "Recommended" pill

**Quick Wing Plus logo**: Generated one-off via Nano Banana (`gemini-3.1-flash-image-preview`) using the existing Quick Wing logo as a reference — brushed gold + champagne finish, dark navy accents, gold PLUS pill badge under the wordmark, transparent background. Saved to `/app/frontend/public/quick-wing-plus-logo.png`. Generation script: `/app/scripts/gen_plus_logo.py`.

**Files touched**: `frontend/src/pages/LandingPage.js` (full rewrite with tab system), `frontend/public/quick-wing-plus-logo.png` (new asset), `scripts/gen_plus_logo.py` (new).

**Verified**: Screenshot tool confirmed all 4 tabs render, ROI totals correct (€27,000 on defaults), pricing shows €6.50 / €8.50, gold Plus logo displays crisp.


### Feature - Feb 2026 — Landing Page "As Featured In" AI Six Logo

**What was built**: Replaced the placeholder AI Six wordmark in the Landing Page "As featured in" bar with the real AI Six Podcast logo artwork (from user-uploaded artifact `IMG_7448.jpeg`). The logo is now an anchor tag linking to the founder's interview at `https://youtu.be/_oR2ROeUOp4` (opens in new tab). Hover state fades ring to blue and title text turns blue. Bluebird Care mark preserved next to it. Verified visually via screenshot tool.

**Files touched**: `frontend/src/pages/LandingPage.js` (SVG placeholder → `<a>` wrapping `<img>` with `data-testid="ai-six-podcast-link"` and `data-testid="ai-six-podcast-logo"`).


### Bug Fix - Feb 2026 — Resend Invite fallback (Bluebird investigation)

**User report**: "Resend button for sending staff their login email doesn't work — especially for Bluebird Dublin South."

**Root cause (two things)**:
1. **Bluebird Care Dublin South tenant does not exist** in the current database (0 hits for `bluebird`/`dublin`/`karen` — likely wiped in an earlier rollback; 67 tenants total).
2. **Resend API key is restricted** — free-tier onboarding key that only allows FROM `onboarding@resend.dev` and sending to Lee's own gmail. The custom sender `invites@send.quick-wing.com` (domain `send.quick-wing.com`) is not verified in Resend, so every real send returns `"The associated domain with your API key is not verified"`.

**Fix delivered** — turned a silent failure into an actionable admin workflow:
- **Backend**: `POST /api/tenant/users/{user_id}/resend-invitation` now returns `activation_url` in every response (even on email failure). Activation token is persisted regardless of delivery outcome.
- **Frontend**: `pages/TenantDashboard.js` — on `email_sent=false`, opens a copyable modal (`manual-invite-dialog`) with the activation URL and temporary password. Admin can copy either and share via WhatsApp/SMS. Modal shows the underlying provider error so the admin knows *why* delivery failed.
- **Testing**: 4/4 backend pytest pass + full frontend E2E (iteration_38) — 100% pass. Cross-tenant 404, staff 403, password reset, copyable link + password with Copy toasts, provider error banner, all data-testids verified.

**Action required from user** (not code): Verify `send.quick-wing.com` DNS records in the Resend dashboard OR provide a full-access Resend API key. Once done, `email_sent` will flip to true automatically — no further code changes needed.


### Feature - Feb 2026 — SinoTrack GPS Bridge · Phase 6 (Telemetry Cards + Driver Behaviour)

**What was built**: Live fleet telemetry cards on the FleetBoard, plus a driver-behaviour event feed for admin review. Explicitly NOT a scoring/grading system.

**(A) Fleet Telemetry**
- **New endpoint** `GET /api/tracker/telemetry` — per-tracked-car payload: speed, ignition, voltage, satellite count (gps_signal), mileage_today_km (haversine sum of today's tracker_history), connection status (`live` ≤5 min, `idle` 5-60 min, `offline` >60 min), address (from cache), last update.
- **New endpoint** `GET /api/tracker/geocode?lat=&lon=` — reverse-geocode via OSM Nominatim with `geocode_cache` (4-decimal ~11 m rounding). Cache lookup first, only hits Nominatim on miss.
- **New service** `/app/backend/services/fleet_telemetry_service.py`.
- **New component** `FleetTelemetryPanel.js` — LIVE/IDLE/OFFLINE pill + 6 metric tiles + lazy address line. Rendered inside each tracked car's FleetBoard card below the Timeline. Polled every 30 s from `Bookings.js`.

**(B) Driver Behaviour Monitoring**
- **New collection** `driver_behaviour_events` with types: `speeding`, `harsh_braking`, `harsh_acceleration`, `disconnection`.
- **New service** `/app/backend/services/driver_behaviour_service.py` — detection helpers + booking→staff linkage (`car_id + start_time ≤ ts ≤ end_time`; fallback `staff_name="Unbooked"`).
- **Detection thresholds** (in the poller):
  - Harsh braking: drop ≥15 km/h AND prev speed >10 km/h.
  - Harsh acceleration: rise ≥20 km/h.
  - Speeding: point speed > tenant `speed_limit_kmh`.
  - Disconnection: voltage transition >10 V → <5 V OR first offline transition (≥10 min silent).
- **New endpoint** `GET /api/behaviour/events?type=&car_id=&staff_id=&from_date=&to_date=` — filtered feed, newest first.
- **New endpoint** `GET /api/behaviour/summary?window_days=` — `{total, by_type, top_staff}` for the summary strip.
- **New page** `/behaviour` — 5-tile summary strip, Top-Staff card (click to filter), filter dropdowns (type/car/staff/from/to), chronological event list with car + staff + coords. **No scoring, no grades, no leaderboard** — verified by testing agent.
- **Nav item** "Behaviour" (icon: ShieldAlert) visible to tenant admins on GPS-enabled tenants.
- **Multi-tenant safety** — every read/write scoped by `tenant_id` (verified 14/14 pytest).
- **Test coverage** — `test_phase6_behaviour_telemetry.py` (14/14 backend pass) + frontend E2E in iteration_37 (100% requested checks pass; 5 summary tiles, top-staff filter, no-scoring language check confirmed).


### Feature - Feb 2026 — SinoTrack GPS Bridge · Phase 5 (Alerts + Geofence)

**What was built**: Speeding, unplug, offline, and geofence alerts with tenant-configurable thresholds. Full alerts dashboard + acknowledge flow + nav badge.

- **Poller enhancements** (`services/gps_poller.py`):
  - Speeding alerts now carry `severity`: warning (1-30 km/h over), critical (30+ over).
  - `unplug` alerts: critical severity when voltage falls from >10 V to <5 V between polls.
  - `offline` alerts: emitted when a previously-online tracker has been silent >=10 min (warning) or >=60 min (critical). Deduped — the open row's severity/timestamp escalates instead of piling up.
  - `geofence_exit` alerts: when the vehicle's fix is farther than `vehicle.geofence_radius_km` from `vehicle.geofence_center_lat/lon` (haversine). Deduped like offline.
- **API endpoints** (all tenant-scoped):
  - `GET /api/tracker/alerts` — list (default excludes acked), sorted critical-first.
  - `GET /api/tracker/alerts/count` — `{total, critical}` for nav badge.
  - `POST /api/tracker/alerts/{id}/ack` — single ack (admin).
  - `POST /api/tracker/alerts/ack-bulk` — `{type?}` bulk ack (admin).
  - `PUT /api/vehicles/{car_id}/geofence` — set/clear geofence (admin). Validates all-or-none, radius 1-5000 km.
- **Vehicle model**: added `geofence_center_lat/lon`, `geofence_radius_km`, `geofence_label`. `GeofenceUpdate` payload model.
- **Alerts dashboard** (`/app/frontend/src/pages/Alerts.js`, route `/alerts`): severity summary strip, type filter pills with counts, per-alert Ack button, bulk "Ack {type}" and "Acknowledge all". Auto-polls every 30 s.
- **Nav badge** (`Navigation.js`): tenant admins on GPS-enabled tenants see the Alerts nav item with a red pulsing badge (or amber if no critical) showing unacknowledged count. Polls `alertsCount` every 60 s.
- **Geofence editor** (`GeofenceModal.js`): lat/lon/radius/label form, "Use vehicle's current tracker position" auto-fill, Save + Clear. Opened from FleetBoard's "Geofence" button which appears only on tracked cars.
- **Multi-tenant safety**: every read/write is scoped by `tenant_id`; cross-tenant ack returns 404 (verified in 14/14 pytest).
- **Test coverage**: `/app/backend/tests/test_phase5_alerts_geofence.py` (14/14 pass) + frontend E2E via testing_agent (severity strip, filter pills, single + bulk ack, geofence save flow).


### Feature - Feb 2026 — SinoTrack GPS Bridge · Phase 4 (Journey Playback)

**What was built**: Animated route playback so admins can review any car's journeys for driver performance.

- **New endpoint** `GET /api/tracker/history/{car_id}?date=YYYY-MM-DD` — reads tenant-scoped `tracker_history`, groups points into trips (gap > 3 min = new trip), drops noise trips whose max_speed == 0. Returns `{car_id, car_name, registration, date, trip_count, trips[]}`; each trip has `id, start_time, end_time, duration_min, max_speed, avg_speed, point_count, points[]`.
- **New endpoint** `POST /api/tracker/history/{car_id}/seed-demo?days=3` — idempotent demo backfill (3-5 realistic trips per day per demo tracker). Skips days that already have >20 rows. Real trackers can't seed (404).
- **New service** `/app/backend/services/gps_history_service.py` — trip grouping + demo backfill along the same city loops used by the live simulator.
- **New component** `/app/frontend/src/components/JourneyPlayback.js` — modal with react-leaflet map (blue travelled polyline, gray remaining), animated car icon rotating by direction, green start / red end markers. Controls: Play/Pause, Skip Back/Forward, timeline scrubber, 1x/2x/4x/8x speed. Info tiles: Time, Speed, Voltage, Heading + point counter (`N/M`). Sidebar shows clickable trip list with `PLAYING` pill on active trip and per-trip stats (duration, max/avg speed, point count).
- **FleetBoard integration** — "Journey" button appears only on TRACKED cars (`data-testid=fleet-journey-<car_id>`). `trackedCarIds` set is fetched from `trackerAPI.listDevices()` in `Bookings.js`.
- **Multi-tenant safety** — all reads/writes filter by `tenant_id` + `car_id`; vehicle ownership pre-check returns 404 across tenants.
- **Test coverage** — `/app/backend/tests/test_journey_playback.py` (9/9 pass): endpoint shape, seed idempotency, tenant isolation, trip grouping (>3 min gap = new trip, <3 min = same, all-zero-speed dropped).


### Bug Fix - Feb 2, 2026 — Empty "Fleet Reports" page

Client reported the Admin → Reports tab showed only the date pickers + Export button with no metrics at all. Three issues stacked:

1. **`AlertTriangle` not imported** in `Admin.js` — referenced at line ~3210 but missing from the lucide-react import list. Threw at render time → ErrorBoundary caught it (so users saw the friendly fallback card with the real error, not a white screen — confirming the safety net works).
2. **`reportsAPI.getFleetUsage(...)` was undefined** — `Admin.js` called it (and several others: `getBookingCharts`, `getCarsWithoutBookings`, `getBookingsDetail`, `clearBookings`, `exportCSV`), but `api.js` only exported `getSummary`. Every call threw a TypeError, which the catch handler swallowed → `reportData` stayed `null` → blank page.
3. **Backend ↔ frontend field-name mismatch** — backend returns `most_booked_cars` / `blocked_cars` / `bookings` (per-car), but the UI is written against `most_booked` / `blocked_vehicles` / `total_bookings`. Even after wiring up the API, cards wouldn't fill.

**Fixes** (all in `frontend/src/api/api.js`):
- Added the missing `AlertTriangle` to the lucide-react import in `Admin.js`.
- Implemented `reportsAPI.getFleetUsage(start, end)` against `GET /api/tenant/fleet-reports` with `?from_date=&to_date=`, normalizing the response shape so the UI's existing field references work unchanged.
- Implemented `reportsAPI.exportCSV()` returning the canonical CSV endpoint URL.
- Stubbed `getBookingCharts`, `getCarsWithoutBookings`, `getBookingsDetail`, `clearBookings` to return empty payloads / a friendly error — no backend route exists for them yet, but the UI degrades gracefully (no crash, no spinner-of-death) and we can wire them up to real endpoints in a follow-up.

**Verified**: Reports tab now shows live counts — Total Vehicles 6, Total Bookings 2, Pending 0, Blocked 0 — plus Enhanced Analytics (Avg Bookings/Vehicle, Fleet Availability, etc.) and Professional Analytics (Performance Score, Demand Forecast, Fleet Health). CSV export returns HTTP 200 with valid CSV. The previously-added ErrorBoundary visibly caught the AlertTriangle crash and showed the friendly fallback instead of going white.

**Note**: preview only — push to production via "Save to Github" so BUMBLEance can see it.


### Enhancement - Feb 2, 2026
**Sign-in status badges next to every user / admin** so admins can immediately see whether an invited team member has ever actually used their login credentials. Hover tooltip shows the exact last-login timestamp.

- **Backend**: no changes needed — `last_login_at` was already being stamped on `/api/auth/login` and exposed through `/api/tenant/users`.
- **Frontend** (`pages/Admin.js`): added pills to all three user-card render paths — Administrators, Staff Members, and the User Reference table. Green "● Signed in" (`bg-emerald-100`) with tooltip showing exact last-login time; amber "● Never signed in" (`bg-amber-100`) with tooltip suggesting the admin re-send the invite. Switched the badge row containers from `space-x-3` to `flex-wrap gap-2` so the extra pill doesn't push other badges off the card on narrow screens. New data-testids: `user-signin-status-{id}`, `admin-signin-status-{id}`, `user-signin-status-table-{id}`.

**Note**: Only in preview — production needs a redeploy via "Save to Github" before BUMBLEance can see it.


### Bug Fix + Enhancement - Feb 2, 2026 (BUMBLEance prod report)
Client reported three issues on `quick-wing.com` (BUMBLEance tenant):

**1) White screen when trying to create a conflicting booking** ✅
Root cause: a couple of `setError(err.response?.data?.detail || ...)` calls in `Bookings.js` were passing an *object* (the 409 conflict detail `{message, conflict, available_cars, …}`) straight into React state. When `{error}` was then rendered as a React child, React threw "Objects are not valid as a React child" which — with no ErrorBoundary in place — unmounted the entire app tree (= white screen).

**Fixes**:
- Added `src/components/ErrorBoundary.js` — a class component that catches any render-time exception in its children and renders a friendly fallback panel ("Hmm, something hiccupped" + Try Again / Reload buttons) instead of letting React blank the screen.
- Wrapped the entire tenant routes block in `App.js` (Dashboard / Live Sheet / Bookings / Admin / etc.) with `<ErrorBoundary>` so a crash on any one page now degrades to a recoverable error card, not a global blank screen.
- Wrapped `<BookingIntelligence>` inside `Bookings.js` with its own `<ErrorBoundary>` (defence in depth — keeps the page usable even if the AI panel itself crashes).
- Hardened the `onApplySuggestion` catch handler in `Bookings.js` to coerce a structured `detail` object into a string before calling `setError`.

**2) Idle vehicles count too low on BUMBLEance** ✅
Root cause: the previous logic counted a car as "in use" if it had ANY booking in the next **14 days**. For fleets with weekly recurring assignments (BUMBLEance), almost every car had at least one booking somewhere in that window, so only 1 truly idle car ever surfaced.

**Fix**: shortened the "idle" window from 14 days → **48 hours**. Now reflects what's sitting unused today/tomorrow — which is what dispatchers actually care about. Summary text updated to "no bookings in the next 48 hours". Clash & compliance detection still use the full 14-day window.

**3) Booking Intelligence stat tiles should drill-down** ✅
Made all four tiles real `<button>` elements with proper hover/focus/active states:
- **Vehicle clashes** → sets filter chip to `vehicle-conflict` + smooth-scrolls to the cards
- **Driver clashes** → sets filter chip to `person-conflict` + scrolls
- **Compliance risk** → sets filter chip to `compliance` + scrolls
- **Idle vehicles** → expands the idle `<details>` panel + scrolls to it
Tiles are disabled (greyed) when their count is 0 so they don't pretend to be interactive when there's nothing to drill into. New data-testids: `bi-stat-vehicle-clashes`, `bi-stat-driver-clashes`, `bi-stat-compliance-risk`, `bi-stat-idle-vehicles`. Active tile gets a purple glow ring matching the active filter chip.

**Note**: These fixes only landed in preview — production at `quick-wing.com` still has the broken build until the user clicks "Save to Github" and triggers the redeploy.


### Bug Fix - Feb 2, 2026 (production hotfix)
**"Failed to update booking" alert in Edit Booking modal — fixed three chained bugs.**

Client reported `quick-wing.com says: Update failed: Failed to update booking` when editing any booking via the Edit Booking modal. Root cause was a chain of three latent bugs:

1. **Typo killing the whole save flow** — `EditBookingModal.js` called `bookingAPI.edit(booking.id, updateData)` but the method is named `update` in `api/api.js`. `bookingAPI.edit` was `undefined`, so calling it threw a `TypeError`. The catch block tried to read `err.response?.data?.detail`, found it undefined (TypeError has no `response`), and fell through to the generic `'Failed to update booking'` fallback message. The request **never reached the backend**.
2. **`BookingUpdate` model missing `car_id`** — the "Swap Car" flow sent `car_id`, but Pydantic silently dropped the unknown field, so the swap never persisted. Backend returned 200 + the unchanged booking, frontend showed a misleading "success".
3. **`BookingUpdate` missing `notes` and frontend used wrong field name** — modal wrote to `destination_notes` (doesn't exist anywhere in the codebase) and read from `booking.destination_notes` (always undefined). Notes typed into the textarea were silently discarded.

**Fixes**:
- `EditBookingModal.js`: replaced `bookingAPI.edit` → `bookingAPI.update`; renamed `destination_notes` → `notes` (with legacy-data fallback `booking.notes ?? booking.destination_notes ?? ''`).
- `models/resources.py` → `BookingUpdate`: added `car_id: Optional[str]` and `notes: Optional[str]`.
- `api/api.js`: also added the previously-missing `bookingAPI.getAvailableCars(start, end, excludeId)` (client-side intersection of `/vehicles` and `/bookings?from=&to=` — keeps the Swap Car selector working), plus `bookingAPI.approve(id)` and `bookingAPI.reject(id, reason)` which were being called from `Admin.js` but never defined.

**Regression suite**: 3 new pytest tests in `/app/backend/tests/test_booking_update_regression.py` — notes persistence, time updates, car-swap persistence. All passing. Plus all 18 previous tests in `test_cache_and_filters.py` + `test_cache_invalidation_regression.py` still pass.

**Note on deployment**: This fix only addresses preview/code. Production at https://quick-wing.com still has the broken build until the user clicks "Save to Github" and redeploys.


### Feature + Bug Fix - Feb 2, 2026
**BUMBLEance branding tweak + tenant-logo URL persistence bug fix + perf quick-wins (date filters & TTL cache).**

**A) BUMBLEance / tenant branding (UI refinement of the existing white-label feature)**
- Inside-app navbar (`Navigation.js`, desktop + mobile): primary wordmark restored to "Quick Wing"; the tenant logo now appears as a *subtle* badge to the right of a thin divider. Desktop: `h-8`, max-w 120px, opacity-90. Mobile: `h-6`, max-w 80px, opacity-80 with a "·" separator. New data-testids: `navbar-tenant-logo` (desktop), `navbar-tenant-badge` (mobile).
- Tenant login page (`TenantLogin.js`): co-brand row is now horizontal — **[Tenant logo] · POWERED BY · [Quick Wing logo]** — with the tenant name shown as small caption below ("`{Tenant Name} · Fleet Management Portal`"). When no tenant logo exists, page gracefully falls back to QW-only branding. New data-testid: `tenant-cobrand-row`, `quickwing-poweredby-logo`.

**B) Critical bug fix — tenant-logo URLs hardcoded `http://localhost:8001`**
- `POST /api/tenant/upload-logo` was building the stored URL as `os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001') + '/api/uploads/logos/...'`. Backend `.env` does **not** define `REACT_APP_BACKEND_URL`, so every uploaded logo URL was baked with `http://localhost:8001`. Browsers blocked these via Mixed Content + Chrome Private Network Access on the HTTPS preview/prod hosts, so BUMBLEance / any uploaded tenant logo silently disappeared.
- **Fix**: upload now stores a relative path (`/api/uploads/logos/<file>.png`). The K8s ingress already routes `/api/*` to the backend, so `<img src="...">` resolves correctly on any host (preview, prod, future custom domains).
- **One-time DB migration**: new `fix_legacy_logo_urls()` runs at server startup, rewriting any `http://(localhost|0.0.0.0|127.0.0.1):*/...` stored values to their relative path equivalents. Idempotent + only matches stale absolute URLs. Self-cleans existing tenants.

**C) Performance quick-wins (P1 from previous backlog)**
- **New TTL cache service**: `/app/backend/services/cache.py` — async-safe in-memory `TTLCache` with `get/set/get_or_set/invalidate/invalidate_prefix`. Process-local; swap for Redis with the same surface when scaling to multiple workers. Keys helpers: `tenant_settings_key`, `vehicles_key`, `locations_key`, `tenant_prefix`.
- **Cached endpoints + TTL**:
  - `GET /api/tenant/settings` — 30s TTL
  - `GET /api/vehicles` (per skip/limit) — 15s TTL (kept short to preserve real-time `current_status` overlay)
  - `GET /api/locations` — 60s TTL
- **Invalidation on every mutation**: PUT `/tenant/settings`, PUT `/tenant/settings/compliance`, POST `/tenant/upload-logo` → `tenant:{id}:settings` cleared. POST/PUT/DELETE `/vehicles`, POST `/vehicles/bulk-import`, POST `/vehicles/{id}/block`, POST `/vehicles/{id}/unblock` → entire `tenant:{id}:` prefix flushed (covers vehicles + settings). POST/PUT/DELETE `/locations` → `tenant:{id}:locations` cleared.
- **Bookings date filter**: `GET /api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD` (FastAPI aliases over `from_date`/`to_date` since `from` is a Python keyword). Overlap semantics: `start_time < to AND end_time > from`. Works alongside existing `status` / `car_id` / `user_id` / `include_secondary` filters. Useful for calendars to pull a month at a time instead of the full 2000-row default.
- **Regression suite**: 18 new pytest tests under `/app/backend/tests/` — `test_cache_and_filters.py` (6) + `test_cache_invalidation_regression.py` (12). All passing.

**Verified end-to-end** by testing agent (iteration 25, 18/18 backend pass) + visual screenshots — tenant logo now renders correctly on `/{slug}/login` co-brand row AND as the navbar badge after login.


### Feature - Jun 2, 2026
**Compliance Alerts grouped by type + new AI-styled Booking Intelligence panel.**

**A) Compliance Alerts grouping (`ComplianceAlerts.js`):**
- Replaced flat critical/warning/upcoming list with **per-type sections**: Tax · NCT · Insurance · Service.
- Each section shows: colour dot + icon + label + "{n} outstanding" + severity badges (e.g. "2 critical", "1 due soon", "3 upcoming").
- Within each section issues sort critical → warning → upcoming (severity order preserved).
- Empty sections auto-hide (no noise for tenants who don't track all 4).
- Cleared-by-admin and Adjust Settings rows preserved at the bottom.
- Test IDs: `compliance-section-tax`, `compliance-section-nct`, `compliance-section-insurance`, `compliance-section-service`.

**B) Booking Intelligence (`BookingIntelligence.js` + `.css`):**
- New "alive and breathing" AI-styled scanner mounted at top of `Bookings.js` (admin-only).
- Deterministic analysis pass (instant, free, no LLM, never hallucinates) over upcoming 14-day window:
  1. **Vehicle conflicts** — same car double-booked
  2. **Driver conflicts** — same person on two cars simultaneously (covers creator + assignee + secondary user)
  3. **Compliance risk** — booking falls on/after the vehicle's tax/NCT/insurance expiry
  4. **Idle vehicles** — cars with zero bookings in next 14 days
- For each conflict computes concrete fixes: alternative free vehicles + ±2h / ±1d slot shifts on the same car. Clicking a suggestion calls `bookingAPI.update` with the proposed car_id / start_time / end_time.
- AI-styled visual treatment (CSS-only animations, no framer-motion dependency):
  - Conic-gradient spinning border (`bi-border-glow`, 9s rotation, conic + `@property --bi-angle`)
  - 18 floating particle dots drifting upward (`bi-particles`)
  - Pulsing purple brain orb with 3 sparkles in orbit
  - Gradient-shifting title text (purple → cyan → pink)
  - Green pulsing "LIVE" badge with heartbeat dot
  - Scanning bar during analysis + typewriter cursor in subtitle
  - Live stat tiles with periodic sheen sweep + heartbeat re-render
  - Cards have fade/slide-in entrance + neural top-border accent
- VERIFIED on preview using a real Ford Focus booking with imminent tax expiry — panel renders, scans, detects 2 compliance risks + 4 idle vehicles, filter chips work, suggestions row appears on conflict cards.



### UX Change - Jun 2, 2026
**Hide Legal & Compliance entry points inside the app.**
- Removed the Scale ⚖️ icon link to `/legal` from `Navigation.js` desktop purple navbar (was visible to every logged-in user).
- Stripped legal link row from in-app `Footer.js` (Legal / Terms / Privacy / DPA / Cookies / Security / Contact). Footer now shows only the copyright line.
- Pages themselves remain reachable at their direct URLs (`/legal`, `/terms`, `/privacy-policy`, `/dpa`, `/cookies`, `/security`, `/contact`) — required for GDPR/cookie compliance. The public landing page footer also still links to them for visitor discoverability.



### Feature - Jun 2, 2026
**White-labelled tenant login page with "Powered by Quick Wing" badge.**
- `GET /api/tenants/by-slug/{slug}` extended (public endpoint) to also return `logo_url` + `primary_color` from the tenant's settings — safe to expose pre-auth and lets the login screen brand itself before the user signs in.
- `TenantLogin.js` header redesigned:
  - Tenant logo (h-24, max-w-240px) rendered front-and-centre when present
  - Tenant name + "Fleet Management Portal" caption beneath
  - "POWERED BY [Quick Wing logo]" badge below the tenant identity (small, h-5, 80% opacity — present but subordinate)
  - Image `onError` handler falls back to QW-only branding if a tenant logo ever fails to load
- When no tenant logo is uploaded the page falls back to the original Quick Wing-only layout (no regression for new tenants who haven't configured branding yet).
- Footer "Powered by Quick Wing" line removed when the header already shows the badge — prevents double-branding.
- Verified on preview with BUMBLEance logo applied to test-fleet tenant — login page renders bumblebee logo at top, "POWERED BY Quick Wing" badge below.



### Feature - Jun 2, 2026
**Per-tenant logo branding in navbar + persistent upload mechanism.**
- `Navigation.js`: navbar now fetches `/api/tenant/settings.branding.logo_url` on tenant context change and renders the logo in place of the "Quick Wing" wordmark. Falls back to wordmark on missing/broken logo. Same logic applied to mobile header. Max-w 220px desktop / 140px mobile, h-12 / h-9, drop-shadow for purple background contrast.
- `TenantDashboard.js` logo uploader rewritten to:
  - Convert file to base64 data URL client-side
  - PUT to `/api/tenant/settings` (instead of multipart `/upload-logo` which writes to local disk)
  - Survives every redeploy — logo persists in MongoDB tenant document, no filesystem or S3 dependency
  - Size cap reduced to 1.5 MB (base64 grows ~33%; keeps wire payload < 2 MB)
  - "Remove logo" button now actually persists the removal to the backend (previously it only cleared local state).
- **BUMBLEance production**:
  - Enabled `custom_branding` feature override via super-admin API
  - Uploaded their bumblebee-ambulance logo as base64 data URL (95 KB) — confirmed via `GET /api/tenant/settings` returning `branding.enabled: true` and `logo_url` length 95606
  - Their navbar will display the new logo on next frontend redeploy
- Per-tenant uploader available to all clients once `custom_branding` is enabled on their plan/override.



### Feature - Jun 2, 2026
**Booking "Assign To" — admin books a car on behalf of any team member.**
- New field `assigned_to_user_id` on `BookingCreate`, `BookingUpdate`, `Booking` (Pydantic + Mongo).
- `POST /api/bookings` accepts `assigned_to_user_id`:
  - Admin-only (403 for staff).
  - Validates assignee is an active member of the same tenant (via `db.memberships` lookup, not embedded array — that was a misread of the data model and produced a bug during testing).
  - Overwrites `user_name` with the assignee's stored name so all pills, the Live Sheet, calendar cells, and CSV exports show the right person.
  - Conflict check runs against the **assignee's** schedule (not the admin's) — same person can't be double-booked across two cars at the same time. Admin's own conflict check is skipped when assigning to someone else.
- `GET /api/bookings?user_id=X` now matches bookings where the user is the creator, secondary user, OR assignee — so the staff member sees admin-assigned bookings in their "My Bookings" feed.
- Staff edit/delete permission extended: assignee can also modify a booking that was created for them.
- `Bookings.js` UI: admins see a new **Assign To** dropdown above the user_name field (defaults to "Myself — {admin}"). Picking a member auto-fills the display name and shows a purple info-pill: "This booking will appear in {Name}'s My Bookings".
- VERIFIED end-to-end: admin assigns booking to Alice → backend stamps the right fields → conflict on second booking returns 400 with assignee name → Alice's login lists the booking.

### Operational Change - Jun 2, 2026
**Quick Wing Support user removed; auto-seed disabled.**
- Deleted production user `support@quickwing.com` ("Quick Wing Support") via super-admin API; tenant memberships purged at the same time.
- `seed_support_admin()` call commented out of `startup_event` in server.py.
- Auto-attach Support Admin to new tenants (in tenant create flow) commented out.
- Both blocks left in place with comments so the feature can be re-enabled by uncommenting if Quick Wing ever wants cross-tenant support backdoor again.



### Feature - Jun 2, 2026
**Unified purple branded header — consolidated two stacked bars into one cohesive nav.**
- `Navigation.js` desktop header: white background → deep purple gradient (`#2e1065 → #4c1d95 → #6d28d9 → #4c1d95`). Logo, nav items, badges, buttons all restyled for white-on-purple contrast with white-glow active state.
- Removed desktop notification bell (line that rendered for staff only) — Karen's request, push notifications + emails cover the need.
- `TenantDashboard.js` purple banner (Row 2): removed `<NotificationBell>` and the standalone Settings button. Both were redundant — bell duplicated row 1's, Settings duplicated the Admin page's own Settings tab.
- `tabs` array for admins: removed `{ id: 'bookings', label: 'Bookings' }` sub-tab — Row 1 `/bookings` link is the single source of truth. Staff "My Bookings" tab unchanged.
- Net result: 3 stacked toolbars → 2 (purple Row 1 global + purple Row 2 tenant context) + dark sub-tabs ribbon underneath. Brand colour now dominant; admin has fewer paths to remember.



### Bug Fix - May 29, 2026 (P0 — production reported)
**Show Credentials page only displayed ONE Master Admin even when a tenant has multiple co-owners.**
- ROOT CAUSE: `Admin.js:fetchCredentials` set `masterAdmin: users.find(u => u.role === 'master_admin')` — `.find()` returns only the first match. When Karen + Nathan were both set as `master_admin` for Bluebird Care Dublin South, Karen (alphabetically later) silently dropped out of the Master Admin card and ended up in the generic "Franchise Users" table. `PlatformAdmin.js` had the same pattern in its tenant list.
- FIX:
  - `Admin.js`: state shape `masterAdmin` (single) → `masterAdmins` (array). UI now maps over the array, rendering one Master Admin card per owner. Generic "Franchise Users" list now excludes ALL master_admins (was only excluding the first one — Karen was being duplicated).
  - `PlatformAdmin.js`: tenant rows now show every master_admin's name + email; if there's more than one, a `{n} owners` chip appears next to the first. "Other admins" filter correctly excludes the full set of master_admins, not just the first.
- VERIFIED: production data confirmed via super-admin impersonation — both Karen O'Sullivan and Nathan Sweeney are `master_admin` + active in Bluebird Care Dublin South. After redeploy the Show Credentials page will render both Master Admin cards.



### Bug Fix - May 29, 2026 (P0 — production reported)
**"Failed to block car" error on Admin → Cars → Block for Appointment.**
- ROOT CAUSE: `Admin.js:handleBlockCar` and `handleUnblockCar` called `carAPI.block(id, data)` and `carAPI.unblock(id, data)` — but `carAPI` in `/app/frontend/src/api/api.js` never had `block` / `unblock` methods defined. The call threw `TypeError: carAPI.block is not a function` which fell into the catch block as a generic "Failed to block car" message.
- FIX: Added the two missing methods to `carAPI`:
  - `block(id, data)` → `POST /api/vehicles/{id}/block` with `{ reason, notes? }`
  - `unblock(id, data)` → `POST /api/vehicles/{id}/unblock`
- VERIFIED on preview: full block + unblock cycle returns HTTP 200; vehicle status flips Free → "Blocked - Service" → Free with status_updates log entries written.
- `FleetVehicleCard.js` and `TenantDashboard.js` were unaffected (they use direct axios calls or only read `is_blocked`).



### Bug Fix - May 29, 2026 (P0 — production reported by paying client)
**Reset Password "screen goes blank" — Team management page silent failure.**
- ROOT CAUSE: `TenantDashboard.js:handleResetPassword` used `window.prompt()` and posted only `{ new_password }` to `/api/tenant/users/{id}/reset-password`. The backend `TenantResetPasswordRequest` Pydantic model requires BOTH `admin_password` AND `new_password`. Every call was rejected with HTTP 422 "Field required: admin_password". The error toast appeared briefly then auto-dismissed — to the user the "screen goes blank" after pressing OK.
- FIX:
  - New `ResetUserPasswordModal.js` component — proper modal with admin password confirmation, new password, confirm new password, show/hide toggles, inline error display for wrong admin password (HTTP 401), and minimum 6-char validation.
  - Replaced `window.prompt()` flow in `TenantDashboard.js`; mounted modal at root, wired both Reset Password buttons (admins + staff) to open it with `setResetPwUser({id, name, email})`.
  - On success: toast "Password updated for {Name}", modal closes, `fetchData()` refreshes team list.
- VERIFIED on preview: all 3 HTTP paths confirmed via curl (422 with old payload, 200 with both fields, 401 with wrong admin password). Modal end-to-end test passed — admin entered password + new password, submit, success toast, modal closed.
- `Admin.js` already had a correct modal — only the secondary TenantDashboard.js team management view was broken.



### Bug Fix - May 15, 2026 (P0 customer-reported)
**Live Fleet Sheet had empty Location / Time / Booked By / Notes columns for every car, including In Use / Booked vehicles.**
- ROOT CAUSE: `statusAPI.getLive()` just calls `/api/vehicles` which returns vehicle records with no booking join. `LiveSheet.js` then wrapped each vehicle as `{ car, latest_status: null }` — `latest_status` was always null, so every row showed dashes.
- FIX (`/app/frontend/src/pages/LiveSheet.js`):
  - Fetch vehicles + bookings in parallel; client-side join keyed by `car_id`.
  - For each car, find the booking whose `[start_time..end_time]` window covers "now" — that becomes the active booking shown in the row.
  - If no active booking, surface the next upcoming booking starting within 24 h (labelled "Next: ..." in amber) so dispatchers see who's about to take the car.
  - Cancelled/rejected bookings ignored; recurring detection unified.
  - Synthesised `latest_status` populates Location, Start/End time, Booked By, Notes — all visible without any backend changes.
  - Renamed columns: "Last Updated" → "Booking Time", "Updated By" → "Booked By". CSV export updated to match.
- VERIFIED on preview: live booking for Ford Focus (Karen O'Sullivan, Cork CUH, "Client visit - Cork Hospital") renders the In Use row with full booking detail; Free cars stay as dashes.
- Works tenant-agnostic (single shared component reading `bookingAPI.getAll()`), so applies to every paying client uniformly.



### Bug Fix - May 14, 2026 (P0 customer-reported)
**All Cars Calendar disagreed with /bookings page for the same tenant.**
- ROOT CAUSE 1 — `AllCarsCalendar.js` matched bookings only on `start_time === day` instead of doing a date-range overlap. Multi-day bookings (and single records that hold a recurring series with start=day1 end=dayN) appeared on day 1 only, while the Bookings page used range overlap and showed them across every day. With 36-vehicle Bluebird fleet running many recurring schedules, the Fleet view showed 2 events while Bookings showed 16+ for the exact same data.
- ROOT CAUSE 2 — `GET /api/bookings` capped at 100 records. Large active tenants would silently truncate; raised default to 2000 (clients can still narrow with `limit`).
- FIX:
  - `getBookingsForDay(date)` in `AllCarsCalendar.js` now uses `bookingStart <= dayEnd && bookingEnd >= dayStart` (overlap), mirroring `Bookings.js:getBookingsForDate`.
  - `monthStats` switched to overlap-with-month-range so multi-day bookings starting in a prior month still count toward "This Month".
  - Recurring detection now checks `is_recurring === true || recurring_group_id` (matches Bookings.js).
  - `list_bookings` default `limit` raised from 100 to 2000.
- VERIFIED on preview: created a May 18–25 multi-day booking, All Cars Calendar now renders "07:00 Ford Focus" on all 8 days (previously only May 18).



### Feature - May 14, 2026
**Compliance Alert Acknowledgments + Insurance Renewal Tracking:**
- New collection `compliance_acks` storing per-vehicle per-issue admin actions
- Backend endpoints:
  - `GET /api/compliance/acknowledgments` — list active acks for tenant
  - `POST /api/compliance/acknowledgments` — upsert ack `{vehicle_id, type, action, ref, note?}` (action ∈ `actioned`/`dismissed`, type ∈ `tax`/`nct`/`insurance`/`service`/`driver_licence`)
  - `DELETE /api/compliance/acknowledgments/{id}` — restore (re-show alert)
- Each ack keyed by current `due_date` (or mileage for service) — when the vehicle is renewed (date changes) the ack becomes stale and the alert resurfaces automatically. No manual reset required.
- New vehicle field `insurance_due_date` (resources.py + Mongo + bulk-import CSV/Excel + EditVehicleModal + Admin.js Add Car form)
- New compliance settings: `enable_insurance_alerts` (default true), `insurance_warning_days` (default 60)
- `ComplianceAlerts.js` rewritten to compute issues across **tax + NCT + insurance + service**, hide acknowledged items, render expandable "Cleared by admin" section with actor + date + Restore button per cleared item
- Each unacknowledged issue card now shows **Actioned** / **Dismiss** buttons; "leave as alert" = no action
- ComplianceSettingsModal adds Insurance Renewal toggle + warning days input
- Admin "Manage Cars" page now shows insurance date alongside tax/NCT
- Verified end-to-end on preview: 4→3→2 issue count, toasts, cleared list, restore flow, actor name capture, insurance critical/warning bands all working



### Feature - May 13, 2026
**Fleet tab search & brand-chip filters extended to all sub-views (Admin Panel parity):**
- Added search bar + `BrandChips` to **Fleet > Car Calendars** sub-tab in `TenantDashboard.js` (filters `CarBookingCalendar` grid live)
- Added search bar + `BrandChips` to **Fleet > All Cars Calendar** sub-tab (filtered vehicle list passed to `AllCarsCalendar` component)
- Added search bar + `BrandChips` to the secondary "Fleet Vehicles" management view (`activeTab === 'vehicles'`) for defensive coverage
- All three reuse the existing `vehicleSearch` / `brandFilter` state — filter persists when switching between Live Status / Car Calendars / All Cars Calendar for consistent UX
- Test IDs: `car-calendars-search-input`, `car-calendars-brand-chips`, `all-cars-search-input`, `all-cars-brand-chips`, `manage-fleet-search-input`, `manage-fleet-brand-chips`
- Verified live on preview env (`/test-fleet`) — Ford filter narrows 6 vehicles to 2, brand chips render with counts (`Ford 2`, `Hyundai 2`, `Toyota 2`)

## Recent Changes (Feb 2026)

### Bug Fix - Mar 1, 2026 (P0 PRODUCTION BLOCKER)
**Resend Invitation / Reset Password — "User is not a member of this tenant"**
- ROOT CAUSE: `POST /api/tenant/users/{user_id}/resend-invitation` queried `db.tenant_users` (a dead/empty collection). All other tenant-user endpoints correctly use `db.memberships`. Cross-collection bug — would always 404.
- FIX: 1-line change in `server.py` line 10365 — `db.tenant_users.find_one(...)` → `db.memberships.find_one(...)`.
- ALSO FIXED in same patch (server.py linter F821 errors that would have caused 500s):
  - Line 507 `uuid4()` → `uuid.uuid4()` (GDPR `delete_user_account`)
  - Line 541 `uuid4()` → `uuid.uuid4()` (GDPR `record_consent`)
  - Line 2174 `uuid4()` → `uuid.uuid4()` (platform `add_user_to_tenant`)
  - Line 10119 lazy-import for `resend` module + `SENDER_EMAIL` (lead-capture email path was unimported, would crash on first lead)
- TESTING: 10/10 pytest tests pass — happy path + 404 negative + cross-tenant isolation + GDPR endpoints (`/app/backend/tests/test_invite_resend_and_gdpr.py`).
- UNBLOCKS: Bluebird Care + all future tenants — staff onboarding emails now reliably re-issuable from the admin UI.

### New Features - Feb 28, 2026
**Incident Reports (per-tenant):**
- New collection `incidents` + `incident_form_configs` in MongoDB
- Backend endpoints:
  - `GET /api/incidents` — list (admin sees all, staff sees their own)
  - `GET /api/incidents/stats` — dashboard stats (week/month/year/total, by severity/type/car/staff, unresolved count)
  - `POST /api/incidents` — log (any authenticated user; staff submissions trigger dashboard notifications to all tenant admins)
  - `PATCH /api/incidents/{id}` — edit/resolve (admin)
  - `DELETE /api/incidents/{id}` — (admin)
  - `GET /api/incidents/export` — CSV export
  - `GET /api/incidents/form-config` — fetch staff-facing form config
  - `PUT /api/incidents/form-config` — admin customises which fields appear
- Photos: up to 5 per incident, compressed client-side to 1280px JPEG @ 80% quality, stored as base64 in the doc
- Status workflow: `open` → `resolved` (with `resolved_at` + `resolved_by` audit fields)
- Types: Damage / Accident / Breakdown / Theft / Fuel / Near-miss / Other
- Severity: minor / moderate / severe
- Frontend:
  - NEW component `/app/frontend/src/components/IncidentReportsSection.js` (admin dashboard + staff button + log/edit modal + form-builder modal)
  - Wired into `TenantDashboard.js` as new Reports sub-tab "Incident Reports"
  - Staff see a prominent "Report Incident?" card on their Live Fleet Status landing view with red CTA
  - Admin form-builder lets them toggle which optional fields (location, cost, police#, insurance#, photos) appear on the staff submission form + which are required
- Tested end-to-end: creation, listing with car/staff name enrichment, stats aggregation, all working ✓


- Replaced 3-tier plan picker (Standard/Essential/Professional) in tenant creation with a **single Custom Plan form** — super admin enters `Number of Cars`, `Number of Staff`, `Monthly Cost (€)` directly
- Added `TenantPlan.CUSTOM` enum value, added `custom_price` field to `TenantCreate` model, added `monthly_price` to tenant DB doc
- Default plan in form = `custom`; old tier UI removed
- Confirmed via curl: creating with `plan=custom, custom_max_vehicles=17, custom_max_users=22, custom_price=249` correctly stores all three values
- Landing page tweaks:
  - Removed "Built for Irish fleets" hero badge
  - Removed "Trusted by Irish businesses" mention from hero subtitle
  - Removed entire "Trusted by Irish businesses" industries strip section
  - Updated Product Tour images to use newer screenshots (IMG_6022/6023/6024)
- ROI Calculator polish:
  - Hourly rate slider range changed from €10–€60 to €10–€40
  - Restructured headline as **twin equally-prominent cards**: "You save €X/year" (emerald) + "You free up Y hrs/week" (blue)
- Files: MODIFIED `/app/backend/models/tenant.py`, `/app/backend/server.py`, `/app/frontend/src/pages/PlatformAdmin.js`, `/app/frontend/src/pages/LandingPage.js`, `/app/frontend/src/components/ROICalculator.js`
- DB cleanup: removed 1685 orphan users left behind from earlier tenant deletion

**Cross-Tenant Support Admin + Tenant Cleanup:**
- Deleted all 43 pre-existing test/demo tenants and their data (1601 vehicles, 151324 bookings, orphan users) — kept Super Admin intact
- New seeded user `support@quickwing.com` / `QuickWing123!` — name "Quick Wing Support", role `master_admin`
- This account does NOT force password change (shared credentials must remain stable across tenants)
- `create_tenant` endpoint auto-attaches Support Admin to every new tenant with `master_admin` role (full equal access to the tenant Master Admin)
- Confirmed: same credentials work across multiple tenants — login response returns all attached tenants, each with `master_admin` role
- Files: MODIFIED `/app/backend/server.py` (added `seed_support_admin()` + `SUPPORT_ADMIN_*` constants, hooked into startup, hooked into `create_tenant`)

**Tenant URL Generation Fix:**
- Tenant login URLs and QR codes were using `FRONTEND_URL` env var which Emergent's deployment auto-populates with the deployment hostname (e.g. `cartrack-19.emergent.host`)
- New `get_public_url()` helper returns `QUICK_WING_PUBLIC_URL` env var or hardcoded `https://quick-wing.com` — ignores `FRONTEND_URL`
- Applied to: tenant creation `login_url`/`staff_login_url`, user creation `staff_login_url`, vehicle QR code generation
- Files: MODIFIED `/app/backend/server.py`

**Bulk Vehicle + Staff Import (Platform Admin onboarding):**
- New backend endpoint `POST /api/vehicles/bulk-import` accepts CSV upload, validates per row, inserts valid rows, returns per-row success/failure summary
- New backend endpoint `POST /api/users/bulk-import` accepts CSV (`name`, `email`, `role`), creates user accounts with default password `QuickWing123!` and `require_password_change=True`, creates membership records
- CSV columns (vehicles): `name` (required), `registration` (required), `current_status`, `tax_due_date` (YYYY-MM-DD), `nct_due_date` (YYYY-MM-DD), `current_mileage`, `service_due_mileage`, `base_location`
- CSV columns (staff): `name` (required), `email` (required), `role` (optional, defaults to `staff`; allowed: `staff`, `admin`, `master_admin`)
- Both endpoints validate duplicates (against existing tenant data AND within the CSV itself), required fields, format errors, plan limits
- Fail-soft model: imports valid rows, returns failed rows with row number + reason — user can download an error report CSV
- Frontend tabbed modal `/app/frontend/src/components/BulkImportVehiclesModal.js` — tabs (Vehicles | Staff), 2-step flow per tab, results panel with summary tiles, error table, AND for staff: credentials table showing each user's email+role+temp password with a "Copy all credentials" clipboard button
- Button is gated on `user.role === 'super_admin'` OR `user.is_impersonating === true` — only platform admins see it on the Fleet Vehicles page
- All bulk-imported staff are forced to change password on first login (verified working)
- Files: NEW `/app/frontend/src/components/BulkImportVehiclesModal.js`, MODIFIED `/app/backend/server.py` (vehicles endpoint at line ~3858, users endpoint at line ~4032), MODIFIED `/app/frontend/src/pages/Admin.js`

**ROI Calculator on Landing Page:**
- New interactive ROI calculator section between the demo carousel and contact section
- Inputs (sliders): number of fleet managers (1-20), hours/week each spends on admin (1-40), hourly rate (€10-€60, default €18). Time-saved % is locked at 70% (Quick Wing's proven claim)
- Animated outputs: total annual savings, hours freed up per week, savings per week/month, before/after annual cost comparison
- "Book a Free Demo" CTA opens email to lee.quickwing@gmail.com with subject "Quick Wing Demo Request — ROI Calculator"
- File: `/app/frontend/src/components/ROICalculator.js`
- Wired into `/app/frontend/src/pages/LandingPage.js`

**Landing Page Redesign (Feb 28, 2026):**
- Replaced 6-icon flat features grid with asymmetric Bento Grid (hero "Smart Booking" card with mocked overlapping booking pills, Compliance/Real-Time cards with status pills, dark essentials banner)
- Replaced screenshot carousel with interactive tabbed `ProductShowcase` — clickable feature cards on the left, macOS-style browser frame on the right with cross-fading screenshots, auto-advances every 6s
- Softened overall aesthetic: bg-slate-50, rounded-3xl, ambient shadows, sticky nav backdrop blur, "Built for Irish fleets" badge
- Files: rewrote `/app/frontend/src/pages/LandingPage.js`

## Recent Changes (April 2026)

### New Features - April 10, 2026
**All Bookings List Report:**
- Added new "All Bookings List" section in Fleet Reports with:
  - Custom date range selector (defaults to last 30 days)
  - CSV export functionality with all booking details
  - Full table view with User, Vehicle, Start Time, End Time, Status, Route
  - Badge showing total booking count
  
**Collapsible Report Sections:**
- All report sections now have a collapsible feature with chevron icon in top right
- Sections include: Summary Statistics, All Bookings List, Most Booked Cars, Daily Availability Report, Compliance Report, By Location Summary
- Click header to toggle section open/closed
- State persists while on the page

### Bug Fixes - April 10, 2026
**QR Code Fix:**
- Fixed `VehicleQRCode.js` component to accept `tenantSlug` as a prop instead of using `useParams()`
- This fix ensures the QR code URL is correctly generated even when the user is on routes without the tenant slug in the URL (e.g., `/dashboard`)
- Updated `TenantDashboard.js` to pass `activeTenant?.tenant_slug` to the VehicleQRCode component
- QR codes now correctly encode URLs like: `{baseUrl}/{tenant_slug}/vehicle/{vehicle_id}/mileage`
- **Admin Panel QR Fix**: Fixed QR download in Admin Panel > Fleet Vehicles. The download function now uses axios with proper Authorization headers and blob response type, instead of trying to download directly via a link (which didn't send auth headers)
- **Critical: QR codes scanning to wrong franchise fix**: When platform admins (super_admin) navigated to a tenant route without direct membership, they weren't getting a tenant-scoped token. This caused QR codes to generate with the wrong/missing tenant slug. Fixed by auto-selecting tenant by slug lookup when platform admins navigate to a franchise route.

**Booking Conflict Detection Fix:**
- **Critical bug fixed**: The booking system was NOT checking if a vehicle was already booked for a time period. This allowed double-booking of vehicles by different users.
- Added vehicle conflict check in `POST /api/bookings` endpoint that rejects bookings when the vehicle is already booked
- Added vehicle conflict check in `PUT /api/bookings/{id}` endpoint for booking updates
- Changed status exclusion from `"rejected"` to `["rejected", "cancelled"]` for accurate availability
- Clear error messages: "Vehicle is already booked at this time by {user} (starts: {time})"

**Smart Car Recommendations on Conflict:**
- Added new endpoint `GET /api/bookings/check-availability` that returns conflict info AND available alternatives
- When user selects a car/time that conflicts, the system now recommends available cars
- Frontend shows clickable green buttons for each available car (e.g., "Van 2 (STD-002)")
- Clicking a recommended car auto-selects it in the form
- Also shows "No other cars available" message if all cars are booked at that time

**Wingman AI Chatbot (April 12, 2026):**
- Added AI-powered chatbot widget to the landing page (bottom-right corner)
- Uses Gemini 3 Flash via emergentintegrations for fast, cost-effective responses
- Chatbot knows about Quick Wing features: fleet management, compliance tracking, QR mileage, staff app, etc.
- Lead capture form appears when users ask about demos, pricing, or contact
- Email notifications sent to lee.quickwing@gmail.com when leads are captured
- Backend stores conversations in `chatbot_conversations` collection
- Leads stored in `chatbot_leads` collection with status tracking
- API endpoints: `POST /api/chatbot/message`, `POST /api/chatbot/capture-lead`, `GET /api/chatbot/conversation/{session_id}`

**"+ Book" Button Redirect:**
- Modified `CarBookingCalendar.js` to support a `redirectToBookings` prop
- When `redirectToBookings={true}`, clicking the "+ Book" button navigates to the main bookings page instead of opening an inline modal
- The navigation uses the correct tenant-prefixed route: `/{tenant_slug}/bookings`
- State is passed with `selectedCarId` for potential pre-selection functionality
- Updated `TenantDashboard.js` Fleet > Car Calendars section to use `redirectToBookings={true}`

### Feature Updates - April 7, 2026
**Removed:**
- Maps features removed entirely
- Map tab removed from admin panel
- Updates/Deployment notes tab removed from navigation
- FleetMap.js component deleted

**Booking Enhancements:**
- **Recurring booking approval**: Bookings exceeding 4 straight weeks now require admin approval
- **Double-up call feature**: Can add a secondary user to a booking
  - Secondary user's booking also populates their calendar
  - System checks for conflicts to avoid double-booking same car/time
- New API endpoints: `/api/bookings/pending-approval`, `/api/bookings/{id}/approve`, `/api/bookings/{id}/reject`

**Fleet Reports & Analytics:**
- Fixed authentication headers for report fetching
- Reports section fully functional with date filtering and CSV export

### Compliance Warning System - COMPLETED ✅ (April 7, 2026)
- **Dashboard Compliance Alerts**: New `ComplianceAlerts` component on Overview tab
  - Shows critical/warning/upcoming issues for Tax, NCT, and Service Due
  - Color-coded severity (red=critical, amber=warning, green=compliant)
  - Settings gear icon to configure reminder thresholds
- **Custom Reminder Settings**: 
  - Tax warning: configurable days before due (default 60/2 months)
  - NCT warning: configurable days before due (default 60/2 months)
  - Service warning: configurable km before due (default 10km)
  - Each alert type can be enabled/disabled individually
  - Settings saved per-tenant
- **Manage Vehicles Tab**: Added "Reminders" button to access compliance settings
- **Fleet Reports**: New "Compliance Report" section showing:
  - Tax/NCT/Service status summary
  - List of vehicles with issues
  - Settings note showing current thresholds
- **API Endpoints**:
  - `GET /api/tenant/settings` - includes compliance settings
  - `PUT /api/tenant/settings/compliance` - update compliance thresholds

### Staff Mobile View - REDESIGNED ✅ (April 7-8, 2026)
- **Visual Redesign** matching user-provided reference images:
  - Clean white/light gray background (#F8F9FA)
  - Vibrant blue accent (#007BFF) for buttons and active states
  - Green indicators (#22C55E) for available status
  - Amber/yellow highlights (#FCD34D) for selected items
  - 2-column vehicle grid with card shadows
  - Toggle-style status indicators
- **Simplified 3-Tab Interface** for staff/driver users on mobile:
  1. **Home** - Dashboard with stats cards (Available/In Use), Live Fleet Status with 2-column vehicle grid
  2. **Bookings** - Car selection chips, date navigator, time slots grid, New Booking form
  3. **Lift** - Request a Lift form with all fields pre-validated
- **Technical Fixes**:
  - Fixed initial render timing: now checks both localStorage flag AND activeTenant.role
  - Screen properly fits mobile viewport (100dvh with fixed positioning)
  - Refresh persists correctly via localStorage 'qw_staff_mobile_user' flag
  - Bottom navigation is static and fixed to screen
  - Body scroll is locked for proper app-like behavior
- **Test User**: teststaff@standard-fleet.com / teststaff123

### Fleet Map & Journey Tracking - COMPLETED ✅ (April 2026)
- **Journey Map Tab**: New sub-tab under Fleet for Essential and Professional tiers
- **Mandatory Journey Fields**: Bookings now require start_eircode and end_eircode
- **Optional Stops**: Support for journey stops along the route
- **Interactive Map**: Uses react-leaflet with OpenStreetMap tiles
- **Color-Coded Routes**: Each vehicle's journeys shown in distinct colors
- **Eircode Geocoding**: MOCKED - Uses hardcoded Dublin area coordinate mapping (D01-D24, Cork T12/T23/T45, Galway H91)
- **Tier-Gated**: Only available for Essential and Professional tiers via show_map/map_booking_pins features

### All Cars Calendar Enhancement - COMPLETED ✅ (April 2026)
- **Standardized Color Scheme**: Red=Booked, Purple=Recurring, Amber=Pending (matches app-wide standard)
- **Month Statistics Header**: Shows total bookings, confirmed, pending, recurring counts
- **Vehicle Filter Dropdown**: Filter calendar by specific vehicle
- **Improved Modal**: Booking details use correct colors for booking types
- **Better Organization**: Clearer visual hierarchy with gradient header

### Public QR Code Mileage Submission - VERIFIED ✅ (April 7-8, 2026)
- **No login required** - Anyone can scan QR and submit mileage
- **QR Code Generation**: 
  - Endpoint: `GET /api/vehicles/{vehicle_id}/qr` returns PNG image
  - QR encodes URL: `{baseUrl}/{tenant_slug}/vehicle/{vehicle_id}/mileage`
  - Download and Print functionality in Admin UI
- **Public Mileage Page** (`/{tenant}/vehicle/{id}/mileage`):
  - Vehicle name, registration, organisation displayed
  - Last recorded mileage shown
  - Optional "Your Name" field for accountability
  - Optional "Notes" field for reporting issues
  - Shows calculated difference from last reading
  - Service alerts displayed after submission (warning/urgent/overdue)
- **Public API Endpoints**: 
  - `GET /api/public/vehicle/{tenant_slug}/{vehicle_id}` - Get vehicle info (no auth)
  - `POST /api/public/vehicle/{tenant_slug}/{vehicle_id}/submit-mileage` - Submit mileage (no auth)
- **Service Alert Integration**:
  - Triggers when mileage within 1000km of service_due_mileage (warning)
  - Triggers when mileage within 500km of service_due_mileage (urgent)
  - Triggers when mileage exceeds service_due_mileage (overdue)

### Live Status Updates - COMPLETED ✅ (April 2026)
- Vehicle status now reflects **active bookings in real-time**
- When a booking is active (current time between start/end), vehicle shows "In Use"
- Active booking info displayed (user name, purpose, end time)
- Blocked vehicles always show "Blocked" status
- Status updates immediately without manual intervention

## Recent Changes (March 2026)

### Granular Feature Toggle System - COMPLETED ✅ (March 2026)
- **28 toggleable features** organized into 9 categories
- Feature Registry API: `GET /api/platform/feature-registry`
- Per-tenant feature overrides stored in `feature_overrides` field
- Addon pricing displayed for each sellable feature
- "Not in plan" indicators for features outside base tier
- Full documentation at `/app/docs/FEATURE_TIERS_REFERENCE.md`

### Updated Pricing (March 2026)
| Plan | Price | Vehicles | Users |
|------|-------|----------|-------|
| Standard | €179/mo | 10 | 15 |
| Essential | €299/mo | 25 | 35 |
| Professional | €499/mo | 50 | 50 |

### 3-Tier Subscription Plan System - COMPLETED ✅
- Implemented Standard (€179), Essential (€299), and Professional (€499) plans
- Backend enforcement: API returns 403 when vehicle/user limits are reached
- Frontend: Usage indicators show X/Y vehicles and X/Y users
- Frontend: Add buttons disabled with toast notifications when at limit
- Color-coded usage indicators: green (< 80%), amber (80-99%), red (100%)
- Legacy plan names (`starter`, `basic`, `pro`) mapped to new tiers

### Plan Comparison Page - COMPLETED ✅ (March 16, 2026)
- New "Plans" tab in Command Centre navigation
- Side-by-side comparison of all 3 plans with pricing
- Feature comparison with checkmarks for each plan tier
- "Most Popular" badge on Essential plan

### Feature Gating - COMPLETED ✅ (March 16, 2026)
- Reports tab shows "Limited Reports Available" warning for Standard plan
- Feature availability based on `planData.features` from /api/my-plan endpoint
- UI elements adapt based on tenant's effective features

### Monthly Customization Credits - COMPLETED ✅ (March 16, 2026)
- Customization credits tracking per tenant (Standard: 1, Essential: 2, Professional: 4)
- "Use Credit" and "Reset Credits" buttons in Feature Override Modal
- Credits visible in Manage Franchise section

### Super Admin Feature Overrides - COMPLETED ✅ (March 16, 2026)
- Feature Override Modal accessible from franchise cards in Plans tab
- Plan change buttons (Standard/Essential/Professional)
- Limit overrides: Max Vehicles and Max Users editable fields
- Feature toggles to override plan defaults per tenant
- Save Changes persists overrides to database

## Production Domain
- **URL:** https://quick-wing.com
- Path-based tenant URLs: `https://quick-wing.com/{tenant-slug}/login`

## Test Credentials

### Super Admin (Platform Owner)
- **URL:** https://quick-wing.com/login
- **Email:** superadmin@quickwing.com
- **Password:** Super123
- **Email:** admin.kerry-fleet@quickwing.com
- **Password:** KerryFleet123

---

## Architecture

### Multi-Tenant Model
- **Tenants**: Franchises/companies with isolated data
- **Users**: Global accounts with role-based memberships per tenant
- **Memberships**: Links users to tenants with specific roles

### Role Hierarchy (Simplified - March 2026)
| Role | Scope | Capabilities |
|------|-------|--------------|
| `super_admin` | Platform | Full platform control, create/manage all tenants |
| `master_admin` | Tenant | Franchise owner - pays subscription, manages their tenant |
| `admin` | Tenant | Manage tenant users, vehicles, settings |
| `staff` | Tenant | Book vehicles, view data within tenant |

### Data Isolation
- Every tenant-scoped record includes `tenant_id`
- All queries automatically filtered by tenant context
- Cross-tenant access blocked at application level
- Audit logging for sensitive operations
- Automated tenant isolation tests verify security

## Features

### 1. Platform Administration (Franchise Command Centre)
- **Overview**: Platform-wide statistics (tenants, users, vehicles, bookings)
- **Tenant Management**: Create franchises with auto-generated Master Admin credentials
- **User Management**: Create platform and tenant users
- **Audit Log**: View all security and action events
- **Impersonation**: Support access with full audit trail
- **Suspend/Reactivate**: Control tenant access for non-payment

### 2. Tenant Creation Flow
When creating a new tenant:
1. Super Admin fills in franchise name, slug, and plan
2. Optionally specifies Master Admin email and name
3. System auto-generates:
   - Master Admin user account
   - Secure 12-character password
   - Tenant-specific login URL
4. Credentials displayed in modal for sharing with franchise owner

### 3. Tenant Features (Per Franchise)
- **Dashboard**: Overview, weather, notifications
- **Vehicle Management**: Add/edit/delete fleet vehicles
- **Booking System**: Calendar-based reservations with conflict detection
- **Live Sheet**: Real-time fleet status
- **Reports**: Usage statistics and analytics
- **Team Management**: Add/remove staff members

### 4. Security Features
- JWT-based authentication with tenant context
- Role-based access control (RBAC)
- Tenant suspension for non-payment
- Complete audit trail
- IDOR prevention via TenantQueryBuilder
- Automated tenant isolation tests

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get token
- `POST /api/auth/select-tenant` - Switch active tenant
- `GET /api/auth/me` - Get current user info

### Platform (Super Admin)
- `GET /api/platform/tenants` - List all tenants
- `POST /api/platform/tenants` - Create tenant (returns Master Admin credentials)
- `PUT /api/platform/tenants/{id}` - Update tenant
- `POST /api/platform/tenants/{id}/suspend` - Suspend tenant
- `POST /api/platform/tenants/{id}/reactivate` - Reactivate tenant
- `POST /api/platform/tenants/{id}/impersonate` - Start impersonation
- `POST /api/platform/stop-impersonation` - End impersonation
- `GET /api/platform/stats` - Platform statistics
- `GET /api/platform/audit-log` - Audit events
- `GET /api/platform/settings` - Get company settings
- `PUT /api/platform/settings` - Update company settings

### Invoices & Reports (Super Admin)
- `POST /api/platform/invoices` - Create invoice
- `GET /api/platform/invoices` - List invoices (with filters)
- `GET /api/platform/invoices/{id}` - Get invoice details
- `PUT /api/platform/invoices/{id}` - Update invoice status
- `DELETE /api/platform/invoices/{id}` - Delete draft invoice
- `GET /api/platform/invoices/{id}/pdf` - Download invoice PDF
- `GET /api/platform/reports/executive-summary` - Get executive summary
- `GET /api/platform/reports/executive-summary/pdf` - Download executive summary PDF
- `GET /api/platform/reports/franchises` - Get franchises report
- `GET /api/platform/reports/franchises/pdf` - Download franchises report PDF
- `GET /api/platform/reports/invoices` - Get invoices report
- `GET /api/platform/reports/invoices/pdf` - Download invoices report PDF

### Tenant-Scoped (Requires tenant context)
- `GET /api/vehicles` - List vehicles
- `POST /api/vehicles` - Create vehicle (Admin only)
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/tenant/users` - List tenant users
- `POST /api/tenant/users` - Add user to tenant (Admin only)
- `GET /api/tenant/reports/summary` - Get tenant reports summary (Admin only)
- `GET /api/tenant/reports/vehicle-utilization` - Get vehicle utilization report (Admin only)
- `GET /api/tenant/reports/summary/pdf` - Download tenant analytics as PDF (Admin only)
- `GET /api/tenant/reports/summary/csv` - Download tenant analytics as CSV (Admin only)

## Database Schema

### Collections
- `tenants`: id, name, slug, status, plan, max_vehicles, max_users
- `users`: id, email, name, password_hash, is_active
- `memberships`: id, user_id, tenant_id, role
- `vehicles`: id, tenant_id, name, registration, status
- `bookings`: id, tenant_id, car_id, user_name, start_time, end_time
- `audit_events`: id, actor_user_id, tenant_id, action, resource_type
- `invoices`: id, invoice_number, tenant_id, items[], subtotal, tax_rate, tax_amount, total, status, due_date
- `company_settings`: id, company_name, address, tax_id, bank_details, invoice_prefix, currency

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@quickwing.com | Super123 |
| Master Admin (Kerry Care) | admin.kerry-care@quickwing.com | Rer6FQql1zWq |

## Status

### Completed (March 2026)
- [x] Multi-tenant database schema with tenant_id
- [x] Tenant isolation middleware with TenantQueryBuilder
- [x] JWT with tenant context
- [x] Platform Command Centre UI
- [x] Tenant creation with auto-generated Master Admin credentials
- [x] Tenant suspension/reactivation
- [x] Impersonation with audit logging
- [x] Role-based access control (Super Admin, Master Admin, Admin, Staff)
- [x] Tenant selector for multi-membership users
- [x] Security documentation (SECURITY.md)
- [x] Automated tenant isolation tests (pytest)
- [x] Data cleanup script (removed orphaned records)
- [x] Quick Setup Wizard for new Master Admins (onboarding flow)
- [x] Path-based branded tenant URLs (e.g., quick-wing.com/tenant-slug/login)
- [x] **PDF Export for Reports & Invoices** (March 2026)
  - Executive Summary PDF export
  - Franchises Report PDF export  
  - Invoices Report PDF export
  - Individual Invoice PDF export
  - Blue & white color scheme with Quick Wing branding
- [x] **Invoice Management CRUD** (March 2026)
  - Create invoices with line items, tax calculation
  - List invoices with filters (status, tenant)
  - Update invoice status (draft → sent → paid)
  - Summary stats (total, paid, pending)
- [x] **Rebuilt Tenant Dashboard** (March 2026)
  - New TenantDashboard.js with Overview/Vehicles/Bookings/Team tabs
  - Add Vehicle and Add Team Member modals
  - Fixed onboarding redirects for new tenants
- [x] **Reports & Billing Integrated into Command Centre** (March 2026)
  - Moved from separate page to tab in Franchise Command Centre
  - Sub-tabs: Executive Summary, Franchises Report, Invoices, Company Settings
- [x] **User Management Expansion** (March 2026)
  - View user details with all tenant memberships
  - Edit user role per tenant membership
  - Remove user from tenant
  - Add user to new tenant
  - Backend endpoint: POST /platform/users/{user_id}/add-to-tenant
- [x] **Legacy Dashboard Cleanup** (March 2026)
  - Simplified Dashboard.js to redirect to new TenantDashboard
  - Removed 700+ lines of legacy fleet status code
- [x] **Tenant-Specific Reports** (March 2026)
  - New Reports tab in TenantDashboard for admin users only
  - Fleet utilization percentage (vehicles used this month)
  - Bookings this month vs last month with trend percentage
  - Most Used Vehicles ranked list (top 10)
  - Bookings This Week visual bar chart (7-day rolling)
  - Summary Statistics section
  - Backend endpoints: GET /api/tenant/reports/summary, GET /api/tenant/reports/vehicle-utilization
  - Staff users cannot see Reports tab (admin/master_admin only)
  - **CSV/PDF Export** for franchise analytics reports
    - Export CSV: GET /api/tenant/reports/summary/csv
    - Export PDF: GET /api/tenant/reports/summary/pdf
    - Downloadable reports with all metrics, vehicle usage, and daily trends
- [x] **Enhanced Fleet Management Features** (March 2026)
  - **Request a Lift Sticky Button**: Full-width sticky button at bottom for staff on mobile
  - **Live Fleet Status Dashboard**: Real-time vehicle status with 30-second auto-refresh
    - Fleet summary stats (Total Cars, Free, In Use, Blocked)
    - Live indicator showing update frequency
    - Vehicle cards with status and booking capability
  - **Individual Car Calendars** (07:00-22:00)
    - Each vehicle has its own booking calendar
    - Time slots from 07:00 to 22:00 (hourly)
    - Color coding: Green=Free, Purple=Booked, Orange=Recurring
    - Day/Week view toggle
    - Click-to-book functionality
    - Booking modal with Name, Time, Notes, Recurring option
  - **All Cars Monthly Calendar** (Admin only)
    - Monthly calendar view of all bookings across fleet
    - Daily booking counts in corner of each day
    - Click-to-drill-down showing detailed booking list
    - Legend: One-time, Recurring, Pending
  - **New Components**: CarBookingCalendar.js, AllCarsCalendar.js, RequestLiftButton.js
  - **Role-Based Tabs**:
    - Staff: Live Fleet, Car Calendars, My Bookings
    - Admin: Overview, Live Fleet, Car Calendars, All Cars, Vehicles, Team, Reports
- [x] **QR Code Scanning & Mileage Update** (March 2026)
  - **QR Code Generation**: Each vehicle gets a unique QR code (format: QUICKWING:VEHICLE:{id})
  - **Vehicle QR Code Modal**: Download (PNG) and Print functionality
  - **QR Scanner**: Camera-based scanner for status updates
  - **Status Options**: Free, In Use, Needs Cleaning, Needs Repair
  - **Mileage Tracking**: Update current mileage on scan
  - **Location Tracking**: Update vehicle location
  - **Status History**: Full audit trail of all QR scan updates
  - **Real-time Updates**: Live Fleet dashboard refreshes to show updated info
  - **Components**: QRScanner.js, VehicleQRCode.js
  - **Endpoints**: POST /api/vehicles/{id}/scan-update, GET /api/vehicles/{id}/status-history
- [x] **Enhanced Vehicle Cards & Fleet Reports** (March 2026)
  - **Enhanced Vehicle Card Design** (FleetVehicleCard.js):
    - Current Mileage display with odometer icon
    - Service Due At (km) with service alert warnings
    - Tax Due Date, NCT Due Date
    - Base Location
    - Last updated timestamp + user
    - Service Alert Banners: Warning (1000km), Urgent (500km), Overdue (0km)
    - QR, Edit, Delete action buttons
  - **Block for Appointment Feature**:
    - Dropdown options: Service, Cleaning, Other (with icons)
    - Notes field (optional)
    - Blocked vehicles show red styling + "Unblock & Return to Fleet" button
    - Endpoints: POST /api/vehicles/{id}/block, POST /api/vehicles/{id}/unblock
  - **Edit Vehicle Modal** (EditVehicleModal.js):
    - All fields: Name, Registration, Status, Mileage, Service Due, Tax, NCT, Location
  - **Fleet Reports Section** (FleetReportsSection.js):
    - Summary Stats Cards: Total Vehicles, Total Bookings, Pending, Blocked
    - Most Booked Cars (Ranked) - Top 10 list
    - Daily Availability Report with donut chart visualization
    - By Location Summary with utilization %
    - Date filters (From/To)
    - Export CSV functionality
    - Endpoint: GET /api/tenant/fleet-reports, GET /api/tenant/fleet-reports/csv

### Pending (P1)
- [ ] Email notifications for invoices
- [ ] Automated invoice reminders for overdue payments

### Future (P2-P3)
- [ ] Dashboard analytics and charts

## Files Structure
```
/app/backend/
├── server.py              # Main API server (2400+ lines)
├── models/
│   ├── tenant.py          # Tenant, User, Membership models
│   ├── resources.py       # Vehicle, Booking, etc. models
│   └── invoice.py         # Invoice and CompanySettings models
├── middleware/
│   └── tenant.py          # Tenant isolation middleware
├── services/
│   ├── audit.py           # Audit logging service
│   └── pdf_service.py     # PDF generation for reports & invoices
└── tests/
    ├── test_tenant_isolation.py  # Automated isolation tests
    └── test_pdf_export.py        # PDF export tests

/app/frontend/src/
├── contexts/
│   └── AuthContext.js     # Multi-tenant auth context
├── pages/
│   ├── PlatformAdmin.js   # Franchise Command Centre
│   ├── TenantSelector.js  # Tenant selection page
│   ├── SetupWizard.js     # Onboarding wizard for Master Admins
│   ├── Login.js           # Updated login flow with tenant support
│   ├── Dashboard.js       # Main dashboard with wizard redirect
│   └── Reports.js         # Reports & Billing with PDF export
├── components/
│   ├── CarBookingCalendar.js   # Individual car booking calendar (07:00-22:00)
│   ├── AllCarsCalendar.js      # Monthly all-cars calendar with drill-down
│   ├── RequestLiftButton.js    # Sticky bottom button for staff mobile
│   ├── AdminTraining.js        # In-app training guide
│   ├── AnnouncementBanner.js   # Staff view - pending announcements banner
│   ├── AnnouncementsManager.js # Admin view - create/manage announcements
│   ├── DailyTimelineChart.js   # Hourly availability timeline chart
│   ├── FleetVehicleCard.js     # Detailed vehicle card with status
│   ├── NotificationBell.js     # Notification bell with polling & toast alerts
│   └── QRScanner.js            # Camera-based QR code scanner
└── components/ui/         # Shadcn UI components
```

## Testing
- Backend: 19/19 auth and platform tests passed (100%) - Dec 2025
- Backend: 25/25 PDF & Invoice tests passed (100%)
- Backend: 17/17 tenant isolation tests passed (100%)
- Backend: 15/15 fleet management tests passed (100%) - Mar 2026
- Backend: 20/20 fleet reports & block tests passed (100%) - Mar 2026
- Backend: 17/17 announcements & timeline tests passed (100%) - Mar 2026
- Frontend: All UI flows verified
- Tenant isolation: Verified via pytest and manual testing
- Test reports: `/app/test_reports/iteration_13.json`

## Recent Updates (March 2026)

### Staff Announcements Feature
- Create announcements with title, content, and priority (low/normal/high/urgent)
- Require staff acknowledgment before using the app
- Admin view: AnnouncementsManager to create/delete/view acknowledgment counts
- Staff view: AnnouncementBanner with Acknowledge button
- **Notification Bell with Polling**:
  - Bell icon with badge showing unread count
  - Dropdown with pending announcements and quick acknowledge
  - Toast notifications with sound alert for new announcements
  - 30-second polling interval for real-time updates
- Endpoints:
  - `POST /api/messages` - Create announcement
  - `GET /api/announcements` - List all announcements
  - `GET /api/announcements/pending` - Get unacknowledged for current user
  - `GET /api/announcements/unread-count` - Get count of unread
  - `POST /api/messages/{id}/acknowledge` - Acknowledge an announcement
  - `DELETE /api/announcements/{id}` - Delete announcement

### Daily Availability Timeline
- Hourly utilization chart (07:00-22:00)
- Summary cards: Total Fleet, Available, Peak Hour, Avg Utilization
- Date picker to view historical data
- CSV export functionality
- Endpoints:
  - `GET /api/tenant/reports/daily-timeline` - Get hourly availability data
  - `GET /api/tenant/reports/daily-timeline/csv` - Export as CSV

### Dashboard UI Consolidation
- **Main Tabs**: Overview, Fleet, Bookings, Team, Reports, Announcements
- **Fleet Sub-tabs**: Live Status, Car Calendars, All Cars Calendar, Manage Vehicles
- **Reports Sub-tabs**: Analytics, Fleet Reports, Daily Timeline
- Badge on Announcements tab showing unread count for admins
- Staff users see simplified tabs: Live Fleet, Car Calendars, My Bookings

## Scalability Assessment (Dec 2025)
**User Requirement**: 10 franchises, 20-30 cars per franchise, 15 admins + 30 staff per franchise

| Metric | Current Capacity | Required | Status |
|--------|-----------------|----------|--------|
| Tenants | Unlimited | 10 | ✅ Ready |
| Users per tenant | 999 (Enterprise) | 45 | ✅ Ready |
| Vehicles per tenant | 999 (Enterprise) | 30 | ✅ Ready |
| Role-based access | 4 roles | 4 roles | ✅ Ready |
| Data isolation | Full tenant isolation | Required | ✅ Ready |
| PDF exports | Working | Required | ✅ Ready |
| Invoicing | CRUD + PDF | Required | ✅ Ready |

### Plan Limits (Updated March 2026)
The platform now uses a 3-tier subscription model:

| Plan | Price | Max Vehicles | Max Users | Monthly Customizations |
|------|-------|--------------|-----------|----------------------|
| **Quick Wing Standard** | €179/month | 10 | 20 | 1 |
| **Quick Wing Essential** | €279/month | 25 | 35 | 2 |
| **Quick Wing Professional** | €399/month | 50 | 50 | 4 |

#### Feature Availability by Plan
| Feature | Standard | Essential | Professional |
|---------|----------|-----------|--------------|
| Vehicle Booking | ✅ | ✅ | ✅ |
| Fleet Compliance | ✅ | ✅ | ✅ |
| Basic Reports | ✅ | ✅ | ✅ |
| Enhanced Reports | ❌ | ✅ | ✅ |
| Detailed Reports | ❌ | ❌ | ✅ |
| Staff Calendars | ✅ | ✅ | ✅ |
| Admin All Cars Calendar | ✅ | ✅ | ✅ |
| Enhanced Booking Visibility | ❌ | ✅ | ✅ |
| Booking Admin Control | ❌ | ✅ | ✅ |
| Broader Compliance Oversight | ❌ | ✅ | ✅ |
| Multi-Location Support | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |
| Custom Branding | ❌ | ❌ | ✅ |
| Cost Analytics | ❌ | ❌ | ✅ |

**Recommendation**: Use **Essential** plan (most popular) for growing franchises with 15-35 users. Use **Professional** for larger operations requiring cost analytics and custom branding.

---

## Changelog

### March 17, 2026 - Professional Tier Overhaul ✅
**Fixed 6 critical issues reported by user:**

1. **QR Codes** - Verified working. Endpoint `/api/vehicles/{id}/qr` generates valid PNG image with correct URL.

2. **"Manage" Button in Bookings** - Now functional! Opens a booking management modal with:
   - Booking details (User, Vehicle, Date, Status, Purpose, Location)
   - Delete Booking action
   - Approve/Cancel actions for pending/approved bookings

3. **Reports Depth** - Added Cost Analytics section for Professional tier:
   - Customizable mileage rate (€ per km/mile)
   - Fuel cost per km/mile
   - Maintenance cost per km/mile
   - Currency selection (EUR/GBP/USD)
   - Distance unit selection (km/miles)
   - Real-time cost calculations based on fleet mileage

4. **API Access Feature** - Removed from PLAN_CONFIG as it was unimplemented.

5. **Custom Branding** - Implemented for Professional tier:
   - Logo URL upload
   - Brand color picker
   - Settings saved to tenant's database record

6. **Tenant Settings Modal** - New feature for Professional tier:
   - "Settings" button in header
   - Cost Analytics Configuration section
   - Custom Branding section
   - Save/Cancel functionality

**New Endpoints:**
- `GET /api/tenant/settings` - Fetch tenant branding and cost analytics settings
- `PUT /api/tenant/settings` - Update tenant settings (admin only)

**Test Report:** `/app/test_reports/iteration_17.json` - 23/23 tests passed (100%)

### March 17, 2026 - Daily Timeline Vehicle Dropdown ✅
**Added individual vehicle filtering to Daily Availability Timeline (all tiers):**

- **Vehicle Dropdown** added to Daily Timeline showing "All Vehicles (N)" by default
- **Individual vehicle view** shows:
  - Vehicle name and registration
  - Status Today (Active/Idle)
  - Hours Booked count
  - Hourly status bars (Available/Booked) instead of utilization percentages
- **Backend updated** (`GET /api/tenant/reports/daily-timeline`):
  - Added `vehicle_id` query parameter for filtering
  - Returns `vehicle_list` array for dropdown population
  - Returns `selected_vehicle` info when filtering by specific vehicle
- Works across all subscription tiers (Standard, Essential, Professional)

### March 17, 2026 - Professional Tier Additional Fixes ✅
**Fixed 4 additional issues reported by user:**

1. **QR Codes Now Link to Mileage Input Page** ✅
   - QR codes now link to `/{tenant}/vehicle/{id}/mileage` instead of booking page
   - New `MileageLog.js` page created:
     - Shows login screen if not authenticated
     - After login, shows vehicle name, last recorded mileage, and input form
     - Input fields: Current Mileage (km), Notes (optional)
     - "Log Mileage" button saves to database and updates vehicle record
   - New backend endpoint: `POST /api/vehicles/{id}/log-mileage`
   - Mileage history tracked in `mileage_logs` collection

2. **Team Tab Reorganized** ✅
   - **Administrators Section** (purple header): Shows admin accounts with "Change Password" button for self
   - **Staff Members Section** (blue header): Shows staff with "Reset Password" and "Remove" buttons
   - Clear visual separation between roles

3. **Logo Upload Replaced URL Input** ✅
   - **Upload Logo** button with file picker
   - Preview box shows uploaded logo
   - "Remove logo" link to clear
   - Supported formats: PNG, JPG, WEBP, SVG (max 2MB)
   - New backend endpoint: `POST /api/tenant/upload-logo`
   - Files stored in `/app/backend/uploads/logos/`

4. **All Cars Calendar** - Already correctly inside Fleet tab as a sub-tab

### March 19, 2026 - Quick Wing Content Worker Module ✅
**Built complete social media content management module for Instagram:**

**Features:**
1. **Content Dashboard** - Overview with stat cards showing:
   - Total Drafts, In Review, Approved, Posted, Rejected counts
   - Total Assets, Content Ideas, Scheduled counts
   - Recent Assets and Content Ideas sections
   - Workflow visualization showing Upload → Draft → Review → Approve → Post

2. **Asset Manager** - Media file upload and management:
   - Upload images (PNG, JPG, WEBP, GIF) and videos (MP4, MOV, WEBM)
   - File size limit: 100MB
   - Search and filter by type (All/Images/Videos)
   - Preview modal with full-size view
   - Create Post action directly from asset

3. **New Post Form** - Create Instagram content:
   - Media Asset selection from library or upload new
   - Post Type selection (Product Demo, Pain Point, Before/After, Educational, Trust Proof, Feature Spotlight)
   - Format Type (Reel, Carousel, Single Image, Story)
   - Hook (attention-grabbing first line)
   - 3 Caption Options with selection
   - Call to Action input
   - Hashtags field
   - Internal Notes (not published)
   - Schedule Post date/time picker
   - Save Draft / Submit for Review actions

4. **Review Queue** - Approval workflow:
   - Status filtering (All Status, Drafts, In Review, Approved, Rejected, Scheduled)
   - Draft preview modal with full details
   - Approve/Reject actions with notes
   - Submit for Review action for drafts
   - Delete draft functionality

5. **Posted Content** - Content calendar:
   - Three view modes: Posted, Scheduled, Ready to Post
   - Copy Caption to clipboard
   - Mark as Posted action
   - Schedule post with datetime picker
   - Connect Instagram banner (placeholder for future API)

6. **Content Ideas** - Inspiration management:
   - CRUD operations for content ideas
   - Category filtering (Product Demo, Pain Point, Educational, Trust Proof, Feature Spotlight, Trending Topic)
   - Quick Inspiration suggestions
   - Create Post from idea action
   - Hook, Target Audience, CTA fields

7. **Content Settings** - Configuration:
   - Instagram account name input (Coming Soon placeholder for API)
   - Post Templates CRUD with format, brand style, logo position
   - Workflow settings (Require Approval, Privacy Check toggles)
   - Brand Defaults inherited from franchise settings

**New API Endpoints:**
- `GET /api/content-worker/stats` - Dashboard statistics
- `GET/POST /api/content-worker/assets` - Asset management
- `POST /api/content-worker/assets/upload` - File upload
- `GET /api/content-worker/files/{filename}` - Serve content files
- `DELETE /api/content-worker/assets/{asset_id}` - Delete asset
- `GET/POST /api/content-worker/drafts` - Draft management
- `GET /api/content-worker/drafts/{draft_id}` - Get specific draft
- `PUT /api/content-worker/drafts/{draft_id}` - Update draft
- `POST /api/content-worker/drafts/{draft_id}/submit-review` - Submit for review
- `POST /api/content-worker/drafts/{draft_id}/approve` - Approve draft
- `POST /api/content-worker/drafts/{draft_id}/reject` - Reject draft
- `DELETE /api/content-worker/drafts/{draft_id}` - Delete draft
- `GET/POST /api/content-worker/privacy-flags` - Privacy flag management
- `PUT/DELETE /api/content-worker/privacy-flags/{flag_id}` - Update/delete flags
- `GET/POST /api/content-worker/templates` - Template management
- `PUT/DELETE /api/content-worker/templates/{template_id}` - Update/delete templates
- `GET/PUT /api/content-worker/instagram-settings` - Instagram settings
- `GET/POST /api/content-worker/ideas` - Content ideas management
- `PUT/DELETE /api/content-worker/ideas/{idea_id}` - Update/delete ideas

**New Components:**
- `/app/frontend/src/components/ContentWorker/index.js` - Main module entry
- `/app/frontend/src/components/ContentWorker/ContentDashboard.js`
- `/app/frontend/src/components/ContentWorker/AssetManager.js`
- `/app/frontend/src/components/ContentWorker/NewPost.js`
- `/app/frontend/src/components/ContentWorker/ReviewQueue.js`
- `/app/frontend/src/components/ContentWorker/PostedContent.js`
- `/app/frontend/src/components/ContentWorker/ContentIdeas.js`
- `/app/frontend/src/components/ContentWorker/ContentSettings.js`

**Access Control:**
- All Content Worker endpoints require `Super Admin` role
- Module accessible via "Content" tab with Instagram icon in Franchise Command Centre
- Role badge shows "Social Media Manager" in module header

**Database Collections:**
- `content_assets` - Uploaded media files
- `content_drafts` - Social media post drafts with status workflow
- `privacy_flags` - Areas in assets to be blurred (for future privacy feature)
- `post_templates` - Pre-defined content styles
- `instagram_settings` - Instagram API connection settings (placeholder)
- `content_ideas` - Content inspiration and ideas

**Test Report:** `/app/test_reports/iteration_18.json` - 27/27 backend + 10/10 frontend tests passed (100%)

### March 19, 2026 - Extended Content Worker with Privacy Workflow ✅
**Added privacy-protected content creation workflow:**

**New Workflow Features:**
1. **Step-by-Step Workflow UI** - Guided 6-step process:
   - Upload → Select Frame → Privacy → Preview → Caption → Save
   - Progress indicator with completed/active/pending states
   - Previous/Next navigation

2. **Video Frame Extraction**:
   - Extract 1-3 key frames from uploaded videos
   - Visual frame selector with thumbnails
   - Selection indicator with checkmark

3. **Privacy Detection & Blur Tool**:
   - OCR-based detection using Tesseract
   - Pattern matching for: emails, phone numbers, names, registration numbers, booking details, times/dates
   - Keyword detection for sensitive terms
   - Draggable, resizable blur boxes
   - Add/remove manual blur zones
   - Toggle between original and blurred preview
   - Mark as "Privacy Reviewed" action
   - Color-coded zone types (red=email, orange=phone, etc.)

4. **Branded Preview Generation**:
   - Square (1080x1080) and Portrait (1080x1350) formats
   - Quick Wing branding bar at bottom
   - Blur zones applied to final preview
   - Light gray-blue background for non-image areas

5. **Caption Generator**:
   - 7 content focus options: Booking Simplicity, Calendar Visibility, Compliance Tracking, Admin Efficiency, Time Saving, Reducing Chaos, Operational Clarity
   - 3 professional caption options per focus
   - Each includes: Hook, Body copy, CTA, Hashtags
   - Professional, product-focused tone
   - No cheesy hype or generic AI buzzwords

6. **Enhanced Review Queue**:
   - Original vs Processed preview toggle
   - Privacy zones summary display
   - Caption options viewer with selection
   - Review notes field
   - Actions: Approve, Reject, Send Back to Draft
   - Caption editing capability
   - Full draft details view

**New API Endpoints:**
- `POST /api/content-worker/extract-frames` - Extract video frames
- `GET /api/content-worker/files/frames/{filename}` - Serve frame files
- `POST /api/content-worker/detect-privacy` - OCR privacy detection
- `POST /api/content-worker/generate-preview` - Create branded previews
- `GET /api/content-worker/files/previews/{filename}` - Serve preview files
- `POST /api/content-worker/generate-captions` - Generate 3 caption options
- `POST /api/content-worker/drafts/create-with-workflow` - Create draft with full workflow data
- `PUT /api/content-worker/drafts/{draft_id}/review-action` - Approve/reject/send back
- `PUT /api/content-worker/drafts/{draft_id}/update-caption` - Edit caption option
- `GET /api/content-worker/drafts/{draft_id}/full` - Get draft with blur zones and captions

**New Frontend Components:**
- `/app/frontend/src/components/ContentWorker/NewPostWorkflow.js` - Full workflow UI
- `/app/frontend/src/components/ContentWorker/PrivacyEditor.js` - Blur zone editor
- `/app/frontend/src/components/ContentWorker/FrameSelector.js` - Video frame picker
- `/app/frontend/src/components/ContentWorker/CaptionEditor.js` - Caption viewer/editor

**Database Updates:**
- `content_drafts`: Added fields: `generated_captions`, `selected_caption_index`, `content_focus`, `preview_url_square`, `preview_url_portrait`, `privacy_reviewed`, `review_notes`
- `content_assets`: Added `processed_file_url` for blurred previews
- `privacy_flags`: Stores detected and manual blur zones with coordinates

**Dependencies Added:**
- pytesseract==0.3.13 (OCR)
- opencv-python-headless==4.13.0.92 (Frame extraction)
- tesseract-ocr (System package)

### March 19, 2026 - Content Ideas Engine ✅
**Built comprehensive content suggestion system:**

**Features Implemented:**

1. **Suggested This Week** (5-7 ideas):
   - Balanced across 6 content categories
   - Each idea includes: title, category, format, hook, caption starter, CTA, target audience, recommendation reason, confidence score
   - Ranked by confidence score (70-96%)
   - Category-balanced for variety

2. **Content Goal Selector** - 5 priorities:
   - Reach (maximize visibility)
   - Engagement (drive interactions)
   - Leads (generate enquiries)
   - Education (build authority)
   - Product Awareness (showcase features)
   - Ideas filter based on selected goal

3. **Top Performing Categories** (ranked):
   - Trust/Proof (95 score, 5.8% engagement)
   - Pain Point (92 score, 5.1% engagement)
   - Before/After (88 score, 4.8% engagement)
   - Product Demo (85 score, 4.2% engagement)
   - Feature Spotlight (80 score, 3.9% engagement)
   - Educational (78 score, 3.5% engagement)

4. **Top Performing Formats** (ranked):
   - Reel (94 score, ~2,500 reach)
   - Carousel (86 score, ~1,800 reach)
   - Single Image (72 score, ~1,200 reach)
   - Story (68 score, ~800 reach)

5. **Create Draft from Idea**:
   - One-click draft creation
   - Auto-fills: title, hook, caption starter, CTA, category, format
   - Generates 3 caption options
   - Links draft to source idea

6. **Saved Ideas Library**:
   - Save suggestions for later
   - Filter by category and format
   - Status tracking (saved, draft_created)
   - Delete functionality

7. **24 Pre-Built Content Ideas** covering:
   - Easy vehicle booking
   - Calendar management
   - Compliance tracking
   - Admin chaos reduction
   - Team/manager visibility
   - Time saving
   - Spreadsheet replacement

**New API Endpoints:**
- `GET /api/content-worker/ideas/suggestions` - Get weekly suggestions (optional goal filter)
- `GET /api/content-worker/ideas/performance` - Category & format performance metrics
- `POST /api/content-worker/ideas/from-suggestion` - Save suggestion to library
- `POST /api/content-worker/ideas/{id}/create-draft` - Create draft from idea

**New Frontend Component:**
- `/app/frontend/src/components/ContentWorker/ContentIdeasEngine.js`

**Quality Rules Applied:**
- All ideas specific to Quick Wing value propositions
- No generic filler or irrelevant lifestyle content
- Professional, actionable recommendations
- Clear confidence scores and reasoning


### March 19, 2026 - Instagram Publishing & Analytics ✅
**Completed Instagram publishing and basic analytics capabilities:**

**Features Implemented:**

1. **Analytics Tab (NEW)** - Added to Content Worker navigation:
   - 5 Metric Cards: Total Likes, Total Comments, Total Reach, Total Saves, Engagement Rate
   - Average per post shown for likes and reach
   - Top Posts section with sorting by likes/comments/reach/saves
   - Recent Posts section with publish dates
   - Performance by Category breakdown
   - Performance by Format breakdown
   - "Sync Metrics" button to pull mock data from Instagram

2. **Instagram Connection UI** (Settings tab enhanced):
   - Beautiful gradient header with Instagram icon
   - Connection status (Connected/Not Connected)
   - Account name display (@quickwing_official)
   - Token Status (Valid/Expiring/Expired) with days remaining
   - Last Sync timestamp
   - Account Details section
   - Connect/Disconnect buttons
   - Token Refresh capability
   - Instructions for connecting Instagram API

3. **Enhanced Review Queue** with publishing actions:
   - Status filter expanded: All, Drafts, In Review, Approved, Scheduled, Publishing, Posted, Failed, Rejected
   - For Approved drafts: Schedule button + Publish Now button
   - For Scheduled drafts: Unschedule button + Publish Now button
   - For Failed drafts: Retry Publish button
   - Publishing status spinner during publish operations
   - Schedule Modal with datetime picker

4. **Enhanced Posted Content Calendar**:
   - 4 Status Tabs: Posted, Scheduled, Ready to Post, Failed
   - Instagram Connected/Disconnected status in header
   - For Posted: View on Instagram + View Analytics buttons
   - For Scheduled: Unschedule + Publish Now buttons
   - For Ready to Post: Schedule picker + Publish to Instagram button
   - For Failed: Error message display + Retry Publish button
   - Cards show: thumbnail, status badge, format, publish date, Instagram URL

**New Backend API Endpoints:**
- `POST /api/content-worker/drafts/{draft_id}/schedule` - Schedule approved draft
- `POST /api/content-worker/drafts/{draft_id}/unschedule` - Revert scheduled to approved
- `POST /api/content-worker/drafts/{draft_id}/publish` - Publish to Instagram (MOCKED)
- `POST /api/content-worker/drafts/{draft_id}/retry-publish` - Retry failed publish
- `GET /api/content-worker/analytics/overview` - Get aggregate metrics
- `GET /api/content-worker/analytics/posts` - Get posts with metrics
- `GET /api/content-worker/analytics/top-posts` - Get top performing posts
- `GET /api/content-worker/analytics/by-category` - Category performance
- `GET /api/content-worker/analytics/by-format` - Format performance
- `POST /api/content-worker/analytics/sync` - Sync metrics from Instagram (MOCKED)
- `POST /api/content-worker/instagram/connect` - Connect Instagram account
- `POST /api/content-worker/instagram/disconnect` - Disconnect account
- `POST /api/content-worker/instagram/refresh-token` - Refresh access token

**New Frontend Components:**
- `/app/frontend/src/components/ContentWorker/ContentAnalytics.js` - Full analytics dashboard

**Updated Components:**
- `index.js` - Added Analytics tab to navigation
- `ReviewQueue.js` - Added Schedule/Unschedule/Publish/Retry buttons
- `PostedContent.js` - Complete rewrite with 4-tab calendar and publishing workflow
- `ContentSettings.js` - Instagram connection UI

**Database Collections:**
- `instagram_metrics` - Post performance metrics (likes, comments, reach, saves, shares, impressions)
- `instagram_settings` - Connection status, access token, account details, token expiry

**IMPORTANT:** All Instagram API calls are MOCKED:
- Publishing generates fake Instagram post IDs and URLs
- Sync Metrics generates random but realistic performance numbers
- No real Instagram API integration yet

**Test Report:** `/app/test_reports/iteration_19.json` - 31/31 backend + 18/18 frontend tests passed (100%)

### March 19, 2026 - Training Guide Added ✅
**Added in-app training guide accessible via Help tab:**

**Features:**
- New "Help" tab in Content Worker navigation (BookOpen icon)
- Interactive accordion-style guide with 8 expandable sections
- Quick action buttons to navigate directly to features

**Guide Sections:**
1. **Getting Started** - Overview, key features, navigation grid
2. **Creating a New Post (6-Step Workflow)** - Detailed steps with icons
3. **Review & Approval Process** - Status flow diagram, action explanations
4. **Scheduling & Publishing** - Calendar tabs, publishing options
5. **Understanding Analytics** - Metrics explanation, sync instructions
6. **Using the Content Ideas Engine** - Goals, performance insights
7. **Instagram Connection Setup** - Step-by-step connection guide
8. **Best Practices & Tips** - Content creation, publishing, workflow tips

**New Component:**
- `/app/frontend/src/components/ContentWorker/TrainingGuide.js`

**Also Created (file system):**
- `/app/docs/CONTENT_WORKER_TRAINING_GUIDE.md` - Full markdown guide
- `/app/docs/CONTENT_WORKER_QUICK_START.md` - Quick reference guide

### March 19, 2026 - Mobile Responsiveness ✅
**Made Content Worker fully mobile-friendly for social media managers:**

**Mobile Features:**
1. **Full-Screen Mode**: On mobile, the parent Franchise Command Centre header and navigation are hidden, giving Content Worker full screen space
2. **Sticky Header**: Compact header with back button, title, and hamburger menu
3. **Dropdown Navigation**: Current tab indicator with full navigation dropdown
4. **Bottom Navigation Bar**: Quick access to Home, Create, Review, Posted, Stats
5. **Responsive Dashboard**: 2-column stat grid, smaller fonts, compact spacing
6. **Responsive Workflow**: Horizontal scroll for workflow steps
7. **Touch-Friendly**: Larger tap targets, appropriate spacing

**Files Updated:**
- `/app/frontend/src/components/ContentWorker/index.js` - Mobile navigation, bottom nav bar, dropdown menu
- `/app/frontend/src/components/ContentWorker/ContentDashboard.js` - Responsive grid and spacing
- `/app/frontend/src/pages/PlatformAdmin.js` - Hide header/nav on mobile when Content Worker active


### April 5, 2026 - All Cars Calendar Enhancement & Fleet Map Integration ✅

**All Cars Calendar Fixes:**
1. **Standardized Color Scheme**: Red=Booked, Purple=Recurring, Amber=Pending (matches app-wide standard)
2. **Month Statistics Header**: Blue gradient header showing:
   - Total bookings this month
   - Confirmed bookings count
   - Pending bookings count
   - Recurring bookings count
3. **Vehicle Filter Dropdown**: Filter calendar view by specific vehicle
4. **Improved Modal Colors**: Booking detail modals use correct colors per booking type
5. **Better Organization**: Clearer visual hierarchy, summary stats at top

**Fleet Map Integration (Essential & Professional Tiers Only):**
1. **New "Journey Map" Sub-Tab**: Added under Fleet tab for Essential and Professional tiers
2. **React-Leaflet Map**: Interactive map using OpenStreetMap tiles
3. **Journey Visualization**: Color-coded routes per vehicle
4. **Eircode Geocoding (MOCKED)**: Uses hardcoded Dublin area coordinate mapping (D01-D24, Cork, Galway)
5. **Feature-Gated**: Only shows for tenants with `show_map` or `map_booking_pins` features enabled

**Files Updated:**
- `/app/frontend/src/components/AllCarsCalendar.js` - Colors, stats, filter
- `/app/frontend/src/components/FleetMap.js` - Map component (already existed)
- `/app/frontend/src/pages/TenantDashboard.js` - Added FleetMap import and rendering
- `/app/memory/PRD.md` - Removed Stripe and Instagram integration from roadmap

**Test Report:** `/app/test_reports/iteration_20.json` - All tests passed

**Roadmap Changes:**
- REMOVED: Stripe Integration (P1) from roadmap
- REMOVED: Full Instagram API Integration (P2) from roadmap


---
## 2026-02 — Legal & Compliance Section + Legal Records (QuickFleet Limited)

**Implemented:**
- Re-branded all customer-facing copy from "Lee Walker" to "QuickFleet Limited" (operator) / "Quick Wing" (product).
- Added 7 public legal pages with shared `LegalPageLayout` (sidebar nav, sticky header, slate aesthetic, disclaimer banner, footer copyright):
  - `/legal` — Ownership, IP, licence terms, restrictions, contact
  - `/terms` — Rewritten Terms of Service
  - `/privacy-policy` — Rewritten GDPR-aligned Privacy Policy
  - `/dpa` — Data Processing Agreement (Controller/Processor, sub-processors, transfers)
  - `/cookies` — Cookie Policy with table
  - `/security` — Security & Compliance pillars + vulnerability reporting
  - `/contact` — Sales / Support / Privacy / Security / Legal inboxes
- New global `Footer` with `© 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet Limited. All rights reserved.` plus links to all legal pages.
- `Register.js`: added required onboarding checkbox: *"I agree to the Quick Wing Terms of Service, Privacy Policy, Data Processing Agreement, and Legal Terms."* with inline links and submit-blocking validation.
- **Legal Records (super-admin only)** — new singleton-doc CRUD:
  - Backend: `GET /api/platform/legal-records`, `PUT /api/platform/legal-records` (require_super_admin); doc id `platform_legal_record`; `_id` stripped from responses.
  - Frontend: `LegalRecordsSection.js` component + new `Legal` tab in PlatformAdmin (super_admin only) with all 14 fields: company legal name, registration number, registered address, trading/product name, trademark status, trademark reference, domain records, GitHub, hosting provider, dates of creation/launch, contributor records, IP assignment status, contract reference notes.
- Disclaimer rendered on every legal page and the Legal Records dashboard.

**Tested:**
- Backend: GET/PUT/GET round-trip verified via curl with super-admin token. Defaults, upsert, and `_id` exclusion all confirmed.
- Frontend: Smoke test on `/legal` route rendered correctly with sidebar nav, active state, blockquote licence/restriction text, disclaimer, and footer copyright.
- New JS files all lint-clean. Pre-existing `server.py` linter errors remain unchanged (not in scope).

**Files added:**
- `/app/frontend/src/components/LegalPageLayout.js`
- `/app/frontend/src/components/LegalRecordsSection.js`
- `/app/frontend/src/pages/Legal.js`
- `/app/frontend/src/pages/DataProcessingAgreement.js`
- `/app/frontend/src/pages/CookiePolicy.js`
- `/app/frontend/src/pages/SecurityCompliance.js`
- `/app/frontend/src/pages/Contact.js`

**Files modified:**
- `/app/frontend/src/pages/TermsOfService.js` (overwritten)
- `/app/frontend/src/pages/PrivacyPolicy.js` (overwritten)
- `/app/frontend/src/pages/Register.js` (legal acceptance checkbox)
- `/app/frontend/src/components/Footer.js` (new copyright + links)
- `/app/frontend/src/App.js` (5 new routes)
- `/app/frontend/src/pages/PlatformAdmin.js` (Legal tab, super_admin only)
- `/app/backend/server.py` (Legal Records endpoints)

**Routes:** `/legal`, `/terms`, `/privacy-policy`, `/dpa`, `/cookies`, `/security`, `/contact` — all public.



---
## 2026-02 — Custom Documents Builder + Resend staff invitation emails

### Custom Documents Builder
**Implemented:**
- Admins can design their own forms for staff to submit (e.g. Fuel Log, pre-trip vehicle check, mileage log).
- 9 supported field types: text, textarea, number, date, time, select (dropdown), checkbox, vehicle (auto), image (JPEG/PNG/WEBP, browser-side compressed to ~1280px JPEG).
- Each tenant auto-seeds with a built-in **Fuel Log** template (vehicle, date, odometer, litres, fuel type, total cost, station, receipt photo, notes).
- Admins can add/edit/reorder/delete fields, mark fields required, toggle template visibility for staff, soft-delete templates (submissions retained).
- Submissions list per template with vehicle / staff / date / photo count + detail modal showing each field including image previews.
- Staff see active templates as tappable cards in their mobile dashboard's new **Docs** tab → tap → fill form (renders dynamic fields based on template) → submit.

**Backend:**
- New service: `/app/backend/services/documents.py` (templates, fields, submissions, validation, builtin seed)
- New collections: `document_templates`, `document_submissions`
- 8 new endpoints under `/api/documents/*` (CRUD templates, CRUD submissions, all tenant-scoped)
- Required fields enforced server-side; unknown keys silently dropped; numbers coerced; vehicle field auto-hydrates registration.

**Frontend:**
- `CustomDocumentsAdmin.js` — gallery + template editor modal + submissions viewer + detail modal
- `CustomDocumentsStaff.js` — staff submission flow with image compression
- Wired into `TenantDashboard.js` Reports → "Documents" sub-tab (admin) and `StaffMobileView.js` "Docs" tab (mobile)

**Tested:**
- E2E backend curl: list templates (auto-seed Fuel Log), submit Fuel Log with vehicle + photo, list submissions — all green.

### Staff invitation emails (Resend)
**Implemented:**
- Resend SDK installed; `services/email_service.py` with branded HTML invitation (slate header, blue CTA, login URL + temp password fallback, QuickFleet legal footer).
- Sender: `Quick Wing <invites@quick-wing.com>`. Domain `quick-wing.com` added in Resend; awaiting DKIM correction by user (SPF + MX verified).
- Activation tokens collection (single-use, 7-day expiry).
- Public endpoints: `GET /api/auth/activate/{token}` (validate), `POST /api/auth/activate` (consume + auto-login).
- Triggered on **single staff add** (`POST /api/tenant/users`) AND **bulk CSV import** (`POST /api/users/bulk-import`).
- Failures non-fatal — admin gets `email_sent` + `email_error` in response and can fall back to sharing creds manually.
- Frontend: new `/{tenant-slug}/activate?token=…` page with token validation, password setup, success redirect.
- Bulk import modal now shows email-sent / email-failed counts.

**Tested:**
- E2E: create staff → token issued + stored → email API correctly attempts send → DKIM-verification error surfaced cleanly without crashing the user creation. Token validation endpoint returns correct tenant context for use by frontend activation page.



## 2026-02 — Testing pass + bug fix

- Ran `testing_agent_v3_fork`: **12/12 backend pytest passed** (Custom Documents CRUD, Submissions, Fuel Analytics, Activation tokens full lifecycle, Legal Records super-admin gating).
- Verified in browser: all 7 public legal pages render with content, landing footer has 7 links, /activate?token=bogus shows the invalid state, super-admin login + navigation works.
- **Bug found and fixed**: `PlatformAdmin.js` was using `<LegalRecordsSection />` without importing it — caused a runtime ReferenceError on click. Added the missing import; verified Legal tab now renders cleanly with the 14-field form.
- Test report: `/app/test_reports/iteration_23.json`. Pytest fixtures: `/app/backend/tests/test_session_features.py`.
- Outstanding (not in scope this run): PDF export for fuel reports; refactor monolithic server.py; Twilio/WhatsApp integration; Resend DKIM record fix on user side.



## 2026-02 — Landing page competitive redesign v3

**Context:** User provided 3 competitor sites (Webfleet, Tranzaura, Eureka) and asked for concrete
recommendations to beat them, then approved building the full P0+P1 stack.

**Implemented in /app/frontend/src/pages/LandingPage.js:**
- **StickyCTA**: floating "Book a demo" pill appears after 400px scroll, lifts mobile conversion
- **Hero screenshot**: Booking Intelligence dashboard now displayed in browser-framed panel on lg+ screens (replaces previous small logo tile)
- **Trust micro-cues**: "No credit card · 20-min setup · Built in Ireland" line under hero CTAs
- **ProofStrip**: 3 numeric stats (10 hrs saved / 100% compliance visibility / 1 dashboard) mirroring Tranzaura's proof format for SMB pain points
- **TrustBar upgrade**: marquee-ready layout (scales as customers grow) + 5 credential badges (Built in Ireland, GDPR Ready, ISO-27001-aligned hosting, 99.9% Uptime, Founder-led support)
- **WhyStrip (dark)**: high-impact tagline "Fleet spreadsheets tell you *what happened*. Quick Wing tells you *what to do next*." positions vs actual competitor (Excel), not enterprise incumbents
- **FeatureGrid**: 6-tile icon grid (Bookings, Compliance, Booking Intelligence, Live Sheet, Reports, Multi-Tenant) above FeatureCarousel — lets scanners grasp scope in 5 seconds
- **Compare table**: "Spreadsheets vs Quick Wing" with 8 rows — sidesteps enterprise price wars
- **CaseStudyCard**: gradient blue card with quantified Bluebird Care outcome ("3 hours → 20 minutes")
- **Nav**: added "Compare" link, matching mobile menu

**Preserved:**
- All existing #section anchors and data-testids (features, roi-calculator, demo, founder, contact, hero-demo-btn, hero-tour-btn, trustbar-brand, nav-try-btn, contact-email-btn, footer-login-btn)
- Founder Note, ROI Calculator, Footer legal links (all 7), Feature Carousel

**Tested:**
- ESLint: clean
- Screenshot verification: hero screenshot, dark WhyStrip, Compare table, CaseStudy card, StickyCTA all rendering correctly at 1920×800
- All new sections carry `data-testid`s (hero-screenshot, proof-stat-0..2, why-strip-tagline, feature-icon-grid, compare-table, case-study-card, sticky-cta) for future e2e coverage

**Not yet done (backlog):**
- P2 nice-to-haves: animated stat counters, framer-motion entrance animations, "As seen on" strip, FAQ accordion, dark-mode toggle
- P1 Security Hardening block (rate limiting, CORS lock, 5MB upload cap, 24h JWT expiry)
- server.py monolith split (11.6k lines)
- Sentry + nightly Mongo backups (pre-onboarding P0)


## 2026-02 — Fleet Board redesign of Bookings page

**Context:** User wanted to remove the yellow "Available Cars & Time Slots" hour-grid on the Bookings page and replace it with a live per-vehicle card board (like the second screenshot) plus tab-switchable views.

**Backend:**
- Added `current_location_eircode` + `current_location_label` fields to `VehicleBase` / `VehicleUpdate` / `Vehicle` (`/app/backend/models/resources.py`).
- New model `DropOffLocation`.
- New endpoint `POST /api/vehicles/{id}/drop-off` (admin-scoped) that saves or clears the drop-off. Invalidates the vehicles cache.
- Verified end-to-end via curl: save → GET → clear.

**Frontend:**
- New component `/app/frontend/src/components/FleetBoard.js` — live board of every vehicle for a chosen day:
  - Status badge (Available / In Use / Blocked) + colour-coded left border
  - Human availability summary ("Available all day", "In use until 20:50", "Available now — next booking 14:00")
  - Drop-off chip + eircode/label
  - "X.Yh free today (N bookings)" line
  - Horizontal 07:00 → 22:00 timeline with clickable blue booking pills; clicking drops the from → to time inline underneath with an X to close (multiple pills can be expanded)
  - "Now" pin (red) when viewing today
  - Quick Book (opens New Booking form pre-filled with car + start=now rounded to next 15 min + end=+1h)
  - Drop-off (inline Eircode + place-name inputs, Save/Clear/Cancel)
  - Prev/Today/Next date nav; counters recompute per selected date
- New component `/app/frontend/src/components/LiveMap.js` — placeholder for the GPS-integration view, listing all recorded drop-off locations.
- `carAPI.setDropOff(id, {eircode, label})` in `/app/frontend/src/api/api.js`.
- `Bookings.js`:
  - Removed the yellow "Available Cars & Time Slots" collapsible block (and now-unused `CarAvailabilityCard` / `Lightbulb` / `showSuggestions` / `showAllCars` state).
  - Added tab switcher above the calendar area: **Fleet Board (default)** / **All Cars Calendar** / **Live Map**.
  - Old `renderCalendar()` output now shown only when the "All Cars Calendar" tab is active.

**Tested:**
- Backend: curl E2E on `POST /api/vehicles/{id}/drop-off` — save, GET, clear all pass.
- Frontend smoke: logged in to `/test-fleet/bookings`, verified all three tabs render, Fleet Board renders 6 cards with counters, Live Map placeholder renders, Drop-off inline form opens on click.
- ESLint clean on both new components and modified `Bookings.js`.

**Data-testids added (for future e2e):**
`fleet-view-tabs`, `fleet-view-tab-{fleet|calendar|map}`, `fleet-board`, `fleet-counters`, `fleet-date-prev`, `fleet-date-today`, `fleet-date-next`, `fleet-card-{id}`, `fleet-timeline-pill-{bookingId}`, `fleet-timeline-detail-{bookingId}`, `fleet-quick-book-{id}`, `fleet-drop-off-{id}`, `drop-off-form-{id}`, `drop-off-eircode-{id}`, `drop-off-label-{id}`, `drop-off-save-{id}`, `drop-off-clear-{id}`, `live-map`.

**Follow-ups / backlog:**
- Real GPS integration (SinoTrack / Traccar) to make the Live Map actually plot vehicles instead of showing drop-off list.
- Optional: hook Drop-off completion to auto-close the currently-active booking on that vehicle.


## 2026-02 — Demo tenant + magic-link sales links

**Context:** Lee wanted a one-click sales demo — send a link to a prospect, no signup, no password, drops them straight into a pre-populated Quick Wing tenant.

**Backend (`/app/backend/server.py`):**
- `seed_demo_tenant()` — idempotent startup task creating:
  - Tenant "Quick Wing Demo Ltd" (fixed id, slug `demo`, standard plan, `is_demo: true`)
  - Demo user `demo@quickwing.com` (name "Prospect Demo", master_admin role, password hash sentinel `!MAGIC_LINK_ONLY!` — regular login blocked)
  - 8 realistic Irish-reg vehicles with a spread of compliance states (green, amber, one expired to demo alerts)
  - 4 driver staff (`aoife@demo…`, `sean@…`, `niamh@…`, `padraig@…`)
  - 8 bookings across yesterday/today/tomorrow so Fleet Board timelines always have colour
- New endpoints (super/master admin only):
  - `POST /api/platform/demo-tokens` → mint magic link (fields: prospect_name, prospect_email, expires_in_days)
  - `GET  /api/platform/demo-tokens` → list all
  - `DELETE /api/platform/demo-tokens/{id}` → revoke
- Public endpoint:
  - `POST /api/demo/redeem` → exchanges a magic-link token for a full JWT scoped to the demo tenant + demo user. Records use_count / last_used_at. Rejects revoked or expired tokens.
- Token URLs use `FRONTEND_URL` env var (defaults to `quick-wing.com` in prod).
- Added `import secrets` at module top-level for token generation.

**Frontend:**
- `/app/frontend/src/pages/DemoRedeem.js` — new public page at `/demo-link/:token`. Clears any existing session, hits `/api/demo/redeem`, stores the new JWT + activeTenant + flags (`isDemoSession`, `demoProspectName`), hard-navigates to `/demo`. Shows friendly error state if the token is invalid/expired/revoked.
- `/app/frontend/src/components/DemoBanner.js` — persistent yellow strip below the top nav when `isDemoSession === '1'`. Personalised with the prospect's name, includes a "Book a real demo" mailto CTA and a dismiss X (session-scoped).
- `/app/frontend/src/components/DemoLinksSection.js` — new platform-admin console: left column = create-link form (name, optional email, expiry dropdown 3/7/14/30/60 days), right column = table of every link ever minted (Active / Expired / Revoked, use count, last used, Copy / Open / Revoke).
- `PlatformAdmin.js` — new "Demo · Magic Links" tab wired into main nav.
- `api.js` — new `demoAPI` (list, create, revoke, redeem).
- `App.js` — mounts `<DemoBanner />` inside `TenantRoutes` so it appears on every authenticated page in the demo tenant, and adds the public `/demo-link/:token` route BEFORE the tenant catch-alls to avoid slug collisions.

**IMPORTANT — route naming:** magic link URLs deliberately use the path `/demo-link/{token}` rather than `/demo/{token}` to avoid colliding with `/demo/bookings`, `/demo/reports`, etc. which are legitimate tenant routes once the prospect is inside.

**Tested end-to-end (browser + curl):**
- Super admin logs in → Command Centre → Demo tab → generates link
- Fresh browser context opens the magic link → auto-redirected to `/demo` with the yellow "Prospect Demo" banner
- `/demo/bookings` renders 8 fleet cards + 4 timeline pills, banner still visible
- Revoke works, expired tokens rejected, invalid tokens show friendly error page
- Seed function idempotent — re-running startup doesn't duplicate cars/bookings

**Data-testids:** `demo-links-section`, `demo-links-prospect-name`, `demo-links-prospect-email`, `demo-links-expires`, `demo-links-create`, `demo-links-just-created`, `demo-link-row-{id}`, `demo-link-copy-{id}`, `demo-link-revoke-{id}`, `demo-redeem-loading`, `demo-redeem-error`, `demo-banner`, `demo-banner-cta`, `demo-banner-dismiss`, PlatformAdmin tab `tab-demo-links`.

**Backlog / follow-ups:**
- Add "Reset demo data" super-admin button (wipes bookings & drop-off locations to restore pristine state).
- Track referral analytics on redeem (UTM-style stats per link).
- Nightly cron to purge tokens expired > 90 days.


## 2026-02 — Demo tenants v2: per-tenant blank sandboxes (replaces v1)

**User feedback that triggered rebuild:** Original v1 (shared "Quick Wing Demo Ltd" tenant + magic-link tokens) was rejected — "the magic link still requires login credentials" and "it's not a demo app, it's a complete version of a paying client's app". The seeded 8-car / 4-driver / 8-booking Quick Wing Demo Ltd tenant looked like a real customer's data. Requirement: "when I create a new tenant, let me select Real or Demo. Real builds the tenant as normal. Demo lets me create a blank demo that works off a url and no need to login credentials."

**What was removed:**
- `seed_demo_tenant()` startup task (deleted the pre-seeded cars/drivers/bookings/user)
- `Quick Wing Demo Ltd` shared tenant (id 00000000-0000-0000-0000-000000000d00) is DELETED on next startup by new `cleanup_legacy_demo_tenant()`
- Standalone "Demo · Magic Links" tab in Platform Admin (obsolete — magic link is now issued at tenant creation)
- `DemoLinksSection.js` component (file deleted)
- Old `POST /api/platform/demo-tokens` endpoint (magic links are now minted only via tenant creation)

**What was added:**
- `TenantCreate.is_demo: bool = False` and `demo_link_expires_in_days: int = 30`
- Real / Demo toggle at the top of the Create Client form (`data-testid=tenant-type-toggle` / `tenant-type-real` / `tenant-type-demo`)
- Demo branch of the form hides master admin email/name fields and shows a "Magic link settings" block with an expiry-days dropdown (`data-testid=demo-expires-select`)
- Submit label switches to "Create Demo & Get Magic Link"
- Backend `POST /api/platform/tenants` with `is_demo=True`:
  - Skips the auto-generated master-admin-with-password path entirely
  - Creates ONE demo user `demo+<slug>@quickwing.com` with an invalid bcrypt sentinel — email + password login blocked
  - Mints ONE magic link (`_mint_demo_token_for_tenant`) bound to THIS tenant's id
  - Returns `{tenant, is_demo:true, master_admin:null, magic_link:{url,token,tenant_id,tenant_slug,expires_at,...}}`
- `POST /api/demo/redeem` rewritten to look up the token's `tenant_id` — mints a JWT scoped to that specific demo tenant + demo user (no hardcoded IDs)
- `POST /api/auth/login` rejects any user with `is_demo=True` early with a clean 401 (previously bcrypt would crash on the sentinel hash → 500)
- Success modal branches on `is_demo`: real client shows credentials + login URL; demo shows a green magic-link panel with URL + Copy button + amber "blank demo, no password" warning

**Route naming:** `/demo-link/:token` on the frontend (NOT `/demo/:token`) to avoid collisions with `/<slug>/anything` routes once the visitor is inside a tenant whose slug happens to be "demo".

**Testing (testing agent, iteration_26.json):**
- 9/9 backend pytest pass (real regression, demo blank verification, redemption, password-login-blocked, legacy-cleanup, slug collision, revoke, invalid token)
- All frontend acceptance criteria pass (toggle, hidden fields in demo mode, magic-link modal panel, magic-link auto-login in fresh browser context, invalid-token error page, old tab removed)
- Testing agent fixed one edge case in `handleCreateTenant`: sends `master_admin_email/name` as `undefined` if empty (Pydantic v2 EmailStr rejects '')

**Files touched:**
- `/app/backend/server.py` — new create_tenant demo branch, new helpers `_mint_demo_token_for_tenant`, `_demo_token_public`, `cleanup_legacy_demo_tenant`, rewritten `redeem_demo_token`, login rejects is_demo users; removed `seed_demo_tenant` and `POST /api/platform/demo-tokens` endpoint
- `/app/backend/models/tenant.py` — TenantCreate extended
- `/app/frontend/src/pages/PlatformAdmin.js` — toggle, conditional fields, magic-link success modal, tab removed, import removed
- `/app/frontend/src/pages/DemoRedeem.js` — unchanged (already used active_tenant from response)
- `/app/frontend/src/components/DemoBanner.js` — unchanged
- `/app/frontend/src/components/DemoLinksSection.js` — DELETED
- `/app/backend/tests/test_demo_magic_link.py` — NEW (9 regression tests, added by testing agent)

**Test credentials for demo:** none — the whole point is that the magic link opens the demo without credentials. For creating demo tenants, use `superadmin@quickwing.com / Super123`.


## 2026-02 — SinoTrack GPS Bridge Phase 1: Toggle plumbing

**Spec:** /app/memory/SINOTRACK_MULTI_TENANT_PROMPT.md (Phase 1 of 7).

**Scope:** Just the on/off switch. No poller yet, no positions written. Prep the tenant model + settings + UI so Phase 2's poller can just flip on.

**Backend:**
- `Tenant` model — new fields `gps_enabled: bool = False`, `gps_settings: Optional[dict]` (spec dict shape).
- `TenantCreate` — new field `gps_enabled: bool = False`; when true at creation, `gps_settings` is seeded with `GPS_DEFAULTS` (speed_limit_kmh=120, poll_interval_seconds=30, history_retention_days=60, device_password="123456").
- `TenantUpdate` — accepts `gps_enabled` and `gps_settings` overrides.
- `GET /api/tenant/settings` — now returns a `gps` block with the tenant's current state (defaults when unset).
- `PUT /api/tenant/settings/gps` — new admin-only endpoint with `GpsSettingsUpdate` schema. Enabling seeds defaults on first flip. Disabling retains previous overrides. Clamps applied: speed 30-300, poll 10-600 s, retention 7-730 days. Invalidates settings cache.

**Frontend:**
- New `/app/frontend/src/components/GpsSettingsModal.js` — master checkbox + collapsible advanced fields (speed limit, poll interval, retention, device password) + Save. All fields carry data-testids per spec.
- `TenantDashboard.js` — imports the modal, loads `gps` from settings, adds a **GPS On/Off** button next to Compliance Reminders in the **Fleet → Manage Vehicles** sub-tab (Fleet.subTabs updated to include `{id: 'vehicles', label: 'Manage Vehicles'}` so the block is reachable), added `Satellite` icon import.
- `PlatformAdmin.js` — Create Client form has a new **Enable GPS Fleet Tracking (SinoTrack)** checkbox (data-testid=create-tenant-gps-enabled) available in both Real and Demo modes. `newTenant.gps_enabled` state, reset after submit.
- `Bookings.js` — imports `settingsAPI`, reads `gps.enabled` once on mount, filters the **Live Map** tab out of `fleet-view-tabs` when disabled, guards the map render.
- `LiveMap.js` — docstring updated to reflect Phase 1 status.
- `api.js` — new `settingsAPI.updateGps(data)`.

**Tested end-to-end (testing agent, iteration_29 + iteration_30):**
- Backend 9/9 new pytest at `/app/backend/tests/test_gps_settings_phase1.py` — defaults, enable+seed, partial update, disable-retains, clamps, staff 403, tenant-create honours gps_enabled, tenant-create defaults null.
- Regression 27/28 prior demo tests (1 pre-existing skip).
- Frontend 100% pass — Manage Vehicles sub-tab added and reachable, GPS button visible + label reflects state, modal all testids present, save persists, Live Map tab appears/disappears with the toggle.

**Not tested / deferred to Phase 2:**
- Actual SinoTrack cloud polling
- Tracker device registration UI
- Live positions written to `tracker_positions` / `tracker_history`
- Speed / unplug alerts

**Data-testids added:**
`create-tenant-gps-enabled`, `gps-settings-btn`, `gps-settings-modal`, `gps-enabled-checkbox`, `gps-advanced-settings`, `gps-speed-limit`, `gps-poll-interval`, `gps-history-days`, `gps-device-password`, `gps-settings-save`.


## 2026-02 — SinoTrack GPS Bridge Phase 2: Cloud client + poller

**Spec:** /app/memory/SINOTRACK_MULTI_TENANT_PROMPT.md (Phase 2 of 7).

**Verified against real hardware:**
- IMEI **[REDACTED_IMEI_1]** — live, moving (~38 km/h near Bantry, Cork, ~51.68 N, -9.47 W)
- IMEI **[REDACTED_IMEI_2]** — live, stationary (~52.28 N, -9.69 W, voltage 12.7 V)
- Both connected via SinoTrack cloud (`246.sinotrack.com`), password `123456`

**Backend — new files:**
- `/app/backend/services/sinotrack_client.py`:
  - `_call_sinotrack(token_raw)` — reverse-engineered signing (base64 + MD5 + nonce)
  - `login(imei, password)` — verifies credentials (parses `m_arrRecord[0][0]=='1'`)
  - `fetch_position(imei, password)` — returns `{latitude, longitude, speed, direction, gps_signal, gsm_signal, mileage, voltage, timestamp}` or None. Handles SinoTrack's column-oriented `m_arrField`/`m_arrRecord` JSON shape.
  - Voltage parsing treats `Voltages=0.0` placeholder as None (avoids bogus unplug alerts).
- `/app/backend/services/gps_poller.py`:
  - APScheduler AsyncIOScheduler, master tick 30 s
  - `sinotrack_bridge_job()` iterates all `gps_enabled` tenants
  - Per-device: fetches position (via `asyncio.to_thread`), upserts `tracker_positions`, appends `tracker_history` ONLY if speed>0 OR moving→stopped transition, writes speeding alert if speed>tenant limit, writes unplug alert on voltage drop >10 V → <5 V.
  - Started idempotently on FastAPI startup via `services.gps_poller.start(db)`.

**Backend — new models + endpoints:**
- `models/resources.py` — `TrackerDeviceCreate {imei, car_id?, label?, sim_number?, apn?}`, `TrackerDeviceUpdate {car_id?, label?, sim_number?, apn?, is_active?}`
- `server.py`:
  - `POST /api/tracker/devices` (admin) — validates IMEI 10-20 digits, dedupes per tenant, enforces one active tracker per car, best-effort verifies via SinoTrack (`verified_with_sinotrack` flag)
  - `GET  /api/tracker/devices` — tenant-scoped list
  - `PATCH /api/tracker/devices/{id}` (admin) — reassign car / edit / activate
  - `DELETE /api/tracker/devices/{id}` (admin) — device row removed, positions/history retained
  - `GET  /api/tracker/positions` — latest per tracker for current tenant
  - `GET  /api/tracker/car/{car_id}` — one car's latest fix
- `requirements.txt` — added `APScheduler==3.11.3`, `tzlocal==5.4.4`

**Testing (iteration_31):** 20/20 new pytest at `/app/backend/tests/test_sinotrack_phase2.py`, plus 9/9 Phase 1 regression — 29/29 total. Verified against LIVE SinoTrack hardware (real coords retrieved), moving-only history rule holds, tenant isolation confirmed (create in A, empty in B).

**Data-testids added:** none (Phase 3 scope — frontend UI for device management + live map).

**Deferred:**
- Frontend tracker device management UI (Phase 3)
- Live map with plotted positions (Phase 3)
- Journey playback (Phase 4)
- Testing-agent-flagged nits: per-tenant `poll_interval_seconds` currently informational only; verify_error hint on POST /tracker/devices; server.py should be split into routers; `_db` singleton in poller should become class-based.
