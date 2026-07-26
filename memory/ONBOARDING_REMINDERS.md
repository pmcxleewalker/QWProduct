# Pre-Onboarding Reminders (Multi-Tenant Hardening)

**TRIGGER:** When the user mentions onboarding a new client, going live with new tenants, asks about capacity for additional clients, or mentions growth/scaling — surface this checklist BEFORE they start. User is non-technical, so always re-explain terms in plain English.

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

2. **Sentry — error monitoring** ⭐ HIGHEST ROI
   - Plain English: "A smoke alarm for your software" — catches every crash, error, or silent bug the moment it happens, emails the user with full context (page, user, error message). Without it the user only finds out when clients call angry.
   - Real example: "Bulk import of 50 cars — 3 failed silently due to date format. Sentry tells the user within 5 min instead of 2 days later when client notices missing cars."
   - **Cost: FREE** (up to 5k errors/month — way more than they'd ever need)
   - **Effort: ~30 min.** User signs up at sentry.io, gives DSN key, agent wires backend + frontend.

## 🟡 RECOMMENDED before 3rd tenant goes live

3. **Bump uvicorn workers to 2–4** in production
   - Plain English: Uvicorn is the "engine" running the backend. Workers = chefs in a kitchen. Today they have 1 chef. With 4 chefs, 4 requests can be handled in parallel. Otherwise a slow request (CSV export, Mongo glitch) blocks everyone behind it.
   - Currently single-worker — risky during shift-change concurrency spikes
   - **Cost: FREE.** ~15 min config change (`--workers 4` in deploy startup command).

4. **Add `?from=&to=` query filters to `/api/bookings`**
   - Stop pulling 2000 bookings per page load
   - Wire calendars + Live Sheet to use visible-month range
   - ~1-2 hours

## 🟢 BEFORE WE GROW LARGER (5+ clients OR heavy photo usage)

5. **Migrate base64 photos → AWS S3**
   - Plain English: Right now photos (incident reports, vehicle damage, profile pics) are converted to a giant text string and stored INSIDE the MongoDB database next to the booking/user record. Like writing the Bible under every phone number — notebook gets fat fast. S3 = Amazon's cheap file-storage box. Database keeps just a tiny pointer.
   - Why it matters at scale: MongoDB has a 16 MB-per-document limit. Backups bloat. Page loads slow. Mongo hosting cost grows much faster than needed.
   - **Cost: ~€2/month** for thousands of photos
   - **Effort: ~1 day.** User needs to create an AWS account (free signup), give agent the S3 credentials.

6. **Redis caching on hot endpoints** (`/api/tenant/me`, `/api/vehicles`, `/api/locations`)
   - Plain English: Redis = an in-memory shortcut. Same data, ~70% faster response. Worth it once 5+ tenants are live.

7. **server.py refactor** (~11.5k lines)
   - Maintenance pain, not capacity. Slows down bug fixes as codebase grows.

8. **Websocket realtime** (replacing 30 s polling)
   - Only if clients demand instant updates instead of 30-second refresh.

## How to remind
When the user next mentions onboarding/new clients OR scaling/growth:
1. Confirm capacity is fine (architecture proven at this scale)
2. Surface the 🔴 MUST DO list with time estimates and plain-English explanations
3. If user is asking about long-term growth, also remind them about 🟢 items (especially S3 photos)
4. Ask if they want to knock these out before onboarding starts



---

## 🟡 REMIND USER — Resend email domain verification (added Feb 2026)

**TRIGGER**: Before any real client onboarding, OR the next time user mentions staff invites / password resets / any email flow.

**Current state**: `RESEND_API_KEY` in `/app/backend/.env` is a restricted onboarding key. It can only send FROM `onboarding@resend.dev` and only TO Lee's own gmail. Real staff-invite emails silently fail with `"The associated domain with your API key is not verified"`. Bluebird's Karen (and every other real staff member) never receives their activation email.

**Mitigation already in place**: When email delivery fails, the resend endpoint returns an `activation_url` and the admin sees a copyable modal (`manual-invite-dialog` in TenantDashboard.js) — they can copy the link + temp password and share it via WhatsApp/SMS. So onboarding is technically possible today, just clunky.

**What the user needs to do (2 options)**:
- **Option A** (preferred): In Resend dashboard → Domains → add `send.quick-wing.com` → paste DNS records into Cloudflare/registrar → wait for verification (~10 min). No code change needed after that.
- **Option B**: Generate a full-access Resend API key with an already-verified domain → paste into `RESEND_API_KEY` in backend .env → restart backend.

Once done, `email_sent` will flip to `true` and the manual-invite modal will stop appearing. Zero code changes required.

**Do NOT recreate Bluebird Care Dublin South unless user explicitly asks** — user confirmed Feb 2026 not to spin it up.
