"""
Quick Wing Fleet Management - Multi-Tenant SaaS Platform
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import timedelta, datetime, timezone
import uuid
import qrcode
from io import BytesIO
from passlib.context import CryptContext
from jose import jwt
import httpx

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Import models
from models.tenant import (
    UserRole, TenantStatus, TenantPlan,
    TenantCreate, TenantUpdate, Tenant, TenantUsageStats,
    UserCreate, UserLogin, User, UserResponse, UserWithMemberships,
    MembershipCreate, Membership,
    TenantContext, TenantSelector,
    AuditAction, Token
)
from models.resources import (
    VehicleCreate, VehicleUpdate, Vehicle,
    BookingCreate, BookingUpdate, Booking,
    StatusUpdate, ProviderCreate, Provider,
    MessageCreate, Message, TodoCreate, Todo,
    LiftRequestCreate, LiftRequest
)
from models.invoice import (
    Invoice, InvoiceCreate, InvoiceUpdate, InvoiceStatus, InvoiceItem,
    CompanySettings, CompanySettingsUpdate
)
from middleware.tenant import (
    get_tenant_context, require_tenant_context, require_admin,
    require_super_admin, require_platform_admin,
    validate_resource_tenant, TenantQueryBuilder
)
from services.audit import AuditService

# Initialize services
audit_service = AuditService(db)

# Create app
app = FastAPI(title="Quick Wing Fleet Management - Multi-Tenant SaaS")
api_router = APIRouter(prefix="/api")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ==================== AUTH HELPERS ====================

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ==================== ROOT ENDPOINT ====================

@api_router.get("/")
async def root():
    return {"message": "Quick Wing Fleet Management API - Multi-Tenant SaaS"}


# ==================== AUTHENTICATION ROUTES ====================

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin, request: Request):
    """
    Login and get access token.
    Returns user info and list of tenant memberships.
    """
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=403,
            detail="Account is deactivated"
        )
    
    # Get user's memberships
    memberships = await db.memberships.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Build tenant list with details
    tenant_list = []
    default_tenant_id = None
    user_role = UserRole.STAFF  # Default role
    
    for membership in memberships:
        tenant = await db.tenants.find_one(
            {"id": membership["tenant_id"]},
            {"_id": 0}
        )
        if tenant:
            # Check if tenant is accessible
            if tenant.get("status") != TenantStatus.SUSPENDED.value:
                tenant_info = {
                    "tenant_id": tenant["id"],
                    "tenant_name": tenant["name"],
                    "tenant_slug": tenant["slug"],
                    "role": membership["role"],
                    "status": tenant.get("status", "active")
                }
                tenant_list.append(tenant_info)
                
                # Use first active tenant as default
                if not default_tenant_id and tenant.get("status") == TenantStatus.ACTIVE.value:
                    default_tenant_id = tenant["id"]
                    user_role = UserRole(membership["role"])
    
    # Check for super/master admin (no tenant membership required)
    super_membership = await db.memberships.find_one({
        "user_id": user["id"],
        "role": {"$in": [UserRole.SUPER_ADMIN.value, UserRole.MASTER_ADMIN.value]}
    }, {"_id": 0})
    
    if super_membership:
        user_role = UserRole(super_membership["role"])
    
    # Build token payload
    token_data = {
        "sub": user["id"],
        "email": user["email"],
        "role": user_role.value,
        "tenant_id": default_tenant_id if len(tenant_list) == 1 else None,
        "is_impersonating": False
    }
    
    access_token = create_access_token(token_data)
    
    # Get active tenant details if single tenant
    active_tenant = None
    if len(tenant_list) == 1:
        active_tenant = tenant_list[0]
    
    # Log login event
    await audit_service.log(
        actor_user_id=user["id"],
        actor_email=user["email"],
        action=AuditAction.USER_LOGIN,
        tenant_id=default_tenant_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name"),
            "role": user_role.value,
            "require_password_change": user.get("require_password_change", False)
        },
        "tenants": tenant_list,
        "active_tenant": active_tenant
    }


@api_router.post("/auth/select-tenant")
async def select_tenant(
    selection: TenantSelector,
    context: TenantContext = Depends(get_tenant_context),
    request: Request = None
):
    """
    Select a tenant after login (for users with multiple memberships).
    Returns a new token with the selected tenant context.
    """
    tenant = await db.tenants.find_one({"id": selection.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Check tenant status
    if tenant.get("status") == TenantStatus.SUSPENDED.value:
        raise HTTPException(
            status_code=403,
            detail="This tenant account is suspended"
        )
    
    # Verify membership (unless super/master admin)
    role = context.role
    if context.role not in [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN]:
        membership = await db.memberships.find_one({
            "user_id": context.user_id,
            "tenant_id": selection.tenant_id
        }, {"_id": 0})
        
        if not membership:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this tenant"
            )
        role = UserRole(membership["role"])
    
    # Create new token with tenant context
    token_data = {
        "sub": context.user_id,
        "email": context.user_email,
        "role": role.value,
        "tenant_id": selection.tenant_id,
        "tenant_slug": tenant["slug"],
        "is_impersonating": False
    }
    
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "active_tenant": {
            "tenant_id": tenant["id"],
            "tenant_name": tenant["name"],
            "tenant_slug": tenant["slug"],
            "role": role.value,
            "status": tenant.get("status", "active")
        }
    }


@api_router.get("/auth/me")
async def get_current_user_info(context: TenantContext = Depends(get_tenant_context)):
    """Get current user info and context"""
    user = await db.users.find_one({"id": context.user_id}, {"_id": 0, "password_hash": 0})
    
    # Get all memberships
    memberships = await db.memberships.find(
        {"user_id": context.user_id},
        {"_id": 0}
    ).to_list(100)
    
    tenant_list = []
    for membership in memberships:
        tenant = await db.tenants.find_one({"id": membership["tenant_id"]}, {"_id": 0})
        if tenant:
            tenant_list.append({
                "tenant_id": tenant["id"],
                "tenant_name": tenant["name"],
                "tenant_slug": tenant["slug"],
                "role": membership["role"],
                "status": tenant.get("status")
            })
    
    return {
        "user": user,
        "current_context": {
            "tenant_id": context.tenant_id,
            "tenant_name": context.tenant_name,
            "role": context.role.value,
            "is_impersonating": context.is_impersonating
        },
        "memberships": tenant_list
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    context: TenantContext = Depends(get_tenant_context),
    request: Request = None
):
    """
    Change user's password. Required for staff on first login.
    """
    user = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(password_data.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password and clear require_password_change flag
    new_hash = get_password_hash(password_data.new_password)
    await db.users.update_one(
        {"id": context.user_id},
        {"$set": {"password_hash": new_hash, "require_password_change": False}}
    )
    
    # Log audit event
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_UPDATED,
        resource_type="user",
        resource_id=context.user_id,
        meta={"action": "password_changed"},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": "Password changed successfully"}


# ==================== PUBLIC TENANT LOOKUP ====================

@api_router.get("/tenants/by-slug/{slug}")
async def get_tenant_by_slug(slug: str):
    """
    Public endpoint to get tenant info by slug.
    Used for branded login pages.
    """
    tenant = await db.tenants.find_one(
        {"slug": slug},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "status": 1}
    )
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return tenant


# ==================== SUPER ADMIN - PLATFORM MANAGEMENT ====================

@api_router.post("/platform/tenants", response_model=dict)
async def create_tenant(
    tenant_data: TenantCreate,
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None
):
    """
    Create a new tenant (franchise) with auto-generated Master Admin.
    Returns tenant details and Master Admin credentials.
    """
    import secrets
    import string
    
    # Check slug uniqueness
    existing = await db.tenants.find_one({"slug": tenant_data.slug}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Tenant slug already exists")
    
    # Set plan limits
    plan_limits = {
        TenantPlan.FREE: {"max_vehicles": 3, "max_users": 5},
        TenantPlan.STARTER: {"max_vehicles": 10, "max_users": 20},
        TenantPlan.PROFESSIONAL: {"max_vehicles": 50, "max_users": 100},
        TenantPlan.ENTERPRISE: {"max_vehicles": 999, "max_users": 999},
    }
    limits = plan_limits.get(tenant_data.plan, plan_limits[TenantPlan.STARTER])
    
    tenant_id = str(uuid.uuid4())
    tenant = {
        "id": tenant_id,
        "name": tenant_data.name,
        "slug": tenant_data.slug,
        "status": TenantStatus.ACTIVE.value,
        "plan": tenant_data.plan.value,
        "max_vehicles": limits["max_vehicles"],
        "max_users": limits["max_users"],
        "subscription_expires_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tenants.insert_one(tenant)
    
    # Remove MongoDB's _id before returning
    tenant.pop('_id', None)
    
    # Generate Master Admin credentials
    # Auto-generate email based on slug if not provided
    master_email = tenant_data.master_admin_email or f"admin.{tenant_data.slug}@quickwing.com"
    master_name = tenant_data.master_admin_name or f"{tenant_data.name} Admin"
    
    # Generate secure random password (12 chars: letters + digits)
    alphabet = string.ascii_letters + string.digits
    master_password = ''.join(secrets.choice(alphabet) for _ in range(12))
    
    # Check if user with this email already exists
    existing_user = await db.users.find_one({"email": master_email}, {"_id": 0})
    
    if existing_user:
        # User exists - just add them as Master Admin of this tenant
        user_id = existing_user["id"]
        master_password = None  # Don't show password for existing user
    else:
        # Create new Master Admin user
        user_id = str(uuid.uuid4())
        master_user = {
            "id": user_id,
            "email": master_email,
            "name": master_name,
            "password_hash": get_password_hash(master_password),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(master_user)
    
    # Create Master Admin membership for this tenant
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "tenant_id": tenant_id,
        "role": UserRole.MASTER_ADMIN.value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.memberships.insert_one(membership)
    
    # Log audit event
    await audit_service.log_tenant_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.TENANT_CREATED,
        tenant_id=tenant["id"],
        meta={
            "tenant_name": tenant["name"], 
            "plan": tenant["plan"],
            "master_admin_email": master_email
        },
        ip_address=request.client.host if request and request.client else None
    )
    
    # Build the tenant login URL - Path-based branded URL
    # Format: https://quick-wing.com/{tenant_slug}/login
    # HARDCODED to quick-wing.com - ignore any environment variables
    base_url = 'https://quick-wing.com'
    tenant_login_url = f"{base_url}/{tenant_data.slug}/login"
    staff_login_url = f"{base_url}/{tenant_data.slug}/login"
    
    response = {
        "message": "Tenant created successfully",
        "tenant": tenant,
        "master_admin": {
            "email": master_email,
            "name": master_name,
            "password": master_password,  # Will be None for existing users
            "is_new_user": master_password is not None
        },
        "login_url": tenant_login_url,
        "staff_login_url": staff_login_url,
        "instructions": f"Share the login URL and credentials with the franchise owner. They can then create Admin and Staff accounts for their team. Staff use the same login URL: {staff_login_url}"
    }
    
    return response


@api_router.get("/platform/tenants")
async def list_tenants(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    context: TenantContext = Depends(require_platform_admin)
):
    """List all tenants (Super/Master Admin only) with master admin info"""
    query = {}
    if status:
        query["status"] = status
    
    tenants = await db.tenants.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.tenants.count_documents(query)
    
    # Enrich each tenant with master admin info
    for tenant in tenants:
        # Find the master admin membership for this tenant
        master_membership = await db.memberships.find_one({
            "tenant_id": tenant["id"],
            "role": "master_admin"
        }, {"_id": 0})
        
        if master_membership:
            # Get the user details
            master_user = await db.users.find_one({
                "id": master_membership["user_id"]
            }, {"_id": 0, "id": 1, "email": 1, "name": 1})
            
            if master_user:
                tenant["master_admin_email"] = master_user.get("email")
                tenant["master_admin_name"] = master_user.get("name")
    
    return {"tenants": tenants, "total": total}


@api_router.get("/platform/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    context: TenantContext = Depends(require_platform_admin)
):
    """Get tenant details with usage stats"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get usage stats
    vehicles_count = await db.vehicles.count_documents({"tenant_id": tenant_id})
    users_count = await db.memberships.count_documents({"tenant_id": tenant_id})
    bookings_count = await db.bookings.count_documents({"tenant_id": tenant_id})
    
    # Get this month's bookings
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_this_month = await db.bookings.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    return {
        "tenant": tenant,
        "usage": {
            "vehicles": vehicles_count,
            "max_vehicles": tenant.get("max_vehicles", 10),
            "users": users_count,
            "max_users": tenant.get("max_users", 20),
            "bookings_total": bookings_count,
            "bookings_this_month": bookings_this_month
        }
    }


@api_router.put("/platform/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    update_data: TenantUpdate,
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None
):
    """Update tenant details"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        # Convert enums to values
        if "status" in update_dict:
            update_dict["status"] = update_dict["status"].value
        if "plan" in update_dict:
            update_dict["plan"] = update_dict["plan"].value
        
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.tenants.update_one({"id": tenant_id}, {"$set": update_dict})
    
    # Determine audit action
    audit_action = AuditAction.TENANT_UPDATED
    if update_data.status == TenantStatus.SUSPENDED:
        audit_action = AuditAction.TENANT_SUSPENDED
    elif update_data.status == TenantStatus.ACTIVE:
        audit_action = AuditAction.TENANT_REACTIVATED
    
    await audit_service.log_tenant_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=audit_action,
        tenant_id=tenant_id,
        meta=update_dict,
        ip_address=request.client.host if request and request.client else None
    )
    
    updated = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    return {"message": "Tenant updated successfully", "tenant": updated}


@api_router.post("/platform/tenants/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: str,
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None
):
    """Suspend a tenant (pause account for non-payment, etc.)"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {
            "status": TenantStatus.SUSPENDED.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await audit_service.log_tenant_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.TENANT_SUSPENDED,
        tenant_id=tenant_id,
        meta={"previous_status": tenant.get("status")},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": "Tenant suspended successfully"}


@api_router.post("/platform/tenants/{tenant_id}/reactivate")
async def reactivate_tenant(
    tenant_id: str,
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None
):
    """Reactivate a suspended tenant"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {
            "status": TenantStatus.ACTIVE.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await audit_service.log_tenant_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.TENANT_REACTIVATED,
        tenant_id=tenant_id,
        meta={"previous_status": tenant.get("status")},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": "Tenant reactivated successfully"}


@api_router.post("/platform/tenants/{tenant_id}/impersonate")
async def impersonate_tenant(
    tenant_id: str,
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None
):
    """
    Start impersonating a tenant (Master/Super Admin only).
    Returns a new token with tenant context.
    """
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Create impersonation token
    token_data = {
        "sub": context.user_id,
        "email": context.user_email,
        "role": UserRole.ADMIN.value,  # Downgrade to tenant admin during impersonation
        "tenant_id": tenant_id,
        "tenant_slug": tenant["slug"],
        "is_impersonating": True,
        "original_role": context.role.value
    }
    
    access_token = create_access_token(token_data)
    
    # Log impersonation start
    await audit_service.log_impersonation(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        tenant_id=tenant_id,
        action=AuditAction.IMPERSONATION_START,
        meta={"tenant_name": tenant["name"]},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "message": f"Now impersonating tenant: {tenant['name']}",
        "tenant": {
            "id": tenant["id"],
            "name": tenant["name"],
            "slug": tenant["slug"]
        }
    }


@api_router.post("/platform/stop-impersonation")
async def stop_impersonation(
    context: TenantContext = Depends(get_tenant_context),
    request: Request = None
):
    """Stop impersonating and return to admin mode"""
    if not context.is_impersonating:
        raise HTTPException(status_code=400, detail="Not currently impersonating")
    
    # Get user's original role
    membership = await db.memberships.find_one({
        "user_id": context.user_id,
        "role": {"$in": [UserRole.SUPER_ADMIN.value, UserRole.MASTER_ADMIN.value]}
    }, {"_id": 0})
    
    original_role = UserRole(membership["role"]) if membership else UserRole.STAFF
    
    # Create new token without tenant context
    token_data = {
        "sub": context.user_id,
        "email": context.user_email,
        "role": original_role.value,
        "tenant_id": None,
        "is_impersonating": False
    }
    
    access_token = create_access_token(token_data)
    
    # Log impersonation end
    await audit_service.log_impersonation(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        tenant_id=context.tenant_id,
        action=AuditAction.IMPERSONATION_END,
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "message": "Impersonation ended"
    }


# ==================== DELETE TENANT ====================

class DeleteTenantRequest(BaseModel):
    password: str
    confirm: bool = False

@api_router.delete("/platform/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    delete_request: DeleteTenantRequest,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None
):
    """
    Permanently delete a tenant and all associated data.
    Requires super admin password confirmation.
    """
    # Verify super admin password
    user = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not user or not verify_password(delete_request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    if not delete_request.confirm:
        raise HTTPException(status_code=400, detail="Please confirm deletion")
    
    # Get tenant info
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant_name = tenant["name"]
    
    # Delete all tenant data
    deleted_vehicles = await db.vehicles.delete_many({"tenant_id": tenant_id})
    deleted_bookings = await db.bookings.delete_many({"tenant_id": tenant_id})
    deleted_statuses = await db.car_statuses.delete_many({"tenant_id": tenant_id})
    
    # Get users who only belong to this tenant
    memberships = await db.memberships.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
    users_to_delete = []
    
    for membership in memberships:
        # Check if user has other memberships
        other_memberships = await db.memberships.count_documents({
            "user_id": membership["user_id"],
            "tenant_id": {"$ne": tenant_id}
        })
        if other_memberships == 0:
            # User only belongs to this tenant - mark for deletion
            users_to_delete.append(membership["user_id"])
    
    # Delete memberships
    deleted_memberships = await db.memberships.delete_many({"tenant_id": tenant_id})
    
    # Delete users who only belonged to this tenant
    deleted_users = 0
    for user_id in users_to_delete:
        await db.users.delete_one({"id": user_id})
        deleted_users += 1
    
    # Delete tenant
    await db.tenants.delete_one({"id": tenant_id})
    
    # Log audit event
    await audit_service.log_tenant_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.TENANT_DELETED,
        tenant_id=tenant_id,
        meta={
            "tenant_name": tenant_name,
            "deleted_vehicles": deleted_vehicles.deleted_count,
            "deleted_bookings": deleted_bookings.deleted_count,
            "deleted_users": deleted_users
        },
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "message": f"Tenant '{tenant_name}' permanently deleted",
        "deleted": {
            "vehicles": deleted_vehicles.deleted_count,
            "bookings": deleted_bookings.deleted_count,
            "memberships": deleted_memberships.deleted_count,
            "users": deleted_users
        }
    }


# ==================== SUPER ADMIN USER MANAGEMENT ====================

class ResetPasswordRequest(BaseModel):
    new_password: str
    admin_password: str  # Super admin's password for verification

@api_router.post("/platform/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    reset_request: ResetPasswordRequest,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None
):
    """
    Super admin can reset any user's password.
    Requires super admin password confirmation.
    """
    # Verify super admin password
    admin = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not admin or not verify_password(reset_request.admin_password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    # Get target user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    new_hash = get_password_hash(reset_request.new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": new_hash}})
    
    # Log audit event
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_UPDATED,
        resource_type="user",
        resource_id=user_id,
        meta={"action": "password_reset", "target_email": user["email"]},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": f"Password reset successfully for {user['email']}"}


class UpdateUserRoleRequest(BaseModel):
    tenant_id: str
    new_role: UserRole
    admin_password: str

@api_router.post("/platform/users/{user_id}/update-role")
async def update_user_role(
    user_id: str,
    role_request: UpdateUserRoleRequest,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None
):
    """
    Super admin can change any user's role within a tenant.
    """
    # Verify super admin password
    admin = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not admin or not verify_password(role_request.admin_password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    # Get target user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get membership
    membership = await db.memberships.find_one({
        "user_id": user_id,
        "tenant_id": role_request.tenant_id
    }, {"_id": 0})
    
    if not membership:
        raise HTTPException(status_code=404, detail="User is not a member of this tenant")
    
    old_role = membership["role"]
    
    # Update role
    await db.memberships.update_one(
        {"user_id": user_id, "tenant_id": role_request.tenant_id},
        {"$set": {"role": role_request.new_role.value}}
    )
    
    # Log audit event
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_UPDATED,
        tenant_id=role_request.tenant_id,
        resource_type="user",
        resource_id=user_id,
        meta={
            "action": "role_change",
            "target_email": user["email"],
            "old_role": old_role,
            "new_role": role_request.new_role.value
        },
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "message": f"Role updated for {user['email']}",
        "old_role": old_role,
        "new_role": role_request.new_role.value
    }


@api_router.delete("/platform/users/{user_id}/remove-from-tenant/{tenant_id}")
async def remove_user_from_tenant(
    user_id: str,
    tenant_id: str,
    admin_password: str,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None
):
    """
    Super admin can remove a user from a tenant.
    """
    # Verify super admin password
    admin = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not admin or not verify_password(admin_password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    # Get target user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete membership
    result = await db.memberships.delete_one({
        "user_id": user_id,
        "tenant_id": tenant_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User is not a member of this tenant")
    
    # Log audit event
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_REMOVED,
        tenant_id=tenant_id,
        resource_type="user",
        resource_id=user_id,
        meta={"target_email": user["email"]},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": f"User {user['email']} removed from tenant"}


class AddUserToTenantRequest(BaseModel):
    tenant_id: str
    role: str = "staff"
    admin_password: str


@api_router.post("/platform/users/{user_id}/add-to-tenant")
async def add_user_to_tenant(
    user_id: str,
    add_request: AddUserToTenantRequest,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None
):
    """
    Super admin can add an existing user to a tenant.
    """
    # Verify super admin password
    admin = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not admin or not verify_password(add_request.admin_password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    # Get target user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get tenant
    tenant = await db.tenants.find_one({"id": add_request.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Check if membership already exists
    existing = await db.memberships.find_one({
        "user_id": user_id,
        "tenant_id": add_request.tenant_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this tenant")
    
    # Create membership
    membership = {
        "id": str(uuid4()),
        "user_id": user_id,
        "tenant_id": add_request.tenant_id,
        "role": add_request.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.memberships.insert_one(membership)
    
    # Log audit event
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_CREATED,
        tenant_id=add_request.tenant_id,
        resource_type="membership",
        resource_id=membership["id"],
        meta={
            "action": "add_to_tenant",
            "target_email": user["email"],
            "role": add_request.role,
            "tenant_name": tenant["name"]
        },
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "message": f"User {user['email']} added to {tenant['name']}",
        "membership_id": membership["id"]
    }


@api_router.get("/platform/users/{user_id}")
async def get_user_details(
    user_id: str,
    context: TenantContext = Depends(require_super_admin)
):
    """
    Get detailed user information including all tenant memberships.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all memberships
    memberships = await db.memberships.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    tenant_memberships = []
    for m in memberships:
        if m.get("tenant_id"):
            tenant = await db.tenants.find_one({"id": m["tenant_id"]}, {"_id": 0})
            if tenant:
                tenant_memberships.append({
                    "tenant_id": tenant["id"],
                    "tenant_name": tenant["name"],
                    "tenant_slug": tenant["slug"],
                    "role": m["role"],
                    "status": tenant.get("status")
                })
        else:
            # Platform-level membership (super admin)
            tenant_memberships.append({
                "tenant_id": None,
                "tenant_name": "Platform",
                "role": m["role"]
            })
    
    return {
        "user": user,
        "memberships": tenant_memberships
    }


@api_router.get("/platform/users")
async def list_all_users(
    context: TenantContext = Depends(require_super_admin),
    tenant_id: Optional[str] = None
):
    """
    List all users, optionally filtered by tenant.
    """
    if tenant_id:
        # Get users for specific tenant
        memberships = await db.memberships.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
        user_ids = [m["user_id"] for m in memberships]
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(1000)
        
        # Add role info
        for user in users:
            membership = next((m for m in memberships if m["user_id"] == user["id"]), None)
            user["role"] = membership["role"] if membership else None
    else:
        # Get all users
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
        
        # Add membership count for each user
        for user in users:
            membership_count = await db.memberships.count_documents({"user_id": user["id"]})
            user["tenant_count"] = membership_count
    
    return {"users": users, "total": len(users)}


@api_router.get("/platform/stats")
async def get_platform_stats(context: TenantContext = Depends(require_platform_admin)):
    """Get overall platform statistics"""
    total_tenants = await db.tenants.count_documents({})
    active_tenants = await db.tenants.count_documents({"status": TenantStatus.ACTIVE.value})
    suspended_tenants = await db.tenants.count_documents({"status": TenantStatus.SUSPENDED.value})
    total_users = await db.users.count_documents({})
    total_vehicles = await db.vehicles.count_documents({})
    total_bookings = await db.bookings.count_documents({})
    
    # Get bookings this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_this_month = await db.bookings.count_documents({
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    return {
        "tenants": {
            "total": total_tenants,
            "active": active_tenants,
            "suspended": suspended_tenants
        },
        "users": total_users,
        "vehicles": total_vehicles,
        "bookings": {
            "total": total_bookings,
            "this_month": bookings_this_month
        }
    }


@api_router.get("/platform/audit-log")
async def get_platform_audit_log(
    tenant_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    context: TenantContext = Depends(require_platform_admin)
):
    """Get audit log entries"""
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if action:
        query["action"] = action
    
    events = await db.audit_events.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"events": events}


# ==================== COMPANY SETTINGS ====================

@api_router.get("/platform/settings")
async def get_company_settings(
    context: TenantContext = Depends(require_platform_admin)
):
    """Get company settings for invoices and branding"""
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        # Return defaults
        settings = CompanySettings().model_dump()
    return settings


@api_router.put("/platform/settings")
async def update_company_settings(
    settings_update: CompanySettingsUpdate,
    context: TenantContext = Depends(require_super_admin)
):
    """Update company settings (Super Admin only)"""
    # Get existing settings
    existing = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not existing:
        existing = CompanySettings().model_dump()
    
    # Update with new values
    update_data = {k: v for k, v in settings_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.company_settings.update_one(
        {"id": "company_settings"},
        {"$set": {**existing, **update_data, "id": "company_settings"}},
        upsert=True
    )
    
    updated = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    return {"message": "Settings updated", "settings": updated}


# ==================== INVOICES ====================

async def generate_invoice_number():
    """Generate next invoice number"""
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    prefix = settings.get("invoice_prefix", "INV") if settings else "INV"
    year = datetime.now().year
    
    # Get count of invoices this year
    count = await db.invoices.count_documents({
        "invoice_number": {"$regex": f"^{prefix}-{year}-"}
    })
    
    return f"{prefix}-{year}-{str(count + 1).zfill(4)}"


@api_router.post("/platform/invoices")
async def create_invoice(
    invoice_data: InvoiceCreate,
    context: TenantContext = Depends(require_platform_admin)
):
    """Create a new invoice for a tenant"""
    # Get tenant info
    tenant = await db.tenants.find_one({"id": invoice_data.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get company settings for defaults
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    default_tax = settings.get("default_tax_rate", 23.0) if settings else 23.0
    
    # Create invoice
    invoice_number = await generate_invoice_number()
    
    # Calculate item amounts
    items = []
    for item in invoice_data.items:
        item_dict = item.model_dump()
        item_dict["amount"] = item.quantity * item.unit_price
        items.append(item_dict)
    
    invoice = Invoice(
        invoice_number=invoice_number,
        tenant_id=invoice_data.tenant_id,
        tenant_name=tenant["name"],
        items=items,
        tax_rate=invoice_data.tax_rate or default_tax,
        due_date=invoice_data.due_date,
        notes=invoice_data.notes
    )
    invoice.calculate_totals()
    
    invoice_dict = invoice.model_dump()
    await db.invoices.insert_one(invoice_dict)
    invoice_dict.pop("_id", None)
    
    return {"message": "Invoice created", "invoice": invoice_dict}


@api_router.get("/platform/invoices")
async def list_invoices(
    context: TenantContext = Depends(require_platform_admin),
    tenant_id: Optional[str] = None,
    status: Optional[InvoiceStatus] = None,
    limit: int = 100
):
    """List all invoices with optional filters"""
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if status:
        query["status"] = status.value
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get summary stats
    total_amount = sum(inv.get("total", 0) for inv in invoices)
    paid_amount = sum(inv.get("total", 0) for inv in invoices if inv.get("status") == "paid")
    pending_amount = total_amount - paid_amount
    
    return {
        "invoices": invoices,
        "total": len(invoices),
        "summary": {
            "total_amount": round(total_amount, 2),
            "paid_amount": round(paid_amount, 2),
            "pending_amount": round(pending_amount, 2)
        }
    }


@api_router.get("/platform/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    context: TenantContext = Depends(require_platform_admin)
):
    """Get invoice details"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get company settings for PDF generation
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    
    return {"invoice": invoice, "company_settings": settings}


@api_router.put("/platform/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    update_data: InvoiceUpdate,
    context: TenantContext = Depends(require_platform_admin)
):
    """Update invoice status"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_dict = {k: v.value if isinstance(v, InvoiceStatus) else v 
                   for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if update_data.status == InvoiceStatus.PAID and not update_data.paid_date:
        update_dict["paid_date"] = datetime.now(timezone.utc).isoformat()
    
    await db.invoices.update_one({"id": invoice_id}, {"$set": update_dict})
    
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return {"message": "Invoice updated", "invoice": updated}


@api_router.delete("/platform/invoices/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    context: TenantContext = Depends(require_super_admin)
):
    """Delete an invoice (Super Admin only, draft/cancelled only)"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.get("status") not in ["draft", "cancelled"]:
        raise HTTPException(status_code=400, detail="Can only delete draft or cancelled invoices")
    
    await db.invoices.delete_one({"id": invoice_id})
    return {"message": "Invoice deleted"}


# ==================== REPORTS ====================

@api_router.get("/platform/reports/executive-summary")
async def get_executive_summary(
    context: TenantContext = Depends(require_platform_admin)
):
    """Get executive summary with high-level metrics"""
    # Tenant stats
    total_tenants = await db.tenants.count_documents({})
    active_tenants = await db.tenants.count_documents({"status": "active"})
    suspended_tenants = await db.tenants.count_documents({"status": "suspended"})
    
    # User stats
    total_users = await db.users.count_documents({})
    
    # Resource stats
    total_vehicles = await db.vehicles.count_documents({})
    total_bookings = await db.bookings.count_documents({})
    
    # Invoice stats
    all_invoices = await db.invoices.find({}, {"_id": 0, "total": 1, "status": 1}).to_list(1000)
    total_revenue = sum(inv.get("total", 0) for inv in all_invoices if inv.get("status") == "paid")
    pending_revenue = sum(inv.get("total", 0) for inv in all_invoices if inv.get("status") in ["sent", "overdue"])
    overdue_invoices = len([inv for inv in all_invoices if inv.get("status") == "overdue"])
    
    # Get tenants by plan
    plans = await db.tenants.aggregate([
        {"$group": {"_id": "$plan", "count": {"$sum": 1}}}
    ]).to_list(10)
    plan_distribution = {p["_id"]: p["count"] for p in plans}
    
    # Recent activity
    recent_tenants = await db.tenants.find(
        {}, {"_id": 0, "name": 1, "slug": 1, "created_at": 1, "status": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "summary": {
            "tenants": {
                "total": total_tenants,
                "active": active_tenants,
                "suspended": suspended_tenants
            },
            "users": total_users,
            "vehicles": total_vehicles,
            "bookings": total_bookings,
            "revenue": {
                "total_collected": round(total_revenue, 2),
                "pending": round(pending_revenue, 2),
                "overdue_invoices": overdue_invoices
            },
            "plan_distribution": plan_distribution
        },
        "recent_tenants": recent_tenants,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/platform/reports/franchises")
async def get_franchises_report(
    context: TenantContext = Depends(require_platform_admin),
    status: Optional[str] = None,
    plan: Optional[str] = None
):
    """Complete list of all franchises with details"""
    query = {}
    if status:
        query["status"] = status
    if plan:
        query["plan"] = plan
    
    tenants = await db.tenants.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with stats
    enriched_tenants = []
    for tenant in tenants:
        tenant_id = tenant["id"]
        
        # Get counts
        user_count = await db.memberships.count_documents({"tenant_id": tenant_id})
        vehicle_count = await db.vehicles.count_documents({"tenant_id": tenant_id})
        booking_count = await db.bookings.count_documents({"tenant_id": tenant_id})
        
        # Get invoice stats
        invoices = await db.invoices.find(
            {"tenant_id": tenant_id}, {"_id": 0, "total": 1, "status": 1}
        ).to_list(100)
        total_billed = sum(inv.get("total", 0) for inv in invoices)
        total_paid = sum(inv.get("total", 0) for inv in invoices if inv.get("status") == "paid")
        
        enriched_tenants.append({
            **tenant,
            "stats": {
                "users": user_count,
                "vehicles": vehicle_count,
                "bookings": booking_count,
                "total_billed": round(total_billed, 2),
                "total_paid": round(total_paid, 2),
                "balance_due": round(total_billed - total_paid, 2)
            }
        })
    
    return {
        "franchises": enriched_tenants,
        "total": len(enriched_tenants),
        "filters_applied": {"status": status, "plan": plan},
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/platform/reports/invoices")
async def get_invoices_report(
    context: TenantContext = Depends(require_platform_admin),
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """All invoices with payment status and amounts"""
    query = {}
    if status:
        query["status"] = status
    if from_date:
        query["issue_date"] = {"$gte": from_date}
    if to_date:
        if "issue_date" in query:
            query["issue_date"]["$lte"] = to_date
        else:
            query["issue_date"] = {"$lte": to_date}
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Calculate totals by status
    status_totals = {}
    for inv in invoices:
        inv_status = inv.get("status", "unknown")
        if inv_status not in status_totals:
            status_totals[inv_status] = {"count": 0, "amount": 0}
        status_totals[inv_status]["count"] += 1
        status_totals[inv_status]["amount"] += inv.get("total", 0)
    
    # Round amounts
    for status_key in status_totals:
        status_totals[status_key]["amount"] = round(status_totals[status_key]["amount"], 2)
    
    grand_total = sum(inv.get("total", 0) for inv in invoices)
    
    return {
        "invoices": invoices,
        "total_count": len(invoices),
        "grand_total": round(grand_total, 2),
        "by_status": status_totals,
        "filters_applied": {"status": status, "from_date": from_date, "to_date": to_date},
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# ==================== PDF EXPORT ENDPOINTS ====================

from services.pdf_service import pdf_generator

@api_router.get("/platform/reports/executive-summary/pdf")
async def download_executive_summary_pdf(
    context: TenantContext = Depends(require_platform_admin)
):
    """Download Executive Summary Report as PDF"""
    # Get report data
    total_tenants = await db.tenants.count_documents({})
    active_tenants = await db.tenants.count_documents({"status": "active"})
    suspended_tenants = await db.tenants.count_documents({"status": "suspended"})
    total_users = await db.users.count_documents({})
    total_vehicles = await db.vehicles.count_documents({})
    total_bookings = await db.bookings.count_documents({})
    
    all_invoices = await db.invoices.find({}, {"_id": 0, "total": 1, "status": 1}).to_list(1000)
    total_revenue = sum(inv.get("total", 0) for inv in all_invoices if inv.get("status") == "paid")
    pending_revenue = sum(inv.get("total", 0) for inv in all_invoices if inv.get("status") in ["sent", "overdue"])
    overdue_invoices = len([inv for inv in all_invoices if inv.get("status") == "overdue"])
    
    plans = await db.tenants.aggregate([
        {"$group": {"_id": "$plan", "count": {"$sum": 1}}}
    ]).to_list(10)
    plan_distribution = {p["_id"]: p["count"] for p in plans}
    
    recent_tenants = await db.tenants.find(
        {}, {"_id": 0, "name": 1, "slug": 1, "created_at": 1, "status": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    data = {
        "summary": {
            "tenants": {"total": total_tenants, "active": active_tenants, "suspended": suspended_tenants},
            "users": total_users,
            "vehicles": total_vehicles,
            "bookings": total_bookings,
            "revenue": {
                "total_collected": round(total_revenue, 2),
                "pending": round(pending_revenue, 2),
                "overdue_invoices": overdue_invoices
            },
            "plan_distribution": plan_distribution
        },
        "recent_tenants": recent_tenants
    }
    
    # Get company settings
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        settings = {"company_name": "Quick Wing Fleet Management", "currency_symbol": "€"}
    
    # Generate PDF
    pdf_buffer = pdf_generator.generate_executive_summary_pdf(data, settings)
    
    filename = f"executive_summary_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.get("/platform/reports/franchises/pdf")
async def download_franchises_report_pdf(
    context: TenantContext = Depends(require_platform_admin),
    status: Optional[str] = None,
    plan: Optional[str] = None
):
    """Download Franchises Report as PDF"""
    query = {}
    if status:
        query["status"] = status
    if plan:
        query["plan"] = plan
    
    tenants = await db.tenants.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    enriched_tenants = []
    for tenant in tenants:
        tenant_id = tenant["id"]
        user_count = await db.memberships.count_documents({"tenant_id": tenant_id})
        vehicle_count = await db.vehicles.count_documents({"tenant_id": tenant_id})
        booking_count = await db.bookings.count_documents({"tenant_id": tenant_id})
        
        invoices = await db.invoices.find(
            {"tenant_id": tenant_id}, {"_id": 0, "total": 1, "status": 1}
        ).to_list(100)
        total_billed = sum(inv.get("total", 0) for inv in invoices)
        total_paid = sum(inv.get("total", 0) for inv in invoices if inv.get("status") == "paid")
        
        enriched_tenants.append({
            **tenant,
            "stats": {
                "users": user_count,
                "vehicles": vehicle_count,
                "bookings": booking_count,
                "total_billed": round(total_billed, 2),
                "total_paid": round(total_paid, 2),
                "balance_due": round(total_billed - total_paid, 2)
            }
        })
    
    data = {"franchises": enriched_tenants, "total": len(enriched_tenants)}
    
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        settings = {"company_name": "Quick Wing Fleet Management", "currency_symbol": "€"}
    
    pdf_buffer = pdf_generator.generate_franchises_report_pdf(data, settings)
    
    filename = f"franchises_report_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.get("/platform/reports/invoices/pdf")
async def download_invoices_report_pdf(
    context: TenantContext = Depends(require_platform_admin),
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Download Invoices Report as PDF"""
    query = {}
    if status:
        query["status"] = status
    if from_date:
        query["issue_date"] = {"$gte": from_date}
    if to_date:
        if "issue_date" in query:
            query["issue_date"]["$lte"] = to_date
        else:
            query["issue_date"] = {"$lte": to_date}
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    status_totals = {}
    for inv in invoices:
        inv_status = inv.get("status", "unknown")
        if inv_status not in status_totals:
            status_totals[inv_status] = {"count": 0, "amount": 0}
        status_totals[inv_status]["count"] += 1
        status_totals[inv_status]["amount"] += inv.get("total", 0)
    
    for status_key in status_totals:
        status_totals[status_key]["amount"] = round(status_totals[status_key]["amount"], 2)
    
    grand_total = sum(inv.get("total", 0) for inv in invoices)
    
    data = {
        "invoices": invoices,
        "total_count": len(invoices),
        "grand_total": round(grand_total, 2),
        "by_status": status_totals
    }
    
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        settings = {"company_name": "Quick Wing Fleet Management", "currency_symbol": "€"}
    
    pdf_buffer = pdf_generator.generate_invoices_report_pdf(data, settings)
    
    filename = f"invoices_report_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.get("/platform/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: str,
    context: TenantContext = Depends(require_platform_admin)
):
    """Download a single invoice as PDF"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        settings = {"company_name": "Quick Wing Fleet Management", "currency_symbol": "€"}
    
    pdf_buffer = pdf_generator.generate_invoice_pdf(invoice, settings)
    
    filename = f"invoice_{invoice.get('invoice_number', invoice_id)}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== USER MANAGEMENT ====================

@api_router.post("/platform/users")
async def create_platform_user(
    user_data: UserCreate,
    role: UserRole = UserRole.STAFF,
    tenant_id: Optional[str] = None,
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None
):
    """Create a new user (Platform Admin only)"""
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": get_password_hash(user_data.password),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    # Create membership if tenant_id provided
    if tenant_id:
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        membership = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "tenant_id": tenant_id,
            "role": role.value,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.memberships.insert_one(membership)
    elif role in [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN]:
        # Create platform-level membership
        membership = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "tenant_id": None,
            "role": role.value,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.memberships.insert_one(membership)
    
    await audit_service.log_user_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_CREATED,
        target_user_id=user_id,
        tenant_id=tenant_id,
        meta={"email": user_data.email, "role": role.value},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": "User created successfully", "user_id": user_id}


@api_router.get("/platform/users")
async def list_platform_users(
    tenant_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    context: TenantContext = Depends(require_platform_admin)
):
    """List all users or users in a specific tenant"""
    if tenant_id:
        # Get users in specific tenant
        memberships = await db.memberships.find(
            {"tenant_id": tenant_id},
            {"_id": 0}
        ).to_list(1000)
        
        user_ids = [m["user_id"] for m in memberships]
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "password_hash": 0}
        ).skip(skip).limit(limit).to_list(limit)
        
        # Add role info
        membership_map = {m["user_id"]: m["role"] for m in memberships}
        for user in users:
            user["role"] = membership_map.get(user["id"], "unknown")
    else:
        users = await db.users.find(
            {},
            {"_id": 0, "password_hash": 0}
        ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.users.count_documents({})
    return {"users": users, "total": total}


# ==================== TENANT-SCOPED USER MANAGEMENT ====================

@api_router.post("/tenant/users")
async def create_tenant_user(
    user_data: UserCreate,
    role: UserRole = UserRole.STAFF,
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """Create a new user in the current tenant"""
    import secrets
    import string
    
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    
    if existing:
        # User exists - check if already in this tenant
        existing_membership = await db.memberships.find_one({
            "user_id": existing["id"],
            "tenant_id": context.tenant_id
        }, {"_id": 0})
        
        if existing_membership:
            raise HTTPException(status_code=400, detail="User already in this tenant")
        
        # Add to tenant
        membership = {
            "id": str(uuid.uuid4()),
            "user_id": existing["id"],
            "tenant_id": context.tenant_id,
            "role": role.value if role in [UserRole.ADMIN, UserRole.STAFF] else UserRole.STAFF.value,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.memberships.insert_one(membership)
        
        return {"message": "User added to tenant", "user_id": existing["id"], "temporary_password": None}
    
    # Generate temporary password for new users
    alphabet = string.ascii_letters + string.digits
    temp_password = user_data.password if user_data.password else ''.join(secrets.choice(alphabet) for _ in range(10))
    
    # Create new user with require_password_change flag
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": get_password_hash(temp_password),
        "is_active": True,
        "require_password_change": True,  # Staff must change password on first login
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    # Create membership
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "tenant_id": context.tenant_id,
        "role": role.value if role in [UserRole.ADMIN, UserRole.STAFF] else UserRole.STAFF.value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.memberships.insert_one(membership)
    
    await audit_service.log_user_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_CREATED,
        target_user_id=user_id,
        tenant_id=context.tenant_id,
        meta={"email": user_data.email, "role": role.value},
        ip_address=request.client.host if request and request.client else None
    )
    
    # Get tenant slug for login URL
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    staff_login_url = f"https://quick-wing.com/{tenant['slug']}/login" if tenant else None
    
    return {
        "message": "User created successfully", 
        "user_id": user_id,
        "temporary_password": temp_password,
        "login_url": staff_login_url,
        "require_password_change": True
    }


@api_router.get("/tenant/users")
async def list_tenant_users(
    skip: int = 0,
    limit: int = 100,
    context: TenantContext = Depends(require_tenant_context)
):
    """List users in the current tenant"""
    memberships = await db.memberships.find(
        {"tenant_id": context.tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    user_ids = [m["user_id"] for m in memberships]
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "password_hash": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    # Add role info
    membership_map = {m["user_id"]: m["role"] for m in memberships}
    for user in users:
        user["role"] = membership_map.get(user["id"], "unknown")
    
    return {"users": users, "total": len(users)}


@api_router.put("/tenant/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: UserRole,
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """Update a user's role within the tenant"""
    # Only allow admin or staff roles
    if role not in [UserRole.ADMIN, UserRole.STAFF]:
        raise HTTPException(status_code=400, detail="Invalid role for tenant user")
    
    membership = await db.memberships.find_one({
        "user_id": user_id,
        "tenant_id": context.tenant_id
    }, {"_id": 0})
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in tenant")
    
    old_role = membership.get("role")
    
    await db.memberships.update_one(
        {"user_id": user_id, "tenant_id": context.tenant_id},
        {"$set": {"role": role.value}}
    )
    
    await audit_service.log_user_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_ROLE_CHANGED,
        target_user_id=user_id,
        tenant_id=context.tenant_id,
        meta={"old_role": old_role, "new_role": role.value},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": "User role updated"}


@api_router.delete("/tenant/users/{user_id}")
async def remove_user_from_tenant(
    user_id: str,
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """Remove a user from the current tenant"""
    membership = await db.memberships.find_one({
        "user_id": user_id,
        "tenant_id": context.tenant_id
    }, {"_id": 0})
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in tenant")
    
    await db.memberships.delete_one({
        "user_id": user_id,
        "tenant_id": context.tenant_id
    })
    
    await audit_service.log_user_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_DELETED,
        target_user_id=user_id,
        tenant_id=context.tenant_id,
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": "User removed from tenant"}


# ==================== TENANT REPORTS (TENANT-SCOPED) ====================

@api_router.get("/tenant/reports/summary")
async def get_tenant_report_summary(
    context: TenantContext = Depends(require_admin)
):
    """
    Get tenant-specific reports summary including:
    - Fleet utilization
    - Booking stats
    - Vehicle usage breakdown
    """
    tenant_id = context.tenant_id
    
    # Get all vehicles for this tenant
    vehicles = await db.vehicles.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1, "name": 1, "registration": 1, "is_blocked": 1}
    ).to_list(1000)
    total_vehicles = len(vehicles)
    
    # Get all bookings for this tenant
    all_bookings = await db.bookings.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(10000)
    total_bookings = len(all_bookings)
    
    # Get team members count
    team_count = await db.memberships.count_documents({"tenant_id": tenant_id})
    
    # Calculate this month's bookings
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_this_month = [
        b for b in all_bookings 
        if b.get("created_at") and b["created_at"] >= month_start.isoformat()
    ]
    
    # Calculate last month's bookings for trend comparison
    last_month_end = month_start - timedelta(seconds=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_last_month = [
        b for b in all_bookings 
        if b.get("created_at") and last_month_start.isoformat() <= b["created_at"] <= last_month_end.isoformat()
    ]
    
    # Calculate vehicle utilization (vehicles with at least one booking this month)
    vehicles_used_this_month = set()
    for booking in bookings_this_month:
        if booking.get("car_id"):
            vehicles_used_this_month.add(booking["car_id"])
    
    utilization_rate = (len(vehicles_used_this_month) / total_vehicles * 100) if total_vehicles > 0 else 0
    
    # Calculate booking trends
    booking_trend = 0
    if len(bookings_last_month) > 0:
        booking_trend = ((len(bookings_this_month) - len(bookings_last_month)) / len(bookings_last_month)) * 100
    elif len(bookings_this_month) > 0:
        booking_trend = 100  # 100% increase from 0
    
    # Get vehicle usage breakdown (most booked vehicles)
    vehicle_booking_count = {}
    for booking in all_bookings:
        car_id = booking.get("car_id")
        if car_id:
            vehicle_booking_count[car_id] = vehicle_booking_count.get(car_id, 0) + 1
    
    # Create vehicle usage list sorted by bookings
    vehicle_usage = []
    for vehicle in vehicles:
        vehicle_id = vehicle["id"]
        booking_count = vehicle_booking_count.get(vehicle_id, 0)
        vehicle_usage.append({
            "id": vehicle_id,
            "name": vehicle["name"],
            "registration": vehicle["registration"],
            "total_bookings": booking_count,
            "is_blocked": vehicle.get("is_blocked", False)
        })
    
    # Sort by booking count descending
    vehicle_usage.sort(key=lambda x: x["total_bookings"], reverse=True)
    
    # Get recent bookings activity (last 7 days)
    week_ago = (now - timedelta(days=7)).isoformat()
    recent_bookings = [
        b for b in all_bookings 
        if b.get("created_at") and b["created_at"] >= week_ago
    ]
    
    # Calculate daily booking distribution for this week
    daily_bookings = {}
    for i in range(7):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_bookings[day] = 0
    
    for booking in recent_bookings:
        if booking.get("created_at"):
            day = booking["created_at"][:10]
            if day in daily_bookings:
                daily_bookings[day] += 1
    
    # Convert to list sorted by date
    daily_trend = [
        {"date": date, "count": count}
        for date, count in sorted(daily_bookings.items())
    ]
    
    return {
        "summary": {
            "total_vehicles": total_vehicles,
            "total_bookings": total_bookings,
            "team_members": team_count,
            "bookings_this_month": len(bookings_this_month),
            "bookings_last_month": len(bookings_last_month),
            "booking_trend_percent": round(booking_trend, 1),
            "vehicles_used_this_month": len(vehicles_used_this_month),
            "utilization_rate_percent": round(utilization_rate, 1)
        },
        "vehicle_usage": vehicle_usage[:10],  # Top 10 vehicles
        "daily_booking_trend": daily_trend,
        "generated_at": now.isoformat()
    }


@api_router.get("/tenant/reports/vehicle-utilization")
async def get_vehicle_utilization_report(
    context: TenantContext = Depends(require_admin)
):
    """
    Detailed vehicle utilization report showing:
    - Each vehicle's booking history
    - Hours booked
    - Last booking date
    """
    tenant_id = context.tenant_id
    
    # Get all vehicles
    vehicles = await db.vehicles.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Get all bookings
    bookings = await db.bookings.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(10000)
    
    # Calculate stats for each vehicle
    vehicle_stats = []
    for vehicle in vehicles:
        vehicle_id = vehicle["id"]
        vehicle_bookings = [b for b in bookings if b.get("car_id") == vehicle_id]
        
        # Calculate total hours booked
        total_hours = 0
        last_booking_date = None
        
        for booking in vehicle_bookings:
            start = booking.get("start_time")
            end = booking.get("end_time")
            if start and end:
                try:
                    start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
                    hours = (end_dt - start_dt).total_seconds() / 3600
                    total_hours += hours
                except:
                    pass
            
            created_at = booking.get("created_at")
            if created_at:
                if not last_booking_date or created_at > last_booking_date:
                    last_booking_date = created_at
        
        vehicle_stats.append({
            "id": vehicle_id,
            "name": vehicle["name"],
            "registration": vehicle["registration"],
            "is_blocked": vehicle.get("is_blocked", False),
            "total_bookings": len(vehicle_bookings),
            "total_hours_booked": round(total_hours, 1),
            "last_booking_date": last_booking_date,
            "tax_expiry": vehicle.get("tax_expiry"),
            "service_due_at": vehicle.get("service_due_at")
        })
    
    # Sort by total bookings
    vehicle_stats.sort(key=lambda x: x["total_bookings"], reverse=True)
    
    return {
        "vehicles": vehicle_stats,
        "total_vehicles": len(vehicles),
        "total_bookings": len(bookings),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/tenant/reports/summary/pdf")
async def download_tenant_reports_pdf(
    context: TenantContext = Depends(require_admin)
):
    """
    Download tenant-specific reports as PDF.
    """
    tenant_id = context.tenant_id
    
    # Get tenant name
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    tenant_name = tenant.get("name", "Franchise") if tenant else "Franchise"
    
    # Get all vehicles for this tenant
    vehicles = await db.vehicles.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1, "name": 1, "registration": 1, "is_blocked": 1}
    ).to_list(1000)
    total_vehicles = len(vehicles)
    
    # Get all bookings for this tenant
    all_bookings = await db.bookings.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(10000)
    total_bookings = len(all_bookings)
    
    # Get team members count
    team_count = await db.memberships.count_documents({"tenant_id": tenant_id})
    
    # Calculate this month's bookings
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_this_month = [
        b for b in all_bookings 
        if b.get("created_at") and b["created_at"] >= month_start.isoformat()
    ]
    
    # Calculate last month's bookings
    last_month_end = month_start - timedelta(seconds=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_last_month = [
        b for b in all_bookings 
        if b.get("created_at") and last_month_start.isoformat() <= b["created_at"] <= last_month_end.isoformat()
    ]
    
    # Calculate vehicle utilization
    vehicles_used_this_month = set()
    for booking in bookings_this_month:
        if booking.get("car_id"):
            vehicles_used_this_month.add(booking["car_id"])
    
    utilization_rate = (len(vehicles_used_this_month) / total_vehicles * 100) if total_vehicles > 0 else 0
    
    # Calculate booking trends
    booking_trend = 0
    if len(bookings_last_month) > 0:
        booking_trend = ((len(bookings_this_month) - len(bookings_last_month)) / len(bookings_last_month)) * 100
    elif len(bookings_this_month) > 0:
        booking_trend = 100
    
    # Get vehicle usage breakdown
    vehicle_booking_count = {}
    for booking in all_bookings:
        car_id = booking.get("car_id")
        if car_id:
            vehicle_booking_count[car_id] = vehicle_booking_count.get(car_id, 0) + 1
    
    vehicle_usage = []
    for vehicle in vehicles:
        vehicle_id = vehicle["id"]
        booking_count = vehicle_booking_count.get(vehicle_id, 0)
        vehicle_usage.append({
            "id": vehicle_id,
            "name": vehicle["name"],
            "registration": vehicle["registration"],
            "total_bookings": booking_count,
            "is_blocked": vehicle.get("is_blocked", False)
        })
    
    vehicle_usage.sort(key=lambda x: x["total_bookings"], reverse=True)
    
    # Get daily booking trend
    daily_bookings = {}
    for i in range(7):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_bookings[day] = 0
    
    week_ago = (now - timedelta(days=7)).isoformat()
    recent_bookings = [
        b for b in all_bookings 
        if b.get("created_at") and b["created_at"] >= week_ago
    ]
    
    for booking in recent_bookings:
        if booking.get("created_at"):
            day = booking["created_at"][:10]
            if day in daily_bookings:
                daily_bookings[day] += 1
    
    daily_trend = [
        {"date": date, "count": count}
        for date, count in sorted(daily_bookings.items())
    ]
    
    data = {
        "summary": {
            "total_vehicles": total_vehicles,
            "total_bookings": total_bookings,
            "team_members": team_count,
            "bookings_this_month": len(bookings_this_month),
            "bookings_last_month": len(bookings_last_month),
            "booking_trend_percent": round(booking_trend, 1),
            "vehicles_used_this_month": len(vehicles_used_this_month),
            "utilization_rate_percent": round(utilization_rate, 1)
        },
        "vehicle_usage": vehicle_usage[:10],
        "daily_booking_trend": daily_trend
    }
    
    # Generate PDF
    pdf_buffer = pdf_generator.generate_tenant_reports_pdf(data, tenant_name)
    
    filename = f"{tenant_name.lower().replace(' ', '_')}_analytics_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.get("/tenant/reports/summary/csv")
async def download_tenant_reports_csv(
    context: TenantContext = Depends(require_admin)
):
    """
    Download tenant-specific reports as CSV.
    """
    import csv
    from io import StringIO
    
    tenant_id = context.tenant_id
    
    # Get tenant name
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    tenant_name = tenant.get("name", "Franchise") if tenant else "Franchise"
    
    # Get all vehicles for this tenant
    vehicles = await db.vehicles.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1, "name": 1, "registration": 1, "is_blocked": 1}
    ).to_list(1000)
    
    # Get all bookings for this tenant
    all_bookings = await db.bookings.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(10000)
    
    # Get team members count
    team_count = await db.memberships.count_documents({"tenant_id": tenant_id})
    
    # Calculate metrics
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_this_month = [
        b for b in all_bookings 
        if b.get("created_at") and b["created_at"] >= month_start.isoformat()
    ]
    
    last_month_end = month_start - timedelta(seconds=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_last_month = [
        b for b in all_bookings 
        if b.get("created_at") and last_month_start.isoformat() <= b["created_at"] <= last_month_end.isoformat()
    ]
    
    vehicles_used_this_month = set()
    for booking in bookings_this_month:
        if booking.get("car_id"):
            vehicles_used_this_month.add(booking["car_id"])
    
    utilization_rate = (len(vehicles_used_this_month) / len(vehicles) * 100) if len(vehicles) > 0 else 0
    
    booking_trend = 0
    if len(bookings_last_month) > 0:
        booking_trend = ((len(bookings_this_month) - len(bookings_last_month)) / len(bookings_last_month)) * 100
    elif len(bookings_this_month) > 0:
        booking_trend = 100
    
    # Get vehicle booking counts
    vehicle_booking_count = {}
    for booking in all_bookings:
        car_id = booking.get("car_id")
        if car_id:
            vehicle_booking_count[car_id] = vehicle_booking_count.get(car_id, 0) + 1
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header info
    writer.writerow([f"{tenant_name} - Analytics Report"])
    writer.writerow([f"Generated: {now.strftime('%Y-%m-%d %H:%M:%S')}"])
    writer.writerow([])
    
    # Summary section
    writer.writerow(["=== Summary Metrics ==="])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Vehicles", len(vehicles)])
    writer.writerow(["Total Bookings", len(all_bookings)])
    writer.writerow(["Bookings This Month", len(bookings_this_month)])
    writer.writerow(["Bookings Last Month", len(bookings_last_month)])
    writer.writerow(["Booking Trend (%)", f"{round(booking_trend, 1)}%"])
    writer.writerow(["Vehicles Used This Month", len(vehicles_used_this_month)])
    writer.writerow(["Fleet Utilization (%)", f"{round(utilization_rate, 1)}%"])
    writer.writerow(["Team Members", team_count])
    writer.writerow([])
    
    # Vehicle usage section
    writer.writerow(["=== Vehicle Usage ==="])
    writer.writerow(["Rank", "Vehicle Name", "Registration", "Total Bookings", "Status"])
    
    vehicle_list = []
    for vehicle in vehicles:
        vehicle_id = vehicle["id"]
        booking_count = vehicle_booking_count.get(vehicle_id, 0)
        vehicle_list.append({
            "name": vehicle["name"],
            "registration": vehicle["registration"],
            "total_bookings": booking_count,
            "is_blocked": vehicle.get("is_blocked", False)
        })
    
    vehicle_list.sort(key=lambda x: x["total_bookings"], reverse=True)
    
    for i, v in enumerate(vehicle_list, 1):
        status = "Blocked" if v["is_blocked"] else "Available"
        writer.writerow([i, v["name"], v["registration"], v["total_bookings"], status])
    
    writer.writerow([])
    
    # Daily trend section
    writer.writerow(["=== Daily Booking Trend (Last 7 Days) ==="])
    writer.writerow(["Date", "Day", "Bookings"])
    
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        day_name = day.strftime("%A")
        
        count = 0
        for booking in all_bookings:
            if booking.get("created_at") and booking["created_at"][:10] == day_str:
                count += 1
        
        writer.writerow([day_str, day_name, count])
    
    # Prepare response
    output.seek(0)
    csv_content = output.getvalue()
    
    filename = f"{tenant_name.lower().replace(' ', '_')}_analytics_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== VEHICLES (TENANT-SCOPED) ====================

@api_router.post("/vehicles")
async def create_vehicle(
    vehicle_data: VehicleCreate,
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """Create a new vehicle in the current tenant"""
    # Check plan limits
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    current_count = await db.vehicles.count_documents({"tenant_id": context.tenant_id})
    
    if current_count >= tenant.get("max_vehicles", 10):
        raise HTTPException(
            status_code=403,
            detail=f"Vehicle limit reached ({tenant.get('max_vehicles', 10)}). Please upgrade your plan."
        )
    
    vehicle = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,  # CRITICAL: Set tenant_id from context
        **vehicle_data.model_dump(),
        "is_blocked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicles.insert_one(vehicle)
    
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.VEHICLE_CREATED,
        tenant_id=context.tenant_id,
        resource_type="vehicle",
        resource_id=vehicle["id"],
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": "Vehicle created", "vehicle": {k: v for k, v in vehicle.items() if k != "_id"}}


@api_router.get("/vehicles")
async def list_vehicles(
    skip: int = 0,
    limit: int = 100,
    context: TenantContext = Depends(require_tenant_context)
):
    """List vehicles in the current tenant"""
    query = TenantQueryBuilder.scope(context.tenant_id)
    vehicles = await db.vehicles.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return vehicles


@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(
    vehicle_id: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """Get a specific vehicle"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return vehicle


@api_router.put("/vehicles/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    update_data: VehicleUpdate,
    context: TenantContext = Depends(require_admin)
):
    """Update a vehicle"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.vehicles.update_one(query, {"$set": update_dict})
    
    updated = await db.vehicles.find_one(query, {"_id": 0})
    return updated


@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: str,
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """Delete a vehicle"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    await db.vehicles.delete_one(query)
    
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.VEHICLE_DELETED,
        tenant_id=context.tenant_id,
        resource_type="vehicle",
        resource_id=vehicle_id,
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": "Vehicle deleted"}


# ==================== QR CODE SCAN UPDATE ====================

class QRScanUpdate(BaseModel):
    current_status: str
    current_mileage: Optional[int] = None
    location: Optional[str] = None
    notes: Optional[str] = None


@api_router.post("/vehicles/{vehicle_id}/scan-update")
async def scan_update_vehicle(
    vehicle_id: str,
    update_data: QRScanUpdate,
    context: TenantContext = Depends(require_tenant_context),
    request: Request = None
):
    """
    Update vehicle status and mileage via QR code scan.
    Any authenticated user in the tenant can update vehicle status.
    """
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Build update
    update_dict = {
        "current_status": update_data.current_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "last_updated_by": context.user_email,
        "last_updated_by_user_id": context.user_id
    }
    
    if update_data.current_mileage is not None:
        update_dict["current_mileage"] = update_data.current_mileage
    
    if update_data.location:
        update_dict["location"] = update_data.location
    
    await db.vehicles.update_one(query, {"$set": update_dict})
    
    # Check for service due alert
    service_alert = None
    service_due = vehicle.get("service_due_mileage")
    new_mileage = update_data.current_mileage
    
    if service_due and new_mileage:
        remaining_km = service_due - new_mileage
        if remaining_km <= 0:
            service_alert = {
                "type": "overdue",
                "message": f"SERVICE OVERDUE! Vehicle is {abs(remaining_km)} km past service due.",
                "remaining_km": remaining_km
            }
        elif remaining_km <= 500:
            service_alert = {
                "type": "urgent",
                "message": f"Service due in {remaining_km} km. Consider blocking for service appointment.",
                "remaining_km": remaining_km
            }
        elif remaining_km <= 1000:
            service_alert = {
                "type": "warning",
                "message": f"Service approaching in {remaining_km} km.",
                "remaining_km": remaining_km
            }
    
    # Create a status update record for history
    status_update = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        "car_id": vehicle_id,
        "status": update_data.current_status,
        "mileage": update_data.current_mileage,
        "location": update_data.location or "",
        "notes": update_data.notes or "",
        "reported_by": context.user_email,
        "reported_by_user_id": context.user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "qr_scan",
        "service_alert": service_alert
    }
    await db.status_updates.insert_one(status_update)
    
    # Audit log
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.VEHICLE_STATUS_UPDATED,
        tenant_id=context.tenant_id,
        resource_type="vehicle",
        resource_id=vehicle_id,
        meta={
            "status": update_data.current_status,
            "mileage": update_data.current_mileage,
            "source": "qr_scan"
        },
        ip_address=request.client.host if request and request.client else None
    )
    
    updated = await db.vehicles.find_one(query, {"_id": 0})
    
    response = {
        "message": "Vehicle updated successfully",
        "vehicle": updated
    }
    
    if service_alert:
        response["service_alert"] = service_alert
    
    return response


@api_router.get("/vehicles/{vehicle_id}/status-history")
async def get_vehicle_status_history(
    vehicle_id: str,
    limit: int = 20,
    context: TenantContext = Depends(require_tenant_context)
):
    """Get status update history for a vehicle"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    history = await db.status_updates.find(
        {"tenant_id": context.tenant_id, "car_id": vehicle_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {
        "vehicle_id": vehicle_id,
        "history": history
    }


class BlockVehicleRequest(BaseModel):
    reason: str  # "Service", "Cleaning", "Other"
    notes: Optional[str] = None


@api_router.post("/vehicles/{vehicle_id}/block")
async def block_vehicle_for_appointment(
    vehicle_id: str,
    block_data: BlockVehicleRequest,
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """Block a vehicle for appointment (Service, Cleaning, Other)"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if vehicle.get("is_blocked"):
        raise HTTPException(status_code=400, detail="Vehicle is already blocked")
    
    update_dict = {
        "is_blocked": True,
        "blocked_reason": block_data.reason,
        "blocked_notes": block_data.notes or "",
        "blocked_by": context.user_email,
        "blocked_at": datetime.now(timezone.utc).isoformat(),
        "current_status": f"Blocked - {block_data.reason}",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicles.update_one(query, {"$set": update_dict})
    
    # Log the block action
    status_update = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        "car_id": vehicle_id,
        "status": f"Blocked - {block_data.reason}",
        "notes": block_data.notes or "",
        "reported_by": context.user_email,
        "reported_by_user_id": context.user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "block_appointment"
    }
    await db.status_updates.insert_one(status_update)
    
    updated = await db.vehicles.find_one(query, {"_id": 0})
    return {
        "message": f"Vehicle blocked for {block_data.reason}",
        "vehicle": updated
    }


@api_router.post("/vehicles/{vehicle_id}/unblock")
async def unblock_vehicle(
    vehicle_id: str,
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """Unblock a vehicle and return it to the fleet"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if not vehicle.get("is_blocked"):
        raise HTTPException(status_code=400, detail="Vehicle is not blocked")
    
    update_dict = {
        "is_blocked": False,
        "blocked_reason": None,
        "blocked_notes": None,
        "blocked_by": None,
        "blocked_at": None,
        "current_status": "Free",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "unblocked_by": context.user_email,
        "unblocked_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicles.update_one(query, {"$set": update_dict})
    
    # Log the unblock action
    status_update = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        "car_id": vehicle_id,
        "status": "Free",
        "notes": "Vehicle returned to fleet",
        "reported_by": context.user_email,
        "reported_by_user_id": context.user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "unblock"
    }
    await db.status_updates.insert_one(status_update)
    
    updated = await db.vehicles.find_one(query, {"_id": 0})
    return {
        "message": "Vehicle unblocked and returned to fleet",
        "vehicle": updated
    }


# ==================== FLEET REPORTS (TENANT-SCOPED) ====================

@api_router.get("/tenant/fleet-reports")
async def get_fleet_reports(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    context: TenantContext = Depends(require_admin)
):
    """Get comprehensive fleet reports for the tenant"""
    tenant_id = context.tenant_id
    
    # Get all vehicles
    vehicles = await db.vehicles.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Get all bookings
    booking_query = {"tenant_id": tenant_id}
    if from_date:
        booking_query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in booking_query:
            booking_query["created_at"]["$lte"] = to_date
        else:
            booking_query["created_at"] = {"$lte": to_date}
    
    bookings = await db.bookings.find(booking_query, {"_id": 0}).to_list(100000)
    
    # Calculate stats
    total_vehicles = len(vehicles)
    total_bookings = len(bookings)
    pending_bookings = len([b for b in bookings if b.get("status") == "pending"])
    blocked_cars = len([v for v in vehicles if v.get("is_blocked")])
    
    # Most booked cars (ranked)
    vehicle_booking_count = {}
    for booking in bookings:
        car_id = booking.get("car_id")
        if car_id:
            vehicle_booking_count[car_id] = vehicle_booking_count.get(car_id, 0) + 1
    
    most_booked = []
    for vehicle in vehicles:
        vid = vehicle["id"]
        count = vehicle_booking_count.get(vid, 0)
        most_booked.append({
            "id": vid,
            "name": vehicle["name"],
            "registration": vehicle["registration"],
            "bookings": count
        })
    
    most_booked.sort(key=lambda x: x["bookings"], reverse=True)
    
    # Daily availability (today)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    today_bookings = [
        b for b in bookings
        if b.get("start_time") and today_start.isoformat() <= b["start_time"] <= today_end.isoformat()
    ]
    
    # Calculate availability
    fully_free = 0
    partially_free = 0
    fully_booked = 0
    blocked = 0
    
    for vehicle in vehicles:
        if vehicle.get("is_blocked"):
            blocked += 1
            continue
        
        vehicle_today_bookings = [b for b in today_bookings if b.get("car_id") == vehicle["id"]]
        if len(vehicle_today_bookings) == 0:
            fully_free += 1
        elif len(vehicle_today_bookings) >= 8:  # Assuming 8+ hours = fully booked
            fully_booked += 1
        else:
            partially_free += 1
    
    # By location summary
    location_summary = {}
    for vehicle in vehicles:
        loc = vehicle.get("base_location") or "Unassigned"
        if loc not in location_summary:
            location_summary[loc] = {"total": 0, "free": 0, "partial": 0, "booked": 0, "blocked": 0}
        
        location_summary[loc]["total"] += 1
        
        if vehicle.get("is_blocked"):
            location_summary[loc]["blocked"] += 1
        else:
            vehicle_today_bookings = [b for b in today_bookings if b.get("car_id") == vehicle["id"]]
            if len(vehicle_today_bookings) == 0:
                location_summary[loc]["free"] += 1
            elif len(vehicle_today_bookings) >= 8:
                location_summary[loc]["booked"] += 1
            else:
                location_summary[loc]["partial"] += 1
    
    # Calculate utilization per location
    for loc, data in location_summary.items():
        if data["total"] > 0:
            utilized = data["partial"] + data["booked"]
            data["utilization"] = round((utilized / data["total"]) * 100, 1)
        else:
            data["utilization"] = 0
    
    return {
        "summary": {
            "total_vehicles": total_vehicles,
            "total_bookings": total_bookings,
            "pending_bookings": pending_bookings,
            "blocked_cars": blocked_cars
        },
        "most_booked_cars": most_booked[:10],
        "daily_availability": {
            "date": now.strftime("%Y-%m-%d"),
            "total_fleet": total_vehicles - blocked,
            "fully_free": fully_free,
            "partially_free": partially_free,
            "fully_booked": fully_booked
        },
        "location_summary": [
            {"location": loc, **data}
            for loc, data in sorted(location_summary.items())
        ],
        "generated_at": now.isoformat()
    }


@api_router.get("/tenant/fleet-reports/csv")
async def export_fleet_reports_csv(
    context: TenantContext = Depends(require_admin)
):
    """Export fleet reports as CSV"""
    import csv
    from io import StringIO
    
    # Get the report data
    tenant_id = context.tenant_id
    vehicles = await db.vehicles.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
    bookings = await db.bookings.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100000)
    
    # Calculate booking counts
    vehicle_booking_count = {}
    for booking in bookings:
        car_id = booking.get("car_id")
        if car_id:
            vehicle_booking_count[car_id] = vehicle_booking_count.get(car_id, 0) + 1
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Fleet Report - " + datetime.now().strftime("%Y-%m-%d")])
    writer.writerow([])
    
    # Summary
    writer.writerow(["=== Summary ==="])
    writer.writerow(["Total Vehicles", len(vehicles)])
    writer.writerow(["Total Bookings", len(bookings)])
    writer.writerow(["Blocked Cars", len([v for v in vehicles if v.get("is_blocked")])])
    writer.writerow([])
    
    # Vehicle details
    writer.writerow(["=== Vehicle Details ==="])
    writer.writerow(["Name", "Registration", "Status", "Current Mileage", "Service Due At", "Tax Due", "Location", "Total Bookings"])
    
    for vehicle in sorted(vehicles, key=lambda x: vehicle_booking_count.get(x["id"], 0), reverse=True):
        writer.writerow([
            vehicle.get("name", ""),
            vehicle.get("registration", ""),
            vehicle.get("current_status", "Free"),
            vehicle.get("current_mileage", ""),
            vehicle.get("service_due_mileage", ""),
            vehicle.get("tax_due_date", ""),
            vehicle.get("base_location", ""),
            vehicle_booking_count.get(vehicle["id"], 0)
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=fleet_report_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


# Alias for backwards compatibility
@api_router.get("/cars")
async def list_cars(context: TenantContext = Depends(require_tenant_context)):
    return await list_vehicles(context=context)


# ==================== BOOKINGS (TENANT-SCOPED) ====================

@api_router.post("/bookings")
async def create_booking(
    booking_data: BookingCreate,
    context: TenantContext = Depends(require_tenant_context)
):
    """Create a new booking"""
    # Verify vehicle belongs to tenant
    vehicle_query = TenantQueryBuilder.scope_by_id(context.tenant_id, booking_data.car_id)
    vehicle = await db.vehicles.find_one(vehicle_query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if vehicle.get("is_blocked"):
        raise HTTPException(status_code=400, detail="Vehicle is currently blocked")
    
    booking = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,  # CRITICAL: Set tenant_id from context
        **booking_data.model_dump(),
        "status": "approved",
        "created_by_email": context.user_email,
        "created_by_user_id": context.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bookings.insert_one(booking)
    
    return {k: v for k, v in booking.items() if k != "_id"}


@api_router.get("/bookings")
async def list_bookings(
    status: Optional[str] = None,
    car_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    context: TenantContext = Depends(require_tenant_context)
):
    """List bookings in the current tenant"""
    query = TenantQueryBuilder.scope(context.tenant_id)
    
    if status:
        query["status"] = status
    if car_id:
        query["car_id"] = car_id
    
    bookings = await db.bookings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return bookings


@api_router.get("/bookings/{booking_id}")
async def get_booking(
    booking_id: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """Get a specific booking"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, booking_id)
    booking = await db.bookings.find_one(query, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return booking


@api_router.put("/bookings/{booking_id}")
async def update_booking(
    booking_id: str,
    update_data: BookingUpdate,
    context: TenantContext = Depends(require_tenant_context)
):
    """Update a booking"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, booking_id)
    booking = await db.bookings.find_one(query, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Staff can only edit their own bookings
    if context.role == UserRole.STAFF and booking.get("created_by_user_id") != context.user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own bookings")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        await db.bookings.update_one(query, {"$set": update_dict})
    
    updated = await db.bookings.find_one(query, {"_id": 0})
    return updated


@api_router.delete("/bookings/{booking_id}")
async def delete_booking(
    booking_id: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """Delete a booking"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, booking_id)
    booking = await db.bookings.find_one(query, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Staff can only delete their own bookings
    if context.role == UserRole.STAFF and booking.get("created_by_user_id") != context.user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own bookings")
    
    await db.bookings.delete_one(query)
    
    return {"message": "Booking deleted"}


# ==================== PROVIDERS (TENANT-SCOPED) ====================

@api_router.post("/providers")
async def create_provider(
    provider_data: ProviderCreate,
    context: TenantContext = Depends(require_admin)
):
    """Create a service provider"""
    provider = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        **provider_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.providers.insert_one(provider)
    return {k: v for k, v in provider.items() if k != "_id"}


@api_router.get("/providers")
async def list_providers(context: TenantContext = Depends(require_tenant_context)):
    """List providers in the current tenant"""
    query = TenantQueryBuilder.scope(context.tenant_id)
    providers = await db.providers.find(query, {"_id": 0}).to_list(100)
    return providers


@api_router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    context: TenantContext = Depends(require_admin)
):
    """Delete a provider"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, provider_id)
    result = await db.providers.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    return {"message": "Provider deleted"}


# ==================== MESSAGES (TENANT-SCOPED) ====================

@api_router.post("/messages")
async def create_message(
    message_data: MessageCreate,
    context: TenantContext = Depends(require_admin)
):
    """Create an announcement/message"""
    message = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        **message_data.model_dump(),
        "created_by": context.user_email,
        "created_by_user_id": context.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "acknowledged_by": []
    }
    await db.messages.insert_one(message)
    return {k: v for k, v in message.items() if k != "_id"}


@api_router.get("/messages")
async def list_messages(context: TenantContext = Depends(require_tenant_context)):
    """List messages in the current tenant"""
    query = TenantQueryBuilder.scope(context.tenant_id)
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return messages


@api_router.post("/messages/{message_id}/acknowledge")
async def acknowledge_message(
    message_id: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """Acknowledge a message"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, message_id)
    message = await db.messages.find_one(query, {"_id": 0})
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await db.messages.update_one(
        query,
        {"$addToSet": {"acknowledged_by": context.user_email}}
    )
    
    return {"message": "Acknowledged"}


@api_router.get("/announcements")
async def list_announcements(context: TenantContext = Depends(require_tenant_context)):
    """List all announcements in the current tenant"""
    query = TenantQueryBuilder.scope(context.tenant_id)
    announcements = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return announcements


@api_router.get("/announcements/pending")
async def get_pending_announcements(context: TenantContext = Depends(require_tenant_context)):
    """Get announcements that require acknowledgment from the current user"""
    query = TenantQueryBuilder.scope(context.tenant_id, {
        "requires_acknowledgment": True,
        "acknowledged_by": {"$ne": context.user_email}
    })
    pending = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return pending


@api_router.get("/announcements/unread-count")
async def get_unread_announcement_count(context: TenantContext = Depends(require_tenant_context)):
    """Get count of unread announcements requiring acknowledgment"""
    query = TenantQueryBuilder.scope(context.tenant_id, {
        "requires_acknowledgment": True,
        "acknowledged_by": {"$ne": context.user_email}
    })
    count = await db.messages.count_documents(query)
    return {"count": count}


@api_router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    context: TenantContext = Depends(require_admin)
):
    """Delete an announcement (Admin only)"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, announcement_id)
    result = await db.messages.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    return {"message": "Announcement deleted"}


# ==================== DAILY AVAILABILITY TIMELINE ====================

@api_router.get("/tenant/reports/daily-timeline")
async def get_daily_availability_timeline(
    date: Optional[str] = None,
    context: TenantContext = Depends(require_admin)
):
    """
    Get hourly availability timeline for all vehicles on a specific day.
    Returns data for each hour from 07:00 to 22:00.
    """
    tenant_id = context.tenant_id
    
    # Parse date or use today
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        target_date = datetime.now(timezone.utc)
    
    # Set date boundaries
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Get all vehicles
    vehicles = await db.vehicles.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    total_vehicles = len(vehicles)
    blocked_vehicles = len([v for v in vehicles if v.get("is_blocked")])
    available_fleet = total_vehicles - blocked_vehicles
    
    # Get bookings for this day
    bookings = await db.bookings.find({
        "tenant_id": tenant_id,
        "start_time": {"$lte": day_end.isoformat()},
        "end_time": {"$gte": day_start.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    # Build hourly timeline (07:00 - 22:00)
    timeline = []
    for hour in range(7, 23):  # 07:00 to 22:00
        hour_start = target_date.replace(hour=hour, minute=0, second=0, microsecond=0)
        hour_end = target_date.replace(hour=hour, minute=59, second=59, microsecond=999999)
        
        # Count vehicles in use during this hour
        vehicles_in_use = set()
        for booking in bookings:
            try:
                booking_start = datetime.fromisoformat(booking["start_time"].replace("Z", "+00:00"))
                booking_end = datetime.fromisoformat(booking["end_time"].replace("Z", "+00:00"))
                
                # Check if booking overlaps with this hour
                # Make hour_start and hour_end timezone-aware for comparison
                hour_start_aware = hour_start.replace(tzinfo=timezone.utc)
                hour_end_aware = hour_end.replace(tzinfo=timezone.utc)
                
                if booking_start <= hour_end_aware and booking_end >= hour_start_aware:
                    vehicles_in_use.add(booking["car_id"])
            except (ValueError, KeyError):
                continue
        
        in_use_count = len(vehicles_in_use)
        free_count = available_fleet - in_use_count
        
        timeline.append({
            "hour": f"{hour:02d}:00",
            "hour_24": hour,
            "total_fleet": available_fleet,
            "in_use": in_use_count,
            "free": max(0, free_count),
            "utilization_percent": round((in_use_count / available_fleet * 100), 1) if available_fleet > 0 else 0
        })
    
    # Calculate peak hours
    peak_hour = max(timeline, key=lambda x: x["in_use"]) if timeline else None
    avg_utilization = sum(t["utilization_percent"] for t in timeline) / len(timeline) if timeline else 0
    
    return {
        "date": target_date.strftime("%Y-%m-%d"),
        "total_vehicles": total_vehicles,
        "blocked_vehicles": blocked_vehicles,
        "available_fleet": available_fleet,
        "timeline": timeline,
        "summary": {
            "peak_hour": peak_hour["hour"] if peak_hour else None,
            "peak_vehicles_in_use": peak_hour["in_use"] if peak_hour else 0,
            "average_utilization": round(avg_utilization, 1)
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/tenant/reports/daily-timeline/csv")
async def export_daily_timeline_csv(
    date: Optional[str] = None,
    context: TenantContext = Depends(require_admin)
):
    """Export daily availability timeline as CSV"""
    import csv
    from io import StringIO
    
    # Get the timeline data
    tenant_id = context.tenant_id
    
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    else:
        target_date = datetime.now(timezone.utc)
    
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    vehicles = await db.vehicles.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
    total_vehicles = len(vehicles)
    blocked_vehicles = len([v for v in vehicles if v.get("is_blocked")])
    available_fleet = total_vehicles - blocked_vehicles
    
    bookings = await db.bookings.find({
        "tenant_id": tenant_id,
        "start_time": {"$lte": day_end.isoformat()},
        "end_time": {"$gte": day_start.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    # Build CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Daily Availability Timeline Report"])
    writer.writerow([f"Date: {target_date.strftime('%Y-%m-%d')}"])
    writer.writerow([f"Total Fleet: {total_vehicles}", f"Blocked: {blocked_vehicles}", f"Available: {available_fleet}"])
    writer.writerow([])
    writer.writerow(["Hour", "Total Fleet", "In Use", "Free", "Utilization %"])
    
    # Data rows
    for hour in range(7, 23):
        hour_start = target_date.replace(hour=hour, minute=0, second=0, microsecond=0)
        hour_end = target_date.replace(hour=hour, minute=59, second=59, microsecond=999999)
        
        vehicles_in_use = set()
        for booking in bookings:
            try:
                booking_start = datetime.fromisoformat(booking["start_time"].replace("Z", "+00:00"))
                booking_end = datetime.fromisoformat(booking["end_time"].replace("Z", "+00:00"))
                
                hour_start_aware = hour_start.replace(tzinfo=timezone.utc)
                hour_end_aware = hour_end.replace(tzinfo=timezone.utc)
                
                if booking_start <= hour_end_aware and booking_end >= hour_start_aware:
                    vehicles_in_use.add(booking["car_id"])
            except:
                continue
        
        in_use_count = len(vehicles_in_use)
        free_count = max(0, available_fleet - in_use_count)
        utilization = round((in_use_count / available_fleet * 100), 1) if available_fleet > 0 else 0
        
        writer.writerow([f"{hour:02d}:00", available_fleet, in_use_count, free_count, f"{utilization}%"])
    
    output.seek(0)
    
    filename = f"daily_timeline_{target_date.strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== TODOS (TENANT-SCOPED) ====================

@api_router.post("/todos")
async def create_todo(
    todo_data: TodoCreate,
    context: TenantContext = Depends(require_admin)
):
    """Create a todo item"""
    todo = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        **todo_data.model_dump(),
        "is_completed": False,
        "created_by": context.user_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.todos.insert_one(todo)
    return {k: v for k, v in todo.items() if k != "_id"}


@api_router.get("/todos")
async def list_todos(context: TenantContext = Depends(require_tenant_context)):
    """List todos in the current tenant"""
    query = TenantQueryBuilder.scope(context.tenant_id)
    todos = await db.todos.find(query, {"_id": 0}).to_list(100)
    return todos


@api_router.put("/todos/{todo_id}/complete")
async def complete_todo(
    todo_id: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """Mark a todo as complete"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, todo_id)
    todo = await db.todos.find_one(query, {"_id": 0})
    
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    await db.todos.update_one(query, {"$set": {
        "is_completed": True,
        "completed_by": context.user_email,
        "completed_at": datetime.now(timezone.utc).isoformat()
    }})
    
    return {"message": "Todo completed"}


@api_router.delete("/todos/{todo_id}")
async def delete_todo(
    todo_id: str,
    context: TenantContext = Depends(require_admin)
):
    """Delete a todo"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, todo_id)
    result = await db.todos.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    return {"message": "Todo deleted"}


# ==================== LIFT REQUESTS (TENANT-SCOPED) ====================

@api_router.post("/lift-requests")
async def create_lift_request(
    request_data: LiftRequestCreate,
    context: TenantContext = Depends(require_tenant_context)
):
    """Create a lift request"""
    lift_request = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        **request_data.model_dump(),
        "requester_email": context.user_email,
        "requester_name": context.user_name or context.user_email.split("@")[0],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lift_requests.insert_one(lift_request)
    return {k: v for k, v in lift_request.items() if k != "_id"}


@api_router.get("/lift-requests")
async def list_lift_requests(context: TenantContext = Depends(require_tenant_context)):
    """List lift requests in the current tenant"""
    query = TenantQueryBuilder.scope(context.tenant_id, {"status": "open"})
    requests = await db.lift_requests.find(query, {"_id": 0}).to_list(100)
    return requests


@api_router.get("/lift-requests/active")
async def get_active_lift_requests(context: TenantContext = Depends(require_tenant_context)):
    """Get active (open) lift requests"""
    query = TenantQueryBuilder.scope(context.tenant_id, {"status": "open"})
    requests = await db.lift_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests


@api_router.post("/lift-requests/{request_id}/accept")
async def accept_lift_request(
    request_id: str,
    message: str = "",
    context: TenantContext = Depends(require_tenant_context)
):
    """Accept a lift request"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, request_id)
    lift_request = await db.lift_requests.find_one(query)
    
    if not lift_request:
        raise HTTPException(status_code=404, detail="Lift request not found")
    
    await db.lift_requests.update_one(
        query,
        {"$set": {
            "status": "accepted",
            "accepted_by": context.user_email,
            "accepted_at": datetime.now(timezone.utc).isoformat(),
            "accept_message": message
        }}
    )
    
    return {"message": "Lift request accepted"}


@api_router.post("/lift-requests/{request_id}/dismiss")
async def dismiss_lift_request(
    request_id: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """Dismiss a lift request"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, request_id)
    lift_request = await db.lift_requests.find_one(query)
    
    if not lift_request:
        raise HTTPException(status_code=404, detail="Lift request not found")
    
    await db.lift_requests.update_one(
        query,
        {"$set": {
            "status": "dismissed",
            "dismissed_by": context.user_email,
            "dismissed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Lift request dismissed"}


# ==================== QR CODE ====================

@api_router.get("/vehicles/{vehicle_id}/qr")
async def get_vehicle_qr(
    vehicle_id: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """Get QR code for a vehicle"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Generate QR with tenant context - HARDCODED to quick-wing.com
    base_url = 'https://quick-wing.com'
    qr_url = f"{base_url}/{context.tenant_slug}/book/{vehicle_id}"
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="image/png")


# ==================== REPORTS (TENANT-SCOPED) ====================

@api_router.get("/reports/summary")
async def get_reports_summary(context: TenantContext = Depends(require_tenant_context)):
    """Get summary report for the current tenant"""
    vehicles_count = await db.vehicles.count_documents({"tenant_id": context.tenant_id})
    bookings_count = await db.bookings.count_documents({"tenant_id": context.tenant_id})
    
    # Get this month's bookings
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    bookings_this_month = await db.bookings.count_documents({
        "tenant_id": context.tenant_id,
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    users_count = await db.memberships.count_documents({"tenant_id": context.tenant_id})
    
    return {
        "vehicles": vehicles_count,
        "bookings_total": bookings_count,
        "bookings_this_month": bookings_this_month,
        "users": users_count
    }


# ==================== DATABASE INITIALIZATION ====================

@api_router.post("/init/super-admin")
async def initialize_super_admin():
    """
    Initialize the Super Admin account.
    This should only be called once during initial setup.
    """
    # Check if super admin already exists
    existing = await db.users.find_one({"email": "superadmin@quickwing.com"}, {"_id": 0})
    if existing:
        return {"message": "Super Admin already exists"}
    
    # Create super admin user
    user_id = str(uuid.uuid4())
    super_admin = {
        "id": user_id,
        "email": "superadmin@quickwing.com",
        "name": "Super Admin",
        "password_hash": get_password_hash("Super123"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(super_admin)
    
    # Create super admin membership
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "tenant_id": None,  # Platform-level
        "role": UserRole.SUPER_ADMIN.value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.memberships.insert_one(membership)
    
    # Create indexes for tenant isolation
    await db.vehicles.create_index([("tenant_id", 1), ("id", 1)])
    await db.bookings.create_index([("tenant_id", 1), ("id", 1)])
    await db.bookings.create_index([("tenant_id", 1), ("car_id", 1)])
    await db.providers.create_index([("tenant_id", 1)])
    await db.messages.create_index([("tenant_id", 1)])
    await db.todos.create_index([("tenant_id", 1)])
    await db.lift_requests.create_index([("tenant_id", 1)])
    await db.memberships.create_index([("user_id", 1), ("tenant_id", 1)])
    await db.memberships.create_index([("tenant_id", 1)])
    await db.tenants.create_index([("slug", 1)], unique=True)
    await db.audit_events.create_index([("tenant_id", 1), ("created_at", -1)])
    
    return {
        "message": "Super Admin created successfully",
        "email": "superadmin@quickwing.com",
        "password": "Super123"
    }


# Include router
app.include_router(api_router)


# Startup event
@app.on_event("startup")
async def startup():
    logger.info("Quick Wing Multi-Tenant SaaS starting up...")
    
    # Seed database with super admin
    await seed_super_admin()
    
    # Ensure indexes exist
    try:
        await db.vehicles.create_index([("tenant_id", 1), ("id", 1)])
        await db.bookings.create_index([("tenant_id", 1), ("id", 1)])
        await db.tenants.create_index([("slug", 1)], unique=True)
        await db.memberships.create_index([("user_id", 1), ("tenant_id", 1)])
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")


async def seed_super_admin():
    """Ensure super admin user exists on startup."""
    SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
    SUPER_ADMIN_PASSWORD = "Super123"
    SUPER_ADMIN_NAME = "Super Admin"
    
    try:
        existing_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL})
        
        if existing_admin:
            user_id = existing_admin["id"]
            logger.info(f"Super admin exists: {SUPER_ADMIN_EMAIL}")
            
            # Ensure password is correct and role is set
            password_hash = get_password_hash(SUPER_ADMIN_PASSWORD)
            await db.users.update_one(
                {"email": SUPER_ADMIN_EMAIL},
                {"$set": {"password_hash": password_hash, "is_active": True, "role": "super_admin"}}
            )
            
            # CRITICAL: Ensure super_admin membership exists
            existing_membership = await db.memberships.find_one({
                "user_id": user_id,
                "role": "super_admin"
            })
            
            if not existing_membership:
                # Check if any membership exists for this user
                any_membership = await db.memberships.find_one({"user_id": user_id})
                
                if any_membership:
                    # Update existing membership to super_admin role
                    await db.memberships.update_one(
                        {"user_id": user_id},
                        {"$set": {"role": "super_admin", "tenant_id": None}}
                    )
                    logger.info(f"Updated existing membership to super_admin role")
                else:
                    # Create new super_admin membership
                    membership = {
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "tenant_id": None,
                        "role": "super_admin",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.memberships.insert_one(membership)
                    logger.info(f"Created super_admin membership for existing user")
            else:
                logger.info("Super admin membership already exists")
        else:
            # Create super admin
            user_id = str(uuid.uuid4())
            password_hash = get_password_hash(SUPER_ADMIN_PASSWORD)
            super_admin = {
                "id": user_id,
                "email": SUPER_ADMIN_EMAIL,
                "name": SUPER_ADMIN_NAME,
                "password_hash": password_hash,
                "role": "super_admin",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(super_admin)
            logger.info(f"Created super admin: {SUPER_ADMIN_EMAIL}")
            
            # Create super_admin membership
            membership = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "tenant_id": None,
                "role": "super_admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.memberships.insert_one(membership)
            logger.info(f"Created super_admin membership")
        
        logger.info("="*50)
        logger.info("ADMIN CREDENTIALS:")
        logger.info(f"  Email: {SUPER_ADMIN_EMAIL}")
        logger.info(f"  Password: {SUPER_ADMIN_PASSWORD}")
        logger.info(f"  URL: https://quick-wing.com/login")
        logger.info("="*50)
        
    except Exception as e:
        logger.error(f"Error seeding super admin: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
