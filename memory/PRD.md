# Quick Wing — Product Requirements

## Original product
Multi-tenant SaaS fleet-management platform (Quick Wing), with separate franchise/tenant workspaces and a central Franchise Control Centre. Core goals: professional, consistent UI; booking and compliance management; fleet visibility; strict tenant isolation. Recent prior work includes an Auditor PDF Pack, SinoTrack GPS integration and an interactive, plan-aware admin training tour with the Nexus persona and OpenAI TTS.

### Personas
- Super-admin: platform-wide franchise administration, provisioning and oversight.
- Franchise/client admins: their own vehicles, trackers, bookings, reports and teams only.
- Staff: tenant-scoped bookings, inspections and mobile workflows.

## Approved scope — Bulk Tracker Setup (2026-09-23)
User requested a minimal working super-admin page within the existing Franchise Control Centre. Reuse the existing database, authentication, franchises, vehicles and tracker records. No redesign, unrelated refactoring, new packages, automatic deployment, or separate inventory application. The earlier full Hardware Register request is paused/out of scope.

### Requirements
1. Select an existing franchise/client before uploading a UTF-8 CSV: `registration,tracker_id,sim_iccid,sim_msisdn,tracker_model`. Franchise comes only from the selection; CSV cannot set it.
2. Match registrations only to existing vehicles in that franchise. Validate missing fields, unknown/foreign vehicles, duplicate tracker IDs/ICCIDs, used trackers/SIMs, and conflicting assignments before activation. Show row review and a downloadable CSV template.
3. Confirm “Activate and Configure”; backend enables SIMs through 1NCE, then sends four separate messages in this order from source address `1234`:
   - `8030000 sensor.net`
   - `8040000 45.112.204.245 8090`
   - `7100000`
   - `8960000E00`
4. Save per-tracker activation and SMS results; connect existing franchise → vehicle → tracker → ICCID → MSISDN. Preserve tenant isolation.
5. Only these row statuses: Ready to start; Activating SIM; Sending messages; Waiting for delivery; Configured; Failed. Show actual delivery count 0/4 through 4/4, not just SMS acceptance.
6. One row-level “Retry failed”. Do not resend delivered or already-queued messages. Reconcile uncertain sends before any retry. Refresh/double clicks must not duplicate activation, assignments or tracker records.
7. 1NCE credentials are currently absent by user choice. Backend-only environment keys: `ONENCE_CLIENT_ID`, `ONENCE_CLIENT_SECRET`, `ONENCE_API_URL`. Blank/missing configuration displays **1NCE integration not configured** and disables live activation/SMS. No credentials in frontend/database. Provider mocks ONLY inside automated tests, never real UI results.
8. Excluded: barcode scanning, installer apps, charts, emails, PDFs, new GPS maps, network steering, advanced analytics and cosmetic animation.

### Approved follow-up — CSV and review polish (2026-09-23)
User requested a better-formatted/easier CSV and less sloppy review, then selected **both** template and review-table improvements. Scoped changes only:
- Download template optionally fills up to 200 existing registrations for the selected franchise; hardware fields stay blank. No selection still produces the original safe header-only template. Five CSV column names remain unchanged.
- Separate example-only CSV contains explicit non-provisionable placeholders. Collapsible field guide explains expected values and Excel Text formatting to preserve long identifiers and leading zeros.
- Review groups vehicle, tracker and SIM details; consistent column sizing, row numbers, readable status badges, four-segment delivered-only progress and individual bullet errors. Clear row/ready/attention summary. Responsive at 320/768/1024/1440.
- No change to provisioning, authorization, credentials or tenant structure. No new dependencies.

## Architecture / source of truth
- React frontend + FastAPI backend + MongoDB. Existing protected environment variables are unchanged.
- `frontend/src/pages/PlatformAdmin.js`: existing Control Centre, one added super-admin tab; URL `/platform#bulk-tracker-setup`.
- `frontend/src/pages/BulkTrackerSetup.js`: franchise selection, upload/review, saved batches, polling, confirmation/retry, not-configured state. `components/BulkTrackerRows.js`: responsive review/progress rows.
- `frontend/src/components/BulkTrackerCsvGuide.js`: template field guidance, safe example download and Excel identifier handling note.
- `backend/server.py`: existing API/auth integration; small startup/router hookup and resource-claim guards on existing tracker mutations. No unrelated monolith refactor.
- `backend/routes/bulk_tracker_setup.py`: super-admin-only `/api/platform/bulk-tracker-setup` routes for index/template/review/batch/activate/retry; typed responses excluding Mongo `_id` and internal provider state.
- `backend/services/bulk_tracker_setup.py`: in-memory CSV parser and validation (200 rows/512KB); durable idempotent review batches.
- `backend/services/tracker_asset_claims.py`: atomic tracker/ICCID/MSISDN/vehicle reservations shared with existing tracker writes.
- `backend/services/onence_client.py`: backend-only 1NCE v1 OAuth/SIM/SMS adapter, no runtime mock.
- `backend/services/tracker_setup_worker.py`: persistent per-row leases, SIM confirmation, ordered SMS, conservative outcome reconciliation, delivery polling and safe retries; startup recovery.
- Existing `tracker_devices`: `imei` remains tracker ID, `sim_number` remains MSISDN, `tenant_id` and `car_id` remain existing relationships. Only new metadata `sim_iccid`, `tracker_model`, `provisioning_batch_id`. No duplicate SIM/vehicle/tenant inventory models.
- New operational collections: `tracker_setup_batches` (review/progress/results/audit fields), `tracker_setup_claims` (unique reservations). Trackers are created after confirmed SIM enablement and GPS-active only at 4/4 confirmed delivery.
- Existing third-party integrations outside this scope: SinoTrack cloud, Resend, Emergent Object Storage, OpenAI TTS. Unchanged.

## Current status and verification
- Implemented P0 scope and approved CSV/review polish; latest **45/45 automated tests passed** (iteration 47), plus browser download/guide/review checks and responsive fit at 320/768/1024/1440. Initial provisioning baseline had 40 passing tests.
- Reports: `/app/test_reports/iteration_45.json`, `iteration_46.json`, `bulk_tracker_setup_final.json`, and `/app/test_reports/pytest/pytest_bulk_tracker_setup_final.xml`.
- Latest polish report: `/app/test_reports/iteration_47.json`, JUnit `/app/test_reports/pytest/pytest_bulk_tracker_setup_iteration47.xml`. All temporary QA review batches cleaned; no live provisioning attempted.
- MOCKED 1NCE responses exist only in isolated automated tests/temporary databases. Running app contains no fake provisioning results. Removed only the two QA-created unstarted review batches; zero runtime provisioning claims/trackers were created.
- Live SIM activation/SMS delivery is **not verified**, awaiting secure 1NCE credentials and a designated real test SIM/device. Missing-config behavior is verified; outbound operations are blocked.
- Credential setup and operational caveats: `/app/backend/ONENCE_SETUP.md`. Empty slots added ONLY to `/app/backend/.env`; actual API base value should be `https://api.1nce.com/management-api`. Restart backend after secure environment changes. No deployment performed.
- Existing auth/test credentials unchanged; use `/app/memory/test_credentials.md`.
- Prior Nexus `tts-1-hd` / `echo` at 0.95x remains unchanged, user voice approval still pending.

## Documentation map
- `CHANGELOG.md`: dated implementation history and latest changed-file manifest.
- `ROADMAP.md`: prioritized next actions and deferred items.
- `CHANGELOG_ARCHIVE_PRE_2026_09_23.md`: full verbatim archive of the former 2,187-line PRD, preserving all earlier feature history, decisions, reports and architecture notes. Canonical PRD split to keep future context focused; no historical content discarded.
## Status update (2026-06)
- DONE (P0): demo account cross-tenant/platform escalation closed; platform privilege now user-document-only; demo banner bound to verified session. See CHANGELOG 2026-06.
- OPEN: P1 server.py monolith split; P1 Admin Hardware Register; P1 SinoTrack Phase 7 (trip sharing + retention cron); P2 rate limiting/CORS lock/upload limits; P0-blocked MongoDB Atlas migration (needs prod infra verification — do not start).
- DONE (2026-06): public landing page replaced with the supplied design; contact form wired to the existing lead backend (emails Lee@quick-wing.com); SEO tags refreshed.

## Latest approved scope — Premium public-site redesign (2026-10-09)
- User request: reduce the overwhelmingly blue/AI-generated appearance; make Quick Wing feel like an established fleet-management industry player; preserve content, logos and media; improve layout and feature/pricing subheadings; move the large Live Fleet Status window into Features; remove cookie notice.
- User explicitly chose **Premium and understated**: warm white, black, subtle blue accents, generous spacing and editorial layouts. This supersedes the earlier exact-layout requirement, not the requirement to preserve content.
- Implemented: neutral editorial design, supplied full-bleed fleet photograph in hero, understated serif headline accent, clear numbered section hierarchy, product tabs under Features, mobile two-column screenshot gallery, equal-weight pricing comparison, original award/client/founder content and assets, existing video and ROI calculator.
- Cookie notice removed from the app shell; no automatic consent written, no tracking added, essential session behavior and privacy/cookie policy routes left unchanged.
- Existing `/login`, `/contact`, `/privacy-policy` routes kept; landing links now relative to current origin. Existing contact API, Resend destination and all backend/auth/database settings unchanged. Frontend validation, sending/error/success states, keyboard feature tabs and Escape menu dismissal verified.

### Public-site architecture
- `frontend/src/pages/LandingPage.js`: small root wrapper, scoped page lifecycle.
- `frontend/src/pages/landing/content.js`: static trusted markup retaining original copy/media (not a React component rewrite).
- `frontend/src/pages/landing/LandingPage.css`: scoped editorial design and responsive styles; no CSS leakage into app.
- `frontend/src/pages/landing/useLandingInteractions.js`: delegated menu/tabs/ROI/contact handlers; original 73% formula and €6.50 / €8.50 prices unchanged.
- `frontend/src/App.js`: cookie notice import/render removed only; no route/auth changes.
- `frontend/public/index.html`: added DM Serif Display font, SEO metadata unchanged.
- **Do not run `scripts/build_landing.py`**: it is the historical 1:1 importer and would overwrite the newly approved design. Edit the modular source above instead.

### Latest verification / next actions
- Iteration 50: **4/4 backend tests passed**, frontend checks passed at 320/390/768/1024/1440/1920, no horizontal page overflow, broken images, duplicate interactive test IDs, or functional defects found. Menus, anchors, tabs/keyboard, ROI, prices, routes, video and cookie removal verified.
- Real contact API submission passed. Browser error-state and supplementary success-panel/focus checks used **MOCKED test responses only** to avoid extra lead emails; runtime contact integration remains real. One QA-labelled contact lead created by testing. This iteration did not independently confirm inbox delivery.
- Production build succeeds; pre-existing QR-library source-map warnings and unrelated hook/bundle-size warnings remain. No new landing-file lint warnings. Build log: `test_reports/landing-premium-build.log`; regression: `test_reports/iteration_50.json`.
- **Next action: user visual approval in preview.** No deployment performed. Optional future enhancement: a detailed, verified Bluebird Care case study to deepen industry credibility.
- Existing backlog remains separate: P0 blocked production DB discovery/backup before Atlas migration (no DB changes); P1 monolith/SinoTrack Phase 7; P2 hardening/monitoring/backups. Testing also noted existing JWT fallback secret for the separate auth-hardening work. Hardware Register remains deferred by earlier explicit scope.

### Follow-up — user-provided HCCI logo (2026-10-09)
- Added the supplied, unchanged HCCI / Home & Community Care Ireland logo to the recognition strip and award story. It identifies the awarding body, not a client or implied endorsement; original award/client content and all other branding remain unchanged.
- Asset: `frontend/public/images/hcci-logo.png` (738×198), from the user's attached PNG. Preserved proportions/colours with contained, responsive sizing and distinct test IDs; no integration/backend changes.
- Browser verification passed at 320/768/1024/1440/1920: both images load, no cropping/distortion, no adjacent-text overlap or document overflow. Screenshot: `test_reports/hcci-logo-check.jpg`.
- Next: user visual review. Optional later enhancement: link to the official award announcement once supplied/verified. Existing backlog unchanged; no deployment.

### Latest follow-up — Mobile density, premium contrast and early video (2026-10-09)
- User requested small finishing changes: less content density on mobile, more premium contrast instead of all-white, video near the start, remove the numbered woman-at-desk/man-with-phone image pair, preserve the man in the hero. Reported an unspecified image not loading.
- New order: hero → stats → demo video → recognition → features → field gallery → award → stories → pricing → ROI → contact. Added Watch demo hero CTA and Demo navigation; original meaningful copy, logos, prices and functionality retained.
- Removed ONLY the requested split-photo pair from markup. The hero man remains. The secondary demo lifestyle photo is desktop-only; mobile gives priority to the actual video.
- Added charcoal early-video band, more distinct stone/sage section backgrounds and restrained brass detailing. Mobile hero now reveals the photo above a dark readable text area instead of the nearly opaque white overlay; explicit nonnegative stacking, eager photo loading, no mobile text fade, tighter three-line heading and inline CTAs.
- Mobile office tabs are compact two-column controls with the selected description in the preview. Mobile field screenshots use one native horizontal gallery with previous/next/count controls; all four features remain accessible. ResizeObserver synchronizes controls across orientation/desktop changes. Fixed start-boundary state affected by scroll-snap padding.
- Added `public/video/quick-wing-demo.webm` (VP9/Opus, original 720×1280, 60.594s) alongside the unchanged MP4. The browser selects a supported source; native controls/playsinline and sound remain user-controlled, no autoplay. This addresses verified test-browser H.264 incompatibility; do NOT claim the original MP4 was corrupt. Original MP4 fully decoded with ffmpeg and Range serving was verified.
- Production investigation returned no missing-asset fault: existing images/video served valid binaries, custom domains/SSL healthy. RCA: `deployer-agent-docs/RCA_3d97f6af-a4bc-4a55-b66d-c58f11ad6e53.MD`. Existing live run completed at 20:00:31Z, BEFORE these refinements. No further deployment initiated by main agent.
- Verification: direct browser checks passed at 320/390/768/1024/1440/1920; all 19 visible mobile images decoded; mobile menu/Demo anchor, all five feature tabs/descriptions, gallery1↔4/boundaries/resizing, ROI (€130/€170 costs, €376 default return), cookie absence, actual WebM playback advancing and pausing. Final production build succeeds with no landing-file warnings; unrelated existing project warnings remain.
- Testing agent timed out without a report; main completed bounded browser verification and fixed both gallery edge cases. `test_reports/iteration_51.json` is the main-agent consolidated report. Initial `artifacts/iter51/mobile-hero-*.jpeg` were captured during the now-removed text fade and are NOT final visual evidence.
- No new backend/auth/database changes, integration mocks or lead emails. Next: user reviews final mobile polish in preview; pre-existing platform backlog unchanged. Optional future enhancement: video captions for sound-off viewing.
