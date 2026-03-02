# Quick Wing Fleet Management - Multi-Tenant SaaS Platform

## Product Overview
Quick Wing is a comprehensive fleet management SaaS platform designed for multi-franchise operations. Each franchise (tenant) operates in complete data isolation while being managed from a central platform.

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

### Tenant-Scoped (Requires tenant context)
- `GET /api/vehicles` - List vehicles
- `POST /api/vehicles` - Create vehicle (Admin only)
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/tenant/users` - List tenant users
- `POST /api/tenant/users` - Add user to tenant (Admin only)

## Database Schema

### Collections
- `tenants`: id, name, slug, status, plan, max_vehicles, max_users
- `users`: id, email, name, password_hash, is_active
- `memberships`: id, user_id, tenant_id, role
- `vehicles`: id, tenant_id, name, registration, status
- `bookings`: id, tenant_id, car_id, user_name, start_time, end_time
- `audit_events`: id, actor_user_id, tenant_id, action, resource_type

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

### Pending (P1)
- [ ] Billing integration (Stripe) for subscription management
- [ ] Email notifications for tenant suspension/reactivation
- [ ] Rebuild tenant-facing Admin.js page for new architecture

### Future (P2-P3)
- [ ] Subdomain-based tenant resolution
- [ ] Convert training manuals to PDF
- [ ] Printable QR code sheet

## Files Structure
```
/app/backend/
├── server.py              # Main API server (1500+ lines)
├── models/
│   ├── tenant.py          # Tenant, User, Membership models
│   └── resources.py       # Vehicle, Booking, etc. models
├── middleware/
│   └── tenant.py          # Tenant isolation middleware
├── services/
│   └── audit.py           # Audit logging service
└── tests/
    └── test_tenant_isolation.py  # Automated isolation tests

/app/frontend/src/
├── contexts/
│   └── AuthContext.js     # Multi-tenant auth context
├── pages/
│   ├── PlatformAdmin.js   # Franchise Command Centre
│   ├── TenantSelector.js  # Tenant selection page
│   └── Login.js           # Updated login flow with tenant support
└── components/ui/         # Shadcn UI components
```

## Testing
- Backend: 17/17 tests passed (100%)
- Frontend: All UI flows verified
- Tenant isolation: Verified via pytest and manual testing
- Test reports: `/app/test_reports/iteration_5.json`
