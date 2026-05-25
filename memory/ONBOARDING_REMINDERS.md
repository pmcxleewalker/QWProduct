# Pre-Onboarding Reminders (Multi-Tenant Hardening)

**TRIGGER:** When the user mentions onboarding a new client, going live with new tenants, or asks about capacity for additional clients — surface this checklist BEFORE they start.

## Context (as of May 2026)
- 1 tenant live in production (Bluebird Care, ~36 cars) — working fine
- 2 potential clients pending: 25 cars/25 staff, 50 cars/40 staff
- Architecture verified capable of 120 cars × 120 staff × 3 tenants
- These items are NOT capacity blockers — they're "sleep well with multiple paying clients" hardening

## 🔴 MUST DO before onboarding next client

1. **Automated nightly Mongo backups** (retained 30 days)
   - Protects against accidental tenant wipes (recall the Karen handover scare)
   - ~1 hour of work
   - Could be a cron + `mongodump` to S3, or use Atlas continuous backup if on M10+

2. **Error monitoring (Sentry or equivalent)**
   - Backend exceptions + frontend errors → dashboard
   - Cannot rely on clients reporting issues once 3 tenants are live
   - ~30 min to wire up

## 🟡 RECOMMENDED before 3rd tenant goes live

3. **Bump uvicorn workers to 2–4** in production
   - Currently single-worker — risky during shift-change concurrency spikes
   - ~15 min config change

4. **Add `?from=&to=` query filters to `/api/bookings`**
   - Stop pulling 2000 bookings per page load
   - Wire calendars + Live Sheet to use visible-month range
   - ~1-2 hours

## 🟢 SKIP until 5+ clients live
- Redis caching on hot endpoints
- S3 photo migration (still on roadmap, not urgent)
- server.py refactor (~11.5k lines — maintenance pain, not capacity)
- Websocket push (only if clients demand instant updates)

## How to remind
When the user next mentions onboarding/new clients:
1. Confirm capacity is fine (architecture proven at this scale)
2. Surface the 🔴 MUST DO list with time estimates
3. Ask if they want to knock these out before onboarding starts
