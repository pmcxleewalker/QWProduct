# Quick Wing Multi-Tenant SaaS - Security Documentation

## Overview

Quick Wing implements a strict multi-tenant architecture where each franchise (tenant) operates in complete isolation from others. This document describes the security measures in place to ensure tenant data isolation and platform security.

## Tenant Isolation Model

### Database Level

1. **Tenant ID on All Records**
   - Every tenant-owned record includes a `tenant_id` field
   - Indexes are created on `(tenant_id, id)` for all tenant-scoped collections
   - Collections with tenant isolation:
     - `vehicles`
     - `bookings`
     - `providers`
     - `messages`
     - `todos`
     - `lift_requests`

2. **Query Scoping**
   - All database queries for tenant-scoped data MUST use `TenantQueryBuilder`
   - The builder automatically injects `tenant_id` into all queries
   - Unscoped queries to tenant collections are not permitted

### Application Level

1. **Tenant Context Middleware**
   - Every authenticated request extracts tenant context from JWT
   - Tenant ID is NEVER taken from request body/params for security-critical operations
   - Tenant ID is derived server-side only from:
     - JWT token payload
     - User's membership records

2. **IDOR Prevention**
   - Every resource access by ID validates `resource.tenant_id == currentTenantId`
   - Cross-tenant access attempts return 404 (not 403) to prevent information leakage
   - The `validate_resource_tenant()` function enforces this check

## Role-Based Access Control (RBAC)

### Roles Hierarchy

| Role | Scope | Permissions |
|------|-------|-------------|
| `super_admin` | Platform | Full access to all tenants, create/delete tenants |
| `master_admin` | Platform | View/manage tenants, impersonate for support |
| `tenant_admin` | Single Tenant | Manage users, vehicles, settings within tenant |
| `staff` | Single Tenant | View/create bookings, limited access |

### Permission Enforcement

```python
# Route decorators enforce role requirements:
@api_router.post("/platform/tenants")
async def create_tenant(context = Depends(require_platform_admin)):
    # Only super_admin or master_admin can access
    
@api_router.post("/vehicles")
async def create_vehicle(context = Depends(require_tenant_admin)):
    # Only tenant_admin+ can create vehicles
    
@api_router.get("/bookings")
async def list_bookings(context = Depends(require_tenant_context)):
    # Any authenticated user with tenant context
```

## Authentication & Session Security

### JWT Token Structure

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "tenant_admin",
  "tenant_id": "tenant_uuid",
  "tenant_slug": "franchise-name",
  "is_impersonating": false,
  "exp": "expiry_timestamp"
}
```

### Token Security

1. **Token Expiry**: 7 days default, configurable
2. **Token Rotation**: New token issued on tenant switch
3. **Impersonation Tracking**: Separate flag for audit trail
4. **No Sensitive Data**: Password hashes never included

## Tenant Suspension

When a tenant is suspended (e.g., non-payment):

1. Tenant status set to `suspended` or `pending_payment`
2. All API calls for that tenant are blocked (HTTP 403)
3. Login shows suspension message
4. Only billing/contact endpoints remain accessible
5. Super/Master Admin can still access for support

```python
# Enforcement in middleware:
if tenant_status == TenantStatus.SUSPENDED:
    raise HTTPException(
        status_code=403,
        detail="Tenant account is suspended. Please contact support."
    )
```

## Audit Logging

### Logged Events

| Event | Trigger |
|-------|---------|
| `tenant_created` | New tenant created |
| `tenant_suspended` | Tenant suspended |
| `tenant_reactivated` | Tenant reactivated |
| `user_created` | New user created |
| `user_role_changed` | User role modified |
| `impersonation_start` | Admin starts impersonating |
| `impersonation_end` | Admin stops impersonating |
| `vehicle_created` | New vehicle added |
| `vehicle_deleted` | Vehicle removed |
| `unauthorized_access_attempt` | Security violation detected |

### Audit Record Structure

```json
{
  "id": "event_uuid",
  "actor_user_id": "who did it",
  "actor_email": "user@example.com",
  "tenant_id": "affected tenant (nullable)",
  "action": "tenant_suspended",
  "resource_type": "tenant",
  "resource_id": "resource uuid",
  "meta": {"additional": "context"},
  "ip_address": "client IP",
  "created_at": "timestamp"
}
```

## Security Best Practices Implemented

### Input Validation

1. All endpoints use Pydantic models for request validation
2. Unknown fields are rejected
3. Type coercion is explicit

### Secure Defaults

1. New users are `staff` role by default
2. New tenants are `active` status
3. All resources require tenant context

### Error Handling

1. Generic errors for security-sensitive operations
2. 404 returned for cross-tenant access (not 403)
3. No stack traces in production responses

## Testing Tenant Isolation

### Critical Test Cases

1. **Cross-Tenant Data Access**
   ```
   User in Tenant A cannot:
   - List vehicles from Tenant B
   - View booking from Tenant B (even with ID)
   - Update/delete resources from Tenant B
   ```

2. **Tenant ID Override Prevention**
   ```
   POST /vehicles with body {"tenant_id": "other_tenant"}
   → tenant_id from body is IGNORED
   → tenant_id from JWT context is used
   ```

3. **Impersonation Audit**
   ```
   Master Admin impersonates Tenant A
   → Audit log records IMPERSONATION_START
   → All actions logged with is_impersonating=true
   → Stop impersonation logs IMPERSONATION_END
   ```

## Incident Response

### Suspected Breach

1. Check audit logs for `unauthorized_access_attempt` events
2. Review `tenant_isolation_violation` events
3. Suspend affected tenant if compromised
4. Rotate affected user credentials

### Contact

For security concerns, contact: security@quickwing.com

---

*Last Updated: March 2026*
*Version: 1.0*
