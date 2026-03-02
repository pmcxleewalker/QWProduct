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
            "role": user_role.value
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
    # Format: https://domain/{tenant_slug}/login
    # Use FRONTEND_URL env var in preview, fallback to quick-wing.com for production
    base_url = os.environ.get('FRONTEND_URL', 'https://quick-wing.com')
    # Remove trailing slash if present
    base_url = base_url.rstrip('/')
    tenant_login_url = f"{base_url}/{tenant_data.slug}/login"
    
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
        "instructions": f"Share the login URL and credentials with the franchise owner. They can then create Admin and Staff accounts for their team."
    }
    
    return response


@api_router.get("/platform/tenants")
async def list_tenants(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    context: TenantContext = Depends(require_platform_admin)
):
    """List all tenants (Super/Master Admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    tenants = await db.tenants.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.tenants.count_documents(query)
    
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
        
        return {"message": "User added to tenant", "user_id": existing["id"]}
    
    # Create new user
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
    
    return {"message": "User created successfully", "user_id": user_id}


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
    
    # Generate QR with tenant context
    qr_url = f"https://quick-wing.com/{context.tenant_slug}/book/{vehicle_id}"
    
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
    
    # Ensure indexes exist
    try:
        await db.vehicles.create_index([("tenant_id", 1), ("id", 1)])
        await db.bookings.create_index([("tenant_id", 1), ("id", 1)])
        await db.tenants.create_index([("slug", 1)], unique=True)
        await db.memberships.create_index([("user_id", 1), ("tenant_id", 1)])
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
