# Test Credentials

## Super Admin (Platform Admin)
- Email: `superadmin@quickwing.com`
- Password: `Super123`
- Role: `super_admin`

## Support Admin (Cross-Tenant — same credentials work in EVERY tenant)
- Email: `support@quickwing.com`
- Password: `QuickWing123!`
- Role: `master_admin` (auto-attached to every new tenant on creation)
- **Does NOT force password change** — these are stable shared credentials for off-site support

## Master Admin (per tenant — created at tenant creation)
- Email: as supplied at tenant creation, or auto-generated `admin.<slug>@quickwing.com`
- Default password: `<firstname>123` (e.g. `admin123`)
- **MUST change password on first login** (`must_change_password=True`)
- Role: `master_admin`

## Bulk-Imported Staff Default Password
- Default temp password: `QuickWing123!`
- All bulk-imported staff have `require_password_change=True` — must reset on first login

## Tenant Admin (sample)
- Tenant: `Standard Fleet Co` (slug: `standard-fleet`)
- Master admin email: `admin@standardfleet.com`
- Use super admin to impersonate or reset passwords as needed

## Test Tenants Available
- test-fleet (Test Fleet) — created in this session, used for backend curl tests
- Other historical tenants may have been deleted — check `GET /api/platform/tenants` for current list
- Default tenant master admin: email `admin.<slug>@quickwing.com`, password `admin123`

## Demo Tenant (Magic Link, no password)
- Tenant slug: `demo`  (name: "Quick Wing Demo Ltd")
- Demo user: `demo@quickwing.com` — password login is BLOCKED (hash sentinel).
- Only entry path: `/demo-link/{token}` (magic link).
- Magic link creation: Super admin → Command Centre → **Demo** tab → generate link.
- Seed data: 8 realistic Irish-reg vehicles, 4 dummy drivers, 8 bookings spread across yesterday/today/tomorrow. Idempotent — re-seeded on every startup.
