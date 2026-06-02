# Quick Wing Fleet Management - Multi-Tenant SaaS Platform

## Product Overview
Quick Wing is a comprehensive fleet management SaaS platform designed for multi-franchise operations. Each franchise (tenant) operates in complete data isolation while being managed from a central platform.


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

