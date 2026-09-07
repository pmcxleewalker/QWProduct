# Quick Wing — Changelog

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
