# Quick Wing — Product Requirements

## Original product
Multi-tenant SaaS fleet-management platform (Quick Wing), with separate franchise/tenant workspaces and a central Franchise Control Centre. Core goals: professional, consistent UI; booking and compliance management; fleet visibility; strict tenant isolation. Recent prior work includes an Auditor PDF Pack, SinoTrack GPS integration and an interactive, plan-aware admin training tour with the Nexus persona and OpenAI TTS.

### Personas
- Super-admin: platform-wide franchise administration, provisioning and oversight.
- Franchise/client admins: their own vehicles, trackers, bookings, reports and teams only.
- Staff: tenant-scoped bookings, inspections and mobile workflows.

## Current approved scope — Bulk Tracker Setup (2026-09-23)
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

## Architecture / source of truth
- React frontend + FastAPI backend + MongoDB. Existing protected environment variables are unchanged.
- `frontend/src/pages/PlatformAdmin.js`: existing Control Centre, one added super-admin tab; URL `/platform#bulk-tracker-setup`.
- `frontend/src/pages/BulkTrackerSetup.js`: franchise selection, upload/review, saved batches, polling, confirmation/retry, not-configured state. `components/BulkTrackerRows.js`: responsive review/progress rows.
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
- Implemented P0 scope; **40/40 automated tests passed** (final combined run), plus frontend CSV/reload/selection/template/not-configured checks and responsive fit at 320/768/1024/1440.
- Reports: `/app/test_reports/iteration_45.json`, `iteration_46.json`, `bulk_tracker_setup_final.json`, and `/app/test_reports/pytest/pytest_bulk_tracker_setup_final.xml`.
- MOCKED 1NCE responses exist only in isolated automated tests/temporary databases. Running app contains no fake provisioning results. Removed only the two QA-created unstarted review batches; zero runtime provisioning claims/trackers were created.
- Live SIM activation/SMS delivery is **not verified**, awaiting secure 1NCE credentials and a designated real test SIM/device. Missing-config behavior is verified; outbound operations are blocked.
- Credential setup and operational caveats: `/app/backend/ONENCE_SETUP.md`. Empty slots added ONLY to `/app/backend/.env`; actual API base value should be `https://api.1nce.com/management-api`. Restart backend after secure environment changes. No deployment performed.
- Existing auth/test credentials unchanged; use `/app/memory/test_credentials.md`.
- Prior Nexus `tts-1-hd` / `echo` at 0.95x remains unchanged, user voice approval still pending.

## Documentation map
- `CHANGELOG.md`: dated implementation history and latest changed-file manifest.
- `ROADMAP.md`: prioritized next actions and deferred items.
- `CHANGELOG_ARCHIVE_PRE_2026_09_23.md`: full verbatim archive of the former 2,187-line PRD, preserving all earlier feature history, decisions, reports and architecture notes. Canonical PRD split to keep future context focused; no historical content discarded.