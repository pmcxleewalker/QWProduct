# Quick Wing — Changelog

## 2026-10-09 — Mobile expandable headings
- User requested the remaining long mobile sections be hidden inside subheadings. Added seven native disclosures, closed by default ≤767px: features, field app, award, stories, pricing, ROI, contact. Hero/video/recognition stay visible; all content and logos retained within their respective sections.
- Desktop ≥768px remains fully expanded with summary controls hidden. Anchor/CTA/hash navigation opens targets automatically. Native keyboard/touch controls, preserved form/ROI state and remembered mobile expansion across resize.
- Added mobileSectionMarkup.js, useMobileSections.js and MobileSections.css; integrated into existing static landing approach.
- Initial iteration52 found state resets. Read-only RCA confirmed React19 compares the dangerouslySetInnerHTML prop by identity and resets DOM when passed a fresh object. Memoized the payload in LandingPage.js and changed responsive sync to query current nodes. Do not undo that memoization.
- Retest iteration53 passed all requested mobile/desktop behavior, including settled fresh loads, breakpoint roundtrip, keyboard and hash navigation, form/ROI persistence, expanded feature/gallery interactions, unique IDs and no overflow at320/390/768/1024/1440/1920. Final build passes with no new landing-file warnings.
- Folded mobile screenshot reviewed and saved at test_reports/artifacts/iter53/mobile-folded-sections.jpeg. Navigation-aborted media/telemetry requests investigated; independent asset probes returned valid206binary/MIME, no broken-asset defect found.
- No backend/auth/DB changes, runtime mocks or lead emails. Latest accordion changes verified in preview; no additional deployment initiated. User review pending.

## 2026-10-09 — Mobile finishing pass and video prominence
- Demo now immediately follows hero/stats, with Watch demo CTA and navigation. Dark video band, visible stone/sage sections and restrained accent details replace the near-all-white sequence.
- Removed requested 01/02 lifestyle photo pair; retained hero man and branding. Mobile hero photo no longer obscured by white overlay; mobile text displays immediately, fits more compactly and stays readable.
- Compact mobile feature selector retains every description in selected preview. Single-row field gallery retains every screenshot/feature with working count/prev/next controls, scroll-snap and resize synchronization. Corrected mobile-to-desktop-to-mobile disabled-state bug and scroll-padding start-boundary bug.
- Added local WebM alternative; original MP4 retained. Confirmed automated browser cannot play H.264 but can play VP9/Opus; actual playback now verified. No autoplay or default muting added to production. Both originals and media content preserved.
- Production asset RCA found no missing images/routing fault; preview image load checks all pass. Original reported unspecified mobile image failure not reproduced as a missing file; mobile visual masking corrected.
- Final build passed with no landing-file warnings. Direct browser verification at six widths, 19 decoded mobile images, actual video advancement/pause, tabs/menu/anchors, gallery boundaries/rotation and ROI passed. Testing agent timed out; main-agent report `test_reports/iteration_51.json` records completed checks honestly.
- Changed: `pages/landing/content.js`, `LandingPage.css`, `useLandingInteractions.js`; new `public/video/quick-wing-demo.webm`. No app backend/auth/DB changes or new lead emails. Existing publication completed BEFORE this finishing pass; latest refinements remain in preview.

## 2026-10-09 — HCCI logo follow-up
- Added user-supplied HCCI logo, unchanged, to recognition strip and award section; all other logos/copy retained. Award-only context, no client/endorsement claims added.
- Changed `pages/landing/content.js`, scoped `LandingPage.css`; added `public/images/hcci-logo.png` (738×198).
- Verified both placements in browser at 320/768/1024/1440/1920 for loaded asset, natural aspect ratio, no clipping, text overlap or page overflow. No API/auth/database changes or deployment.

## 2026-10-09 — Premium and understated public website
- User explicitly requested a more established fleet-industry aesthetic, preserving all marketing content/media/logos, clearer feature/pricing headings, dashboard in Features, and no cookie notice. Selected premium/understated over other options; prior 1:1 layout constraint superseded.
- Replaced blue-heavy layout with warm white, charcoal, restrained accents and editorial typography. Supplied fleet photo anchors the hero; original dashboard is the first feature tab, with booking/compliance/reports/GPS tabs. Reorganized mobile gallery, award, founder/client proof, pricing, ROI and personal-contact sections.
- Both plan prices and complete original benefit lists retained; all original meaningful content, logos, award images, screenshots, video and podcast links retained. No fabricated customer or performance claims.
- Split static trusted content/styles/delegated handlers out of `LandingPage.js` into `pages/landing/{content.js,LandingPage.css,useLandingInteractions.js}`. Kept original static-markup approach; don't regenerate with the historical `scripts/build_landing.py` importer.
- Removed `CookieConsent` rendering/import from App; no cookie acceptance is fabricated, no tracking enabled, no auth/session behavior changed. Existing routes remain; internal landing links are now origin-relative.
- Improved feature-tab keyboard/ARIA behavior and menu Escape handling; native contact email validation, duplicate-submit guard, recoverable error and accessible focused success panel. Existing API/Resend configuration unchanged.
- Verification: iteration 50 frontend passed at 320/390/768/1024/1440/1920; 4/4 backend contact/media tests passed; production build successful with pre-existing warnings only. Supplementary browser confirmation-panel/focus check passed. Browser success/error responses **MOCKED only in tests**, real contact API independently tested once. No runtime mocks introduced; inbox delivery not independently checked this iteration.
- No backend app code, database settings, auth credentials or dependencies changed. No deployment. User visual review pending. Reports: `test_reports/iteration_50.json`, `test_reports/pytest/iter50_landing_backend.xml`, `test_reports/landing-premium-build.log`.
- Existing monolith and JWT fallback observations recorded for the separate maintainability/auth-hardening backlog, not changed during the landing redesign.

## 2026-09-23 — Bulk Tracker CSV/template and review polish
- User asked to improve the CSV and sloppy review layout; explicitly approved **both**. No unrelated Control Centre redesign.
- Template endpoint retains five headers, optionally prefills up to 200 selected-franchise vehicle registrations and empty hardware fields. csv.writer handles quoting; unusual formula-leading registrations are escaped. Unknown tenant returns 404; existing super-admin gate unchanged.
- Separate example CSV uses clearly marked non-provisionable placeholders. New collapsible column guide explains each field and Excel Text formatting for long ICCIDs/leading zeros.
- Review rows now group vehicle/tracker/SIM details with row numbers, aligned readable identifiers, restrained status badges, accessible four-segment delivery progress and individual bullet validation errors. Summary shows row/ready/attention counts.
- Changed: `backend/routes/bulk_tracker_setup.py`; `frontend/src/pages/BulkTrackerSetup.js`; `frontend/src/components/BulkTrackerRows.js`; new `frontend/src/components/BulkTrackerCsvGuide.js`; extended `backend/tests/test_bulk_tracker_setup_isolated.py`; setup/memory documentation.
- Verified **45/45 automated tests**, browser template/example downloads, busy states, guide toggle and review. No overflow at 320/768/1024/1440 with guide open/closed. Report `test_reports/iteration_47.json`; JUnit `test_reports/pytest/pytest_bulk_tracker_setup_iteration47.xml`.
- QA-only unstarted review batches cleaned. No hardware activated, no real or fake provisioning results inserted. Live 1NCE credentials still missing; activation intentionally disabled. Existing provider tests remain MOCKED only in isolated automated tests. No packages added, no deployment.

## 2026-09-23 — P0 Bulk Tracker Setup
- Added one super-admin-only page at `/platform#bulk-tracker-setup` within the existing Control Centre. Existing design and navigation retained, with a new tab only.
- Franchise-selected CSV template/upload/review, tenant-safe existing-vehicle matches, row validation, duplicate/used-asset checks, stored batches and refresh-safe selection. 200-row / 512KB bounds.
- Backend-only 1NCE adapter: OAuth, administrative SIM GET/Enabled PUT/confirmation, four ordered SMS from `1234`, persisted allowlisted results, actual delivered count 0/4–4/4. Reused existing tracker collection/relationships.
- Durable resource claims + per-batch/start and per-row leases prevent duplicate setup; worker restarts reconcile saved intents. Retry polls queued SMS, skips delivered messages, resends explicit failures only; uncertain outcomes require unique provider record reconciliation, never blind resend. Reconciles all messages before acting on an earlier failure so later deliveries are counted.
- Existing tracker writes share claims, enforce global tracker-ID ownership and cannot detach/delete bulk-provisioned hardware from tenant settings. No auth logic changes.
- Empty ONENCE_CLIENT_ID / ONENCE_CLIENT_SECRET / ONENCE_API_URL slots in backend/.env ONLY. No real credentials supplied. Explicit missing-config banner/loading state, disabled frontend activation/retry, backend HTTP503 and no provider calls.
- Testing: iteration45 initial 22/22; iteration46 supplemental 36/36 isolated backend cases; final combined four-suite run **40/40 passed**, plus UI checks for batch restore, franchise switching while polling and no overflow at 320/768/1024/1440. Final JUnit: `/app/test_reports/pytest/pytest_bulk_tracker_setup_final.xml`.
- Provider responses MOCKED only in isolated automated tests, never app UI. Temporary test DBs dropped and two preview QA review batches removed; no live provisioning claims/trackers created. Live 1NCE enablement and SMS/device delivery remain unverified until credentials and test hardware are supplied.
- No new dependencies, no unrelated refactor, no deployment. Earlier Hardware Register/returns/reassignment request not implemented.

### Changed files
**Application**
- `backend/server.py`
- `backend/routes/bulk_tracker_setup.py` (new)
- `backend/services/bulk_tracker_setup.py` (new)
- `backend/services/tracker_asset_claims.py` (new)
- `backend/services/onence_client.py` (new)
- `backend/services/tracker_setup_worker.py` (new)
- `frontend/src/pages/PlatformAdmin.js`
- `frontend/src/pages/BulkTrackerSetup.js` (new)
- `frontend/src/components/BulkTrackerRows.js` (new)

**Configuration/documentation/tests**
- `backend/.env`: three blank backend-only slots; no existing keys changed.
- `backend/ONENCE_SETUP.md` (new): secure setup, API contract, operational limitations.
- `backend/tests/test_bulk_tracker_setup_isolated.py` (new)
- `backend/tests/test_tracker_setup_worker_isolated.py` (new)
- `backend/tests/test_onence_client_unit.py` (new)
- `backend/tests/test_bulk_tracker_setup_auth_live.py` (new)
- Test reports `iteration_45.json`, `iteration_46.json`, `bulk_tracker_setup_final.json` and JUnit XMLs under `test_reports/pytest/`.
- Memory: shortened canonical PRD, current CHANGELOG, new ROADMAP; former PRD preserved verbatim in `CHANGELOG_ARCHIVE_PRE_2026_09_23.md`.

### Next
User supplies real 1NCE credentials securely in backend environment; designate one test SIM/tracker for live end-to-end verification before a larger batch. Detailed priorities in ROADMAP.md.

## 2026-06 (fork continuation)

### P0 — Deploy blocker fixed: uploads → Emergent Object Storage
- Added `/app/backend/services/storage_service.py` (init/put/get against Emergent Object Storage, app prefix `quickwing`).
- Refactored `POST /api/tenant/upload-logo` + `GET /api/uploads/logos/{filename}` to store/serve from object storage (path `quickwing/logos/*`). Serves via `Response` bytes.
- Refactored `POST /api/content-worker/assets/upload` + `GET /api/content-worker/files/{filename}` to object storage (path `quickwing/content/*`). Serving URLs are now RELATIVE (`/api/...`) so they resolve via ingress in preview + production.
- Storage init runs on FastAPI startup. Verified upload→store→download round-trip (HTTP 200, correct content-type).

### P1 — Interactive In-App Training Tour with AI voiceover (NEW)
- Backend: `/app/backend/services/tour_tts_service.py` — cached OpenAI TTS (model `tts-1`, voice `coral` = warm & friendly) via Emergent LLM Key. Audio cached in object storage (`quickwing/tour-tts/<hash>.mp3`) + `tour_tts_cache` mongo collection so each narration generates only once.
- Endpoints: `POST /api/tour/narration {text,voice}` → `{url}`; `GET /api/tour/tts/{key}.mp3` (public, long cache headers).
- Frontend: `/app/frontend/src/components/GuidedTour.js` — coach-mark engine. Spotlight cut-out over real UI elements (by data-testid), tooltip card, Back/Next/Finish, progress dots, mute toggle, autoplay narration with fallback play button if browser blocks autoplay. `buildTourSteps()` = 7 steps (welcome, overview, fleet, team, reports, announcements, help).
- Wired into `TenantDashboard.js`: auto-launches once per tenant for admins on first login (localStorage `qw_tour_done_<tenantId>`), plus header "Guided Tour" button (data-testid `help-button`) re-opens it. Replaces the old static AdminTraining guide as the primary onboarding path (AdminTraining component left in codebase, no longer triggered).
- Tested: iteration_44.json — backend 5/5, frontend 100%, 0 console errors.

### P1 — Tour polish: warmer HD voice, lighter overlay, try-it prompts (2026-06)
- Voice: `tts-1-hd` + `coral` @ 0.95 speed (warm/friendly, removes tts-1 robotic reverb). All narrations rewritten into short spoken sentences; detail stays in on-screen body text.
- Overlay: replaced the near-black blackout (0.72) with a light dim (~0.34) + bright ring/glow on the target, so the app stays visible while highlighting.
- Encouragement: steps have an optional `tryPrompt` shown as a lavender callout; on those steps the pause button becomes a solid "Let me try this myself" CTA. Final step encourages repeating the tour to build muscle memory.

### P1 — Pause & Try (2026-06)
- Added a "Pause — let me try this myself" button on every tour step. Pausing hides the overlay/card entirely (dashboard becomes fully clickable) and shows a floating "Resume tour" pill with Nexus's avatar + current step (n/total) bottom-right.
- Resume restores the overlay at the same step, re-navigates to that step's tab/sub-tab, and replays narration. `paused` state resets on tour open. Verified: paused → clicked a live tab → resumed to same step.

### P1 — Nexus instructor persona + deep tour + calmer voice (2026-06)
- Voice: switched to OpenAI `sage` at speed 0.9 (calm, unhurried); narration rewritten with gentler phrasing. `tour_tts_service` now takes `speed`, cache key includes it. Frontend no longer forces a voice; backend `DEFAULT_VOICE=sage`, `DEFAULT_SPEED=0.9`.
- Persona: "Nexus, Quick Wing Instructor" — friendly static avatar at `/frontend/public/nexus-instructor.jpg` (generated). Shown in card header on every step + larger portrait on welcome/help steps. Nexus introduces itself and signs off.
- Depth: tour expanded 7 → 16 steps, now navigating INTO each sub-tab (Fleet: live-fleet/vehicles/car-calendars/all-cars; Reports: fleet-reports/incident-reports/documents/daily-timeline) via existing `subtab-<id>` testids, describing what each does. Step counter shown (n/total). Verified sub-tab navigation + spotlight.

### P1 — Plan-aware Overview + Tour analytics (2026-06)
- Overview step now names the exact Action-Required alert types (tax/NCT/insurance, overdue inspections, licence renewals, incidents) + "mileage-based service reminders" only when `features.mileage_tracking`.
- Analytics: `POST /api/tour/event {event: start|finish|skip, step_id, step_index, total_steps}` (any authed user) → `db.tour_events`. `GET /api/platform/tour-analytics` (super admin) → starts/finishes/skips/unique_admins/completion_rate/avg_skip_step.
- `GuidedTour` fires `start` on open, `finish` on completion, `skip` on early close.
- PlatformAdmin Dashboard tab shows an "Onboarding Tour" card (`tour-analytics-card`) with the metrics. Verified via curl + screenshots.

### P1 — Tour: Skipped nudge + plan-aware Fleet step (2026-06)
- `GuidedTour` now reports completion: `onClose(completed)` — Finish/last-step = completed, X = dismissed early.
- TenantDashboard: dismissing the tour early sets `qw_tour_skipped_<tid>` and shows a dismissible "Take the tour" nudge card on the Overview tab (`tour-nudge-card`, `tour-nudge-start`, `tour-nudge-dismiss`). Dismissing persists `qw_tour_nudge_dismissed_<tid>`; completing the tour clears the skipped flag so no nudge shows.
- Fleet step wording now plan-aware via `features`: appends `qr_codes` → "print QR codes", `block_vehicles` → "block or unblock a vehicle", `live_status_updates` → "watch live status refresh in real time". Standard plans get the base compliance sentence only.

### P1 — Tour personalization by plan/UI (2026-06)
- `buildTourSteps(franchiseName, planName, {gpsEnabled, features, maxUsers})` builds the step list dynamically.
- "Live GPS Map" step (targets `live-map-btn`) only included when `gpsSettings.available && gpsSettings.enabled` — tenants without tracking never see GPS/Live Map narration.
- Team step shows the tenant's real seat limit ("up to {max_users} on your plan").
- Reports step base wording + conditional extras: `cost_analytics` → "cost analytics using your own cost-per-km rates"; `detailed_reports` → "detailed vehicle-level analytics" (else `enhanced_reports` → "enhanced utilisation insights"). Standard plans see base wording only.
- Fleet step reworded to "see each vehicle's current status" (no GPS implication). Dropped off-page Auditor Pack reference.
- Verified via screenshots on GPS-enabled full-feature test-fleet (Live Map step + tailored Team/Reports wording).

### Notes for next agent- Handoff creds for Karen were stale. Tenant admin for testing: `victim.admin@example.com` / `Admin123` at `/test-fleet/login` (see test_credentials.md).
- Still open (from backlog): server.py monolith breakdown (P1), security hardening — slowapi rate limit, CORS lock, JWT 24h (P2), SinoTrack Phase 7 (trip sharing links + retention cron).

## 2026-06 — P0 Tenant isolation + demo banner fix (preview only)
- Demo (magic-link) sessions now mint `role=admin` + `is_demo=true` — never `master_admin`. Demo contexts are hard-pinned to the demo tenant on their user doc (X-Tenant-ID ignored), and are rejected by `require_super_admin` / `require_platform_admin` / `select-tenant` for any other tenant.
- Platform privilege now derives ONLY from the role on the USER document (`platform_role` on TenantContext, `PLATFORM_ROLES`, `is_platform_admin_context`). A tenant membership role of `master_admin` (franchise owner, support@) no longer unlocks `/api/platform/*`, cross-tenant `select-tenant` or impersonation.
- `/api/auth/me` now returns `current_context.is_demo` and `current_context.is_platform_admin`.
- Frontend: `DemoBanner` reads `isDemoSession` from AuthContext (verified session) instead of `localStorage`; stale `isDemoSession`/`demoProspectName` keys are cleared on login + logout. `App.js` route guards and AuthContext role helpers use the backend-verified `isPlatformAdminVerified`.
- Tested: iteration_48 — backend 18/18 (isolation for superadmin, tenant owner, demo, support), frontend 5/5 (no stale banner, demo banner shows only for real demo sessions). Regression test: /app/backend/tests/test_demo_tenant_isolation_iter48.py

## 2026-06 — New public landing page (quick-wing.com home)
- Replaced the public home page with the supplied design, ported 1:1 (layout, copy, Manrope + IBM Plex Mono, all @media rules). Generated by /app/scripts/build_landing.py into /app/frontend/src/pages/LandingPage.js; CSS is scoped under #qw-landing so it cannot leak into the logged-in app.
- Assets added at /app/frontend/public/images/* and /app/frontend/public/video/quick-wing-demo.mp4 (poster /images/demo-poster.jpg).
- Contact form (#contact) now posts to the existing POST /api/public/contact; CONTACT_LEAD_INBOX=Lee@quick-wing.com added to backend/.env so every lead is emailed to Lee. Form is replaced in place by a "Message sent" panel (data-testid landing-contact-success).
- ROI calculator kept (73% automation, €6.50 / €8.50 per vehicle per month); feature tabs, hamburger menu and swipe rows wired through React event delegation.
- SEO/OG/Twitter tags + JSON-LD updated in public/index.html; every "Plans from €179/month" reference removed (now €6.50–€8.50 per vehicle / month).
- Routes untouched: /login, /contact, /privacy-policy and the logged-in app all verified working. Cookie notice unchanged.
- Tested: iteration_49 — backend 10/10, frontend 100% (desktop 1440 + mobile 390: no horizontal scroll, 16px inputs, 48px buttons, menu/tabs/ROI/form all working).
