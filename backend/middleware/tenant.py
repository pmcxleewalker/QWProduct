"""
Tenant Middleware - Enforces tenant isolation on all routes
"""
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from datetime import datetime, timezone
import os

from models.tenant import UserRole, TenantContext, TenantStatus

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"

security = HTTPBearer()


async def get_tenant_context(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TenantContext:
    """
    Extract and validate tenant context from JWT token or X-Tenant-ID header.
    This is the primary security gate for all tenant-scoped operations.
    """
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID"
        )
    
    # Import db here to avoid circular imports
    from server import db
    
    # Verify user still exists and is active
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    role = UserRole(payload.get("role", "staff"))
    is_impersonating = payload.get("is_impersonating", False)
    
    # Get tenant_id from token first, then fall back to header
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        tenant_id = request.headers.get("X-Tenant-ID")
    
    # If tenant_id is set, verify tenant is still active and user has membership
    tenant_name = None
    tenant_slug = None
    
    if tenant_id:
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant not found"
            )
        
        tenant_status = TenantStatus(tenant.get("status", "active"))
        
        # Check tenant status - only active tenants can proceed
        if tenant_status == TenantStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant account is suspended. Please contact support."
            )
        elif tenant_status == TenantStatus.PENDING_PAYMENT:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Tenant account is pending payment. Please update your subscription."
            )
        
        tenant_name = tenant.get("name")
        tenant_slug = tenant.get("slug")
        
        # Verify user has membership in this tenant (unless super/master admin or impersonating)
        # When impersonating, the original_role is preserved in the token, so we skip membership check
        if role not in [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN] and not is_impersonating:
            membership = await db.memberships.find_one({
                "user_id": user_id,
                "tenant_id": tenant_id
            }, {"_id": 0})
            
            if not membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this tenant"
                )
    
    return TenantContext(
        user_id=user_id,
        user_email=payload.get("email", ""),
        user_name=user.get("name"),
        tenant_id=tenant_id,
        tenant_name=tenant_name,
        tenant_slug=tenant_slug,
        role=role,
        is_impersonating=is_impersonating
    )


async def require_tenant_context(
    context: TenantContext = Depends(get_tenant_context)
) -> TenantContext:
    """
    Require that a tenant is selected.
    Use this for all tenant-scoped routes.
    """
    if not context.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant selected. Please select a tenant first."
        )
    return context


async def require_tenant_admin(
    context: TenantContext = Depends(require_tenant_context)
) -> TenantContext:
    """
    Require admin or higher role within tenant.
    Master Admin, Admin, or Super Admin can access.
    """
    if context.role not in [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return context


async def require_admin(
    context: TenantContext = Depends(require_tenant_context)
) -> TenantContext:
    """
    Require admin privileges within tenant context.
    Allows: Super Admin, Master Admin, or Admin roles.
    Use this for tenant-level admin operations (managing vehicles, users within tenant, etc.)
    """
    if context.role not in [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return context


async def require_super_admin(
    context: TenantContext = Depends(get_tenant_context)
) -> TenantContext:
    """
    Require super admin role (platform owner).
    """
    if context.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return context


async def require_platform_admin(
    context: TenantContext = Depends(get_tenant_context)
) -> TenantContext:
    """
    Require super admin or master admin role.
    """
    if context.role not in [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required"
        )
    return context


def validate_resource_tenant(resource: dict, tenant_id: str, resource_type: str = "resource"):
    """
    CRITICAL SECURITY FUNCTION
    Validates that a resource belongs to the current tenant.
    Must be called for EVERY resource access by ID.
    """
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_type.capitalize()} not found"
        )
    
    resource_tenant = resource.get("tenant_id")
    if resource_tenant != tenant_id:
        # This is a potential security breach attempt - should be logged
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,  # Use 404 to not reveal existence
            detail=f"{resource_type.capitalize()} not found"
        )


class TenantQueryBuilder:
    """
    Helper class to build tenant-scoped queries.
    Ensures tenant_id is ALWAYS included in queries.
    """
    
    @staticmethod
    def scope(tenant_id: str, additional_filters: dict = None) -> dict:
        """
        Build a query scoped to the current tenant.
        ALWAYS use this for tenant-scoped collection queries.
        """
        query = {"tenant_id": tenant_id}
        if additional_filters:
            query.update(additional_filters)
        return query
    
    @staticmethod
    def scope_by_id(tenant_id: str, resource_id: str, id_field: str = "id") -> dict:
        """
        Build a query for a specific resource within a tenant.
        """
        return {
            "tenant_id": tenant_id,
            id_field: resource_id
        }
