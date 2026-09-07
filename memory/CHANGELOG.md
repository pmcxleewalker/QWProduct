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

### Notes for next agent
- Handoff creds for Karen were stale. Tenant admin for testing: `victim.admin@example.com` / `Admin123` at `/test-fleet/login` (see test_credentials.md).
- Still open (from backlog): server.py monolith breakdown (P1), security hardening — slowapi rate limit, CORS lock, JWT 24h (P2), SinoTrack Phase 7 (trip sharing links + retention cron).
