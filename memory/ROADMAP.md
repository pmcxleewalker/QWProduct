# Quick Wing — Roadmap

## P0 — current approved scope
- Bulk Tracker Setup plus approved CSV/review polish complete in preview (45 automated tests + responsive/download UI checks). No runtime mock, no deployment.
- **Awaiting user:** securely set ONENCE_CLIENT_ID, ONENCE_CLIENT_SECRET and ONENCE_API_URL in backend environment; real test SIM/tracker for live activation, exact SMS order and delivery confirmation. Variables currently blank; outbound activation/SMS deliberately disabled.
- Suggested next safeguard: a one-tracker live pilot before uploading a larger batch. This is verification of the current tool, not a new feature.
- Prior pending user verification: Nexus calm `echo` voice, HD at 0.95 speed. Leave unchanged unless requested.

## Deferred by explicit user scope (do not auto-start)
- Full admin Hardware Register, tenant summaries, return/inspection/deactivation/reassignment and permanent transfer history. Prior request was paused; Bulk Tracker Setup P0 only is approved.

## P1 — existing backlog, untouched
- Backend server.py modularization (13k+ lines); no refactoring during current task.
- SinoTrack Phase 7: trip-sharing links and retention jobs.

## P2 — existing backlog, untouched
- Security hardening: rate limiting, restrictive CORS, broader upload size limits, shorter JWT expiry. Auth changes require separate integration guidance/testing.
- Sentry/error monitoring and automated nightly MongoDB backups.
- External Booking API key / embeddable booking integration.