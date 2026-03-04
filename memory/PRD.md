# Quick Wing Fleet Management - Multi-Tenant SaaS Platform

## Product Overview
Quick Wing is a comprehensive fleet management SaaS platform designed for multi-franchise operations. Each franchise (tenant) operates in complete data isolation while being managed from a central platform.

## Production Domain
- **URL:** https://quick-wing.com
- Path-based tenant URLs: `https://quick-wing.com/{tenant-slug}/login`

## Test Credentials

### Super Admin (Platform Owner)
- **URL:** https://quick-wing.com/login
- **Email:** superadmin@quickwing.com
- **Password:** Super123
- **Email:** admin.kerry-fleet@quickwing.com
- **Password:** KerryFleet123

---

## Architecture

### Multi-Tenant Model
- **Tenants**: Franchises/companies with isolated data
- **Users**: Global accounts with role-based memberships per tenant
- **Memberships**: Links users to tenants with specific roles

### Role Hierarchy (Simplified - March 2026)
| Role | Scope | Capabilities |
|------|-------|--------------|
| `super_admin` | Platform | Full platform control, create/manage all tenants |
| `master_admin` | Tenant | Franchise owner - pays subscription, manages their tenant |
| `admin` | Tenant | Manage tenant users, vehicles, settings |
| `staff` | Tenant | Book vehicles, view data within tenant |

### Data Isolation
- Every tenant-scoped record includes `tenant_id`
- All queries automatically filtered by tenant context
- Cross-tenant access blocked at application level
- Audit logging for sensitive operations
- Automated tenant isolation tests verify security

## Features

### 1. Platform Administration (Franchise Command Centre)
- **Overview**: Platform-wide statistics (tenants, users, vehicles, bookings)
- **Tenant Management**: Create franchises with auto-generated Master Admin credentials
- **User Management**: Create platform and tenant users
- **Audit Log**: View all security and action events
- **Impersonation**: Support access with full audit trail
- **Suspend/Reactivate**: Control tenant access for non-payment

### 2. Tenant Creation Flow
When creating a new tenant:
1. Super Admin fills in franchise name, slug, and plan
2. Optionally specifies Master Admin email and name
3. System auto-generates:
   - Master Admin user account
   - Secure 12-character password
   - Tenant-specific login URL
4. Credentials displayed in modal for sharing with franchise owner

### 3. Tenant Features (Per Franchise)
- **Dashboard**: Overview, weather, notifications
- **Vehicle Management**: Add/edit/delete fleet vehicles
- **Booking System**: Calendar-based reservations with conflict detection
- **Live Sheet**: Real-time fleet status
- **Reports**: Usage statistics and analytics
- **Team Management**: Add/remove staff members

### 4. Security Features
- JWT-based authentication with tenant context
- Role-based access control (RBAC)
- Tenant suspension for non-payment
- Complete audit trail
- IDOR prevention via TenantQueryBuilder
- Automated tenant isolation tests

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get token
- `POST /api/auth/select-tenant` - Switch active tenant
- `GET /api/auth/me` - Get current user info

### Platform (Super Admin)
- `GET /api/platform/tenants` - List all tenants
- `POST /api/platform/tenants` - Create tenant (returns Master Admin credentials)
- `PUT /api/platform/tenants/{id}` - Update tenant
- `POST /api/platform/tenants/{id}/suspend` - Suspend tenant
- `POST /api/platform/tenants/{id}/reactivate` - Reactivate tenant
- `POST /api/platform/tenants/{id}/impersonate` - Start impersonation
- `POST /api/platform/stop-impersonation` - End impersonation
- `GET /api/platform/stats` - Platform statistics
- `GET /api/platform/audit-log` - Audit events
- `GET /api/platform/settings` - Get company settings
- `PUT /api/platform/settings` - Update company settings

### Invoices & Reports (Super Admin)
- `POST /api/platform/invoices` - Create invoice
- `GET /api/platform/invoices` - List invoices (with filters)
- `GET /api/platform/invoices/{id}` - Get invoice details
- `PUT /api/platform/invoices/{id}` - Update invoice status
- `DELETE /api/platform/invoices/{id}` - Delete draft invoice
- `GET /api/platform/invoices/{id}/pdf` - Download invoice PDF
- `GET /api/platform/reports/executive-summary` - Get executive summary
- `GET /api/platform/reports/executive-summary/pdf` - Download executive summary PDF
- `GET /api/platform/reports/franchises` - Get franchises report
- `GET /api/platform/reports/franchises/pdf` - Download franchises report PDF
- `GET /api/platform/reports/invoices` - Get invoices report
- `GET /api/platform/reports/invoices/pdf` - Download invoices report PDF

### Tenant-Scoped (Requires tenant context)
- `GET /api/vehicles` - List vehicles
- `POST /api/vehicles` - Create vehicle (Admin only)
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/tenant/users` - List tenant users
- `POST /api/tenant/users` - Add user to tenant (Admin only)
- `GET /api/tenant/reports/summary` - Get tenant reports summary (Admin only)
- `GET /api/tenant/reports/vehicle-utilization` - Get vehicle utilization report (Admin only)
- `GET /api/tenant/reports/summary/pdf` - Download tenant analytics as PDF (Admin only)
- `GET /api/tenant/reports/summary/csv` - Download tenant analytics as CSV (Admin only)

## Database Schema

### Collections
- `tenants`: id, name, slug, status, plan, max_vehicles, max_users
- `users`: id, email, name, password_hash, is_active
- `memberships`: id, user_id, tenant_id, role
- `vehicles`: id, tenant_id, name, registration, status
- `bookings`: id, tenant_id, car_id, user_name, start_time, end_time
- `audit_events`: id, actor_user_id, tenant_id, action, resource_type
- `invoices`: id, invoice_number, tenant_id, items[], subtotal, tax_rate, tax_amount, total, status, due_date
- `company_settings`: id, company_name, address, tax_id, bank_details, invoice_prefix, currency

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@quickwing.com | Super123 |
| Master Admin (Kerry Care) | admin.kerry-care@quickwing.com | Rer6FQql1zWq |

## Status

### Completed (March 2026)
- [x] Multi-tenant database schema with tenant_id
- [x] Tenant isolation middleware with TenantQueryBuilder
- [x] JWT with tenant context
- [x] Platform Command Centre UI
- [x] Tenant creation with auto-generated Master Admin credentials
- [x] Tenant suspension/reactivation
- [x] Impersonation with audit logging
- [x] Role-based access control (Super Admin, Master Admin, Admin, Staff)
- [x] Tenant selector for multi-membership users
- [x] Security documentation (SECURITY.md)
- [x] Automated tenant isolation tests (pytest)
- [x] Data cleanup script (removed orphaned records)
- [x] Quick Setup Wizard for new Master Admins (onboarding flow)
- [x] Path-based branded tenant URLs (e.g., quick-wing.com/tenant-slug/login)
- [x] **PDF Export for Reports & Invoices** (March 2026)
  - Executive Summary PDF export
  - Franchises Report PDF export  
  - Invoices Report PDF export
  - Individual Invoice PDF export
  - Blue & white color scheme with Quick Wing branding
- [x] **Invoice Management CRUD** (March 2026)
  - Create invoices with line items, tax calculation
  - List invoices with filters (status, tenant)
  - Update invoice status (draft → sent → paid)
  - Summary stats (total, paid, pending)
- [x] **Rebuilt Tenant Dashboard** (March 2026)
  - New TenantDashboard.js with Overview/Vehicles/Bookings/Team tabs
  - Add Vehicle and Add Team Member modals
  - Fixed onboarding redirects for new tenants
- [x] **Reports & Billing Integrated into Command Centre** (March 2026)
  - Moved from separate page to tab in Franchise Command Centre
  - Sub-tabs: Executive Summary, Franchises Report, Invoices, Company Settings
- [x] **User Management Expansion** (March 2026)
  - View user details with all tenant memberships
  - Edit user role per tenant membership
  - Remove user from tenant
  - Add user to new tenant
  - Backend endpoint: POST /platform/users/{user_id}/add-to-tenant
- [x] **Legacy Dashboard Cleanup** (March 2026)
  - Simplified Dashboard.js to redirect to new TenantDashboard
  - Removed 700+ lines of legacy fleet status code
- [x] **Tenant-Specific Reports** (March 2026)
  - New Reports tab in TenantDashboard for admin users only
  - Fleet utilization percentage (vehicles used this month)
  - Bookings this month vs last month with trend percentage
  - Most Used Vehicles ranked list (top 10)
  - Bookings This Week visual bar chart (7-day rolling)
  - Summary Statistics section
  - Backend endpoints: GET /api/tenant/reports/summary, GET /api/tenant/reports/vehicle-utilization
  - Staff users cannot see Reports tab (admin/master_admin only)
  - **CSV/PDF Export** for franchise analytics reports
    - Export CSV: GET /api/tenant/reports/summary/csv
    - Export PDF: GET /api/tenant/reports/summary/pdf
    - Downloadable reports with all metrics, vehicle usage, and daily trends

### Pending (P1)
- [ ] Email notifications for invoices
- [ ] Automated invoice reminders for overdue payments

### Future (P2-P3)
- [ ] Subscription billing automation
- [ ] Dashboard analytics and charts

## Files Structure
```
/app/backend/
├── server.py              # Main API server (2400+ lines)
├── models/
│   ├── tenant.py          # Tenant, User, Membership models
│   ├── resources.py       # Vehicle, Booking, etc. models
│   └── invoice.py         # Invoice and CompanySettings models
├── middleware/
│   └── tenant.py          # Tenant isolation middleware
├── services/
│   ├── audit.py           # Audit logging service
│   └── pdf_service.py     # PDF generation for reports & invoices
└── tests/
    ├── test_tenant_isolation.py  # Automated isolation tests
    └── test_pdf_export.py        # PDF export tests

/app/frontend/src/
├── contexts/
│   └── AuthContext.js     # Multi-tenant auth context
├── pages/
│   ├── PlatformAdmin.js   # Franchise Command Centre
│   ├── TenantSelector.js  # Tenant selection page
│   ├── SetupWizard.js     # Onboarding wizard for Master Admins
│   ├── Login.js           # Updated login flow with tenant support
│   ├── Dashboard.js       # Main dashboard with wizard redirect
│   └── Reports.js         # Reports & Billing with PDF export
└── components/ui/         # Shadcn UI components
```

## Testing
- Backend: 19/19 auth and platform tests passed (100%) - Dec 2025
- Backend: 25/25 PDF & Invoice tests passed (100%)
- Backend: 17/17 tenant isolation tests passed (100%)
- Frontend: All UI flows verified
- Tenant isolation: Verified via pytest and manual testing
- Test reports: `/app/test_reports/iteration_7.json`

## Scalability Assessment (Dec 2025)
**User Requirement**: 10 franchises, 20-30 cars per franchise, 15 admins + 30 staff per franchise

| Metric | Current Capacity | Required | Status |
|--------|-----------------|----------|--------|
| Tenants | Unlimited | 10 | ✅ Ready |
| Users per tenant | 999 (Enterprise) | 45 | ✅ Ready |
| Vehicles per tenant | 999 (Enterprise) | 30 | ✅ Ready |
| Role-based access | 4 roles | 4 roles | ✅ Ready |
| Data isolation | Full tenant isolation | Required | ✅ Ready |
| PDF exports | Working | Required | ✅ Ready |
| Invoicing | CRUD + PDF | Required | ✅ Ready |

### Plan Limits
- **Starter**: 10 vehicles, 20 users
- **Professional**: 50 vehicles, 100 users  
- **Enterprise**: 999 vehicles, 999 users

**Recommendation**: Use **Professional** or **Enterprise** plan for franchises with 15+ users and 20+ vehicles.
