# Test Credentials

## Super Admin (Platform Admin)
- Email: `superadmin@quickwing.com`
- Password: `Super123`
- Access: Command Centre (`/platform`), can create real and demo tenants

## Platform Support Admin
- Email: `support@quickwing.com`
- Password: `QuickWing123!`
- Access: has memberships on demo tenants (test-fleet, test-iso-e6c7af)

## Master admin (per-tenant, auto-created for REAL tenants)
- Email: `admin.<slug>@quickwing.com`
- Password: `admin123`

## Demo tenants (created via Command Centre → Create Tenant → Demo toggle)
- **No credentials.** Access is via the magic link URL returned when the demo tenant is created (or reshown from Command Centre → Clients → row detail).
- Demo user email is `demo+<slug>@quickwing.com` — password login is BLOCKED for these accounts (returns 401 "demo-only").
- Magic link URL format: `<FRONTEND_URL>/demo-link/<token>` — opening in any browser (including incognito) auto-logs in the visitor as a demo master admin, no signup, no password.
