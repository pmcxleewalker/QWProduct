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
- standard-fleet (Standard Fleet Co) — 50 vehicle plan
- essential-care (Essential Care Fleet) — 25 vehicle plan
- pro-transport (Professional Transport Group) — 50 vehicle plan
- dublin-metro, cork-city-cabs, galway-bay, etc. — 50 vehicle plan each
