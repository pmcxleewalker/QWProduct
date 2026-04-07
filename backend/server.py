"""
Quick Wing Fleet Management - Multi-Tenant SaaS Platform
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, Request, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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
import shutil

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
    UserRole, TenantStatus, TenantPlan, PLAN_CONFIG,
    TenantCreate, TenantUpdate, Tenant, TenantUsageStats,
    UserCreate, UserLogin, User, UserResponse, UserWithMemberships,
    MembershipCreate, Membership,
    TenantContext, TenantSelector,
    AuditAction, Token,
    FEATURE_REGISTRY, FEATURE_CATEGORIES, get_plan_default_features
)
from models.resources import (
    VehicleCreate, VehicleUpdate, Vehicle,
    BookingCreate, BookingUpdate, Booking,
    StatusUpdate, ProviderCreate, Provider,
    MessageCreate, Message, TodoCreate, Todo,
    LiftRequestCreate, LiftRequest,
    LocationCreate, LocationUpdate, Location
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
    
    # Check for super/master admin or content manager or bot from USER record (not memberships)
    # These special roles are stored directly on the user document
    user_db_role = user.get("role")
    if user_db_role in [UserRole.SUPER_ADMIN.value, UserRole.MASTER_ADMIN.value, UserRole.CONTENT_MANAGER.value, UserRole.BOT.value]:
        user_role = UserRole(user_db_role)
    
    # For users with tenant_id on their user document (master_admin, admin, etc.), 
    # add their tenant to the list if not already there
    user_tenant_id = user.get("tenant_id")
    if user_tenant_id and not any(t["tenant_id"] == user_tenant_id for t in tenant_list):
        user_tenant = await db.tenants.find_one({"id": user_tenant_id}, {"_id": 0})
        if user_tenant and user_tenant.get("status") != TenantStatus.SUSPENDED.value:
            tenant_info = {
                "tenant_id": user_tenant["id"],
                "tenant_name": user_tenant["name"],
                "tenant_slug": user_tenant["slug"],
                "role": user_db_role or UserRole.MASTER_ADMIN.value,
                "status": user_tenant.get("status", "active")
            }
            tenant_list.insert(0, tenant_info)  # Add at beginning
            if not default_tenant_id:
                default_tenant_id = user_tenant["id"]
                if user_db_role:
                    user_role = UserRole(user_db_role)
    
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


# ==================== GDPR DATA RIGHTS ENDPOINTS ====================

@api_router.get("/users/me/data-export")
async def export_user_data(context: TenantContext = Depends(get_tenant_context)):
    """
    GDPR Right to Access & Data Portability - Export all user's personal data
    """
    from fastapi.responses import JSONResponse
    
    user = await db.users.find_one({"id": context.user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Collect all user data
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "data_controller": "Quick Wing Fleet Management",
        "contact_email": "Lee.quickwing@gmail.com",
        "user_profile": user,
        "memberships": [],
        "bookings": [],
        "activity_logs": []
    }
    
    # Get all memberships
    memberships = await db.memberships.find(
        {"user_id": context.user_id}, 
        {"_id": 0}
    ).to_list(1000)
    export_data["memberships"] = memberships
    
    # Get all bookings made by user
    bookings = await db.bookings.find(
        {"user_id": context.user_id},
        {"_id": 0}
    ).to_list(10000)
    export_data["bookings"] = bookings
    
    # Get mileage logs recorded by user
    mileage_logs = await db.mileage_logs.find(
        {"recorded_by": user.get("name")},
        {"_id": 0}
    ).to_list(10000)
    export_data["mileage_logs"] = mileage_logs
    
    # Get audit logs for user
    audit_logs = await db.audit_logs.find(
        {"actor_user_id": context.user_id},
        {"_id": 0}
    ).to_list(10000)
    export_data["activity_logs"] = audit_logs
    
    # Log this data export request
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_UPDATED,
        resource_type="user",
        resource_id=context.user_id,
        meta={"action": "gdpr_data_export"}
    )
    
    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=my-data-export-{datetime.now().strftime('%Y-%m-%d')}.json"
        }
    )


@api_router.delete("/users/me")
async def delete_user_account(
    context: TenantContext = Depends(get_tenant_context),
    request: Request = None
):
    """
    GDPR Right to Erasure - Delete user account and all personal data
    """
    user = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting super admins or master admins directly
    if user.get("role") in [UserRole.SUPER_ADMIN.value]:
        raise HTTPException(
            status_code=403, 
            detail="Super admin accounts cannot be deleted this way. Please contact support."
        )
    
    user_id = context.user_id
    user_name = user.get("name", "Deleted User")
    
    # Anonymize bookings (keep records but remove personal info)
    await db.bookings.update_many(
        {"user_id": user_id},
        {"$set": {
            "user_id": "deleted",
            "user_name": "Deleted User",
            "notes": "[User account deleted per GDPR request]"
        }}
    )
    
    # Anonymize mileage logs
    await db.mileage_logs.update_many(
        {"recorded_by": user_name},
        {"$set": {"recorded_by": "Deleted User"}}
    )
    
    # Delete memberships
    await db.memberships.delete_many({"user_id": user_id})
    
    # Log deletion before deleting audit logs
    deletion_log = {
        "id": str(uuid4()),
        "action": "gdpr_account_deletion",
        "deleted_user_id": user_id,
        "deleted_user_email": user.get("email"),
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "ip_address": request.client.host if request and request.client else None
    }
    await db.gdpr_deletion_logs.insert_one(deletion_log)
    
    # Delete user's audit logs (their activity history)
    await db.audit_logs.delete_many({"actor_user_id": user_id})
    
    # Finally, delete the user record
    await db.users.delete_one({"id": user_id})
    
    return {"message": "Your account and personal data have been deleted"}


class ConsentRecord(BaseModel):
    consent_type: str  # "privacy_policy", "terms", "marketing"
    consented: bool
    version: str = "1.0"


@api_router.post("/users/me/consent")
async def record_consent(
    consent: ConsentRecord,
    context: TenantContext = Depends(get_tenant_context),
    request: Request = None
):
    """
    Record user consent for GDPR compliance
    """
    consent_doc = {
        "id": str(uuid4()),
        "user_id": context.user_id,
        "user_email": context.user_email,
        "consent_type": consent.consent_type,
        "consented": consent.consented,
        "version": consent.version,
        "ip_address": request.client.host if request and request.client else None,
        "user_agent": request.headers.get("user-agent") if request else None,
        "recorded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.consent_records.insert_one(consent_doc)
    
    return {"message": "Consent recorded", "consent_id": consent_doc["id"]}


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

@api_router.get("/platform/plans")
async def get_plan_configurations():
    """
    Get all available plan configurations with features and limits.
    Public endpoint for displaying plan options during tenant creation.
    """
    plans = []
    for plan_key, config in PLAN_CONFIG.items():
        plans.append({
            "id": plan_key.value,
            "name": config["name"],
            "price": config["price"],
            "currency": config["currency"],
            "max_vehicles": config["max_vehicles"],
            "max_users": config["max_users"],
            "customizations_per_month": config["customizations_per_month"],
            "features": config["features"],
            "description": config["description"],
            "tagline": config["tagline"],
            "is_popular": config.get("is_popular", False)
        })
    return {"plans": plans}


@api_router.get("/platform/feature-registry")
async def get_feature_registry(
    context: TenantContext = Depends(require_platform_admin)
):
    """
    Get the complete feature registry with all available features.
    Used for the admin UI to show feature checkboxes.
    """
    # Group features by category
    features_by_category = {}
    for category_key, category_name in FEATURE_CATEGORIES.items():
        features_by_category[category_key] = {
            "name": category_name,
            "features": []
        }
    
    for feature_key, feature_config in FEATURE_REGISTRY.items():
        category = feature_config.get("category", "core")
        if category in features_by_category:
            features_by_category[category]["features"].append({
                "key": feature_key,
                "name": feature_config["name"],
                "description": feature_config["description"],
                "default_plans": feature_config.get("default_plans", []),
                "sellable": feature_config.get("sellable", False),
                "addon_price": feature_config.get("addon_price", 0)
            })
    
    return {
        "categories": features_by_category,
        "all_features": {
            key: {
                "name": val["name"],
                "description": val["description"],
                "category": val["category"],
                "default_plans": val.get("default_plans", []),
                "sellable": val.get("sellable", False),
                "addon_price": val.get("addon_price", 0)
            }
            for key, val in FEATURE_REGISTRY.items()
        }
    }


@api_router.get("/platform/tenants/{tenant_id}/features")
async def get_tenant_features(
    tenant_id: str,
    context: TenantContext = Depends(require_platform_admin)
):
    """
    Get the effective features for a tenant (plan features + overrides).
    """
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Handle legacy plan names
    plan_value = tenant.get("plan", "standard")
    plan_mapping = {"starter": "standard", "basic": "standard", "pro": "professional"}
    plan_value = plan_mapping.get(plan_value, plan_value)
    try:
        plan = TenantPlan(plan_value)
    except ValueError:
        plan = TenantPlan.STANDARD
    
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG[TenantPlan.STANDARD])
    
    # Get base features from plan
    features = plan_config["features"].copy()
    
    # Apply any feature overrides
    overrides = tenant.get("feature_overrides", {})
    for key, value in overrides.items():
        features[key] = value
    
    return {
        "tenant_id": tenant_id,
        "plan": plan.value,
        "plan_name": plan_config["name"],
        "features": features,
        "limits": {
            "max_vehicles": tenant.get("max_vehicles", plan_config["max_vehicles"]),
            "max_users": tenant.get("max_users", plan_config["max_users"]),
            "customizations_remaining": tenant.get("customizations_remaining", plan_config["customizations_per_month"]),
            "customizations_per_month": plan_config["customizations_per_month"]
        },
        "feature_overrides": overrides
    }


@api_router.put("/platform/tenants/{tenant_id}/features")
async def update_tenant_features(
    tenant_id: str,
    feature_updates: dict,
    context: TenantContext = Depends(require_super_admin)
):
    """
    Update feature overrides for a tenant (super admin only).
    Can enable/disable specific features or adjust limits.
    """
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Handle feature overrides
    if "features" in feature_updates:
        current_overrides = tenant.get("feature_overrides", {})
        current_overrides.update(feature_updates["features"])
        update_data["feature_overrides"] = current_overrides
    
    # Handle limit overrides
    if "max_vehicles" in feature_updates:
        update_data["max_vehicles"] = feature_updates["max_vehicles"]
    if "max_users" in feature_updates:
        update_data["max_users"] = feature_updates["max_users"]
    
    await db.tenants.update_one({"id": tenant_id}, {"$set": update_data})
    
    # Log audit event
    await audit_service.log_tenant_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.TENANT_UPDATED,
        tenant_id=tenant_id,
        meta={"action": "features_updated", "updates": feature_updates}
    )
    
    return {"message": "Features updated successfully", "updates": update_data}


@api_router.post("/platform/tenants/{tenant_id}/use-customization")
async def use_customization_credit(
    tenant_id: str,
    description: str = "",
    context: TenantContext = Depends(require_super_admin)
):
    """
    Use one customization credit for a tenant.
    Returns error if no credits remaining.
    """
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get plan config for monthly limit
    plan_value = tenant.get("plan", "standard")
    plan_mapping = {"starter": "standard", "basic": "standard", "pro": "professional"}
    plan_value = plan_mapping.get(plan_value, plan_value)
    try:
        plan = TenantPlan(plan_value)
    except ValueError:
        plan = TenantPlan.STANDARD
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG[TenantPlan.STANDARD])
    
    # Check remaining credits
    remaining = tenant.get("customizations_remaining", plan_config["customizations_per_month"])
    if remaining <= 0:
        raise HTTPException(
            status_code=403,
            detail="No customization credits remaining. Next reset at month end."
        )
    
    # Deduct one credit
    await db.tenants.update_one(
        {"id": tenant_id},
        {
            "$set": {"customizations_remaining": remaining - 1},
            "$push": {
                "customization_history": {
                    "date": datetime.now(timezone.utc).isoformat(),
                    "description": description,
                    "used_by": context.user_email
                }
            }
        }
    )
    
    return {
        "message": "Customization credit used",
        "credits_remaining": remaining - 1,
        "credits_per_month": plan_config["customizations_per_month"]
    }


@api_router.post("/platform/tenants/{tenant_id}/reset-customizations")
async def reset_customization_credits(
    tenant_id: str,
    context: TenantContext = Depends(require_super_admin)
):
    """
    Manually reset customization credits for a tenant (super admin only).
    Useful for testing or granting bonus credits.
    """
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get plan config
    plan_value = tenant.get("plan", "standard")
    plan_mapping = {"starter": "standard", "basic": "standard", "pro": "professional"}
    plan_value = plan_mapping.get(plan_value, plan_value)
    try:
        plan = TenantPlan(plan_value)
    except ValueError:
        plan = TenantPlan.STANDARD
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG[TenantPlan.STANDARD])
    
    # Reset to plan's monthly limit
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {
            "customizations_remaining": plan_config["customizations_per_month"],
            "customizations_reset_date": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Customization credits reset",
        "credits_remaining": plan_config["customizations_per_month"]
    }


@api_router.put("/platform/tenants/{tenant_id}/plan")
async def update_tenant_plan(
    tenant_id: str,
    new_plan: str,
    context: TenantContext = Depends(require_super_admin)
):
    """
    Change a tenant's subscription plan (super admin only).
    Updates plan, limits, and features according to new plan.
    """
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Validate plan
    try:
        plan = TenantPlan(new_plan)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {new_plan}. Must be 'standard', 'essential', or 'professional'")
    
    plan_config = PLAN_CONFIG[plan]
    
    # Update tenant with new plan and limits
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {
            "plan": plan.value,
            "max_vehicles": plan_config["max_vehicles"],
            "max_users": plan_config["max_users"],
            "customizations_remaining": plan_config["customizations_per_month"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log audit event
    await audit_service.log_tenant_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.TENANT_UPDATED,
        tenant_id=tenant_id,
        meta={"action": "plan_changed", "old_plan": tenant.get("plan"), "new_plan": plan.value}
    )
    
    return {
        "message": f"Plan updated to {plan_config['name']}",
        "plan": plan.value,
        "new_limits": {
            "max_vehicles": plan_config["max_vehicles"],
            "max_users": plan_config["max_users"],
            "customizations_per_month": plan_config["customizations_per_month"]
        }
    }


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
    
    # Get plan configuration
    plan_config = PLAN_CONFIG.get(tenant_data.plan, PLAN_CONFIG[TenantPlan.STANDARD])
    
    # Use custom limits if provided by super admin, otherwise use plan defaults
    max_vehicles = tenant_data.custom_max_vehicles or plan_config["max_vehicles"]
    max_users = tenant_data.custom_max_users or plan_config["max_users"]
    customizations = plan_config["customizations_per_month"]
    
    tenant_id = str(uuid.uuid4())
    tenant = {
        "id": tenant_id,
        "name": tenant_data.name,
        "slug": tenant_data.slug,
        "status": TenantStatus.ACTIVE.value,
        "plan": tenant_data.plan.value,
        "max_vehicles": max_vehicles,
        "max_users": max_users,
        "customizations_remaining": customizations,
        "customizations_reset_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "feature_overrides": tenant_data.feature_overrides or {},
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
    
    # Default password rule: firstname + "123" (e.g., admin123, john123)
    # Extract first name from email (before @ and before any dots)
    email_prefix = master_email.split('@')[0]
    first_name = email_prefix.split('.')[0] if '.' in email_prefix else email_prefix
    master_password = f"{first_name}123"
    
    # Check if user with this email already exists
    existing_user = await db.users.find_one({"email": master_email}, {"_id": 0})
    
    if existing_user:
        # User exists - just add them as Master Admin of this tenant
        user_id = existing_user["id"]
        master_password = None  # Don't show password for existing user
    else:
        # Create new Master Admin user with must_change_password flag
        user_id = str(uuid.uuid4())
        master_user = {
            "id": user_id,
            "email": master_email,
            "name": master_name,
            "password_hash": get_password_hash(master_password),
            "is_active": True,
            "must_change_password": True,  # Force password change on first login
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
    
    # AUTO-ADD SUPERADMIN AS ADMIN FOR REMOTE SUPPORT
    # superadmin@quickwing.com gets admin access to every franchise for support
    superadmin = await db.users.find_one({"email": "superadmin@quickwing.com"}, {"_id": 0})
    if superadmin:
        # Check if superadmin already has membership to this tenant
        existing_sa_membership = await db.memberships.find_one({
            "user_id": superadmin["id"],
            "tenant_id": tenant_id
        })
        if not existing_sa_membership:
            sa_membership = {
                "id": str(uuid.uuid4()),
                "user_id": superadmin["id"],
                "tenant_id": tenant_id,
                "role": UserRole.ADMIN.value,  # Admin role for support access
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.memberships.insert_one(sa_membership)
    
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
    # Format: {FRONTEND_URL}/{tenant_slug}/login
    # Uses environment variable for deployment flexibility
    base_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
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
    """List all tenants (Super/Master Admin only) with master admin info and usage stats"""
    query = {}
    if status:
        query["status"] = status
    
    tenants = await db.tenants.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.tenants.count_documents(query)
    
    # Enrich each tenant with master admin info and usage stats
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
        
        # Get usage counts
        tenant["vehicles_count"] = await db.vehicles.count_documents({"tenant_id": tenant["id"]})
        tenant["users_count"] = await db.memberships.count_documents({"tenant_id": tenant["id"]})
    
    return {"tenants": tenants, "total": total}


@api_router.get("/platform/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    context: TenantContext = Depends(require_platform_admin)
):
    """Get tenant details with usage stats and plan features"""
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
    
    # Get plan configuration - handle legacy plan names
    plan_value = tenant.get("plan", "standard")
    plan_mapping = {"starter": "standard", "basic": "standard", "pro": "professional"}
    plan_value = plan_mapping.get(plan_value, plan_value)
    try:
        plan = TenantPlan(plan_value)
    except ValueError:
        plan = TenantPlan.STANDARD
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG[TenantPlan.STANDARD])
    
    # Get effective features (plan features + overrides)
    features = plan_config["features"].copy()
    overrides = tenant.get("feature_overrides", {})
    for key, value in overrides.items():
        features[key] = value
    
    return {
        "tenant": tenant,
        "usage": {
            "vehicles": vehicles_count,
            "max_vehicles": tenant.get("max_vehicles", plan_config["max_vehicles"]),
            "users": users_count,
            "max_users": tenant.get("max_users", plan_config["max_users"]),
            "bookings_total": bookings_count,
            "bookings_this_month": bookings_this_month
        },
        "plan_config": {
            "name": plan_config["name"],
            "price": plan_config["price"],
            "currency": plan_config["currency"],
            "customizations_per_month": plan_config["customizations_per_month"],
            "description": plan_config["description"]
        },
        "features": features,
        "feature_overrides": overrides
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


@api_router.get("/my-plan")
async def get_my_plan(context: TenantContext = Depends(require_tenant_context)):
    """Get the current tenant's plan, features, and usage limits"""
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get plan configuration - handle legacy plan names
    plan_value = tenant.get("plan", "standard")
    # Map legacy plan names to new ones
    plan_mapping = {"starter": "standard", "basic": "standard", "pro": "professional"}
    plan_value = plan_mapping.get(plan_value, plan_value)
    
    try:
        plan = TenantPlan(plan_value)
    except ValueError:
        plan = TenantPlan.STANDARD  # Default to standard if unknown plan
    
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG[TenantPlan.STANDARD])
    
    # Get effective features (plan features + overrides)
    features = plan_config["features"].copy()
    overrides = tenant.get("feature_overrides", {})
    for key, value in overrides.items():
        features[key] = value
    
    # Get current usage
    vehicles_count = await db.vehicles.count_documents({"tenant_id": context.tenant_id})
    users_count = await db.memberships.count_documents({"tenant_id": context.tenant_id})
    
    return {
        "plan": {
            "id": plan.value,
            "name": plan_config["name"],
            "description": plan_config["description"],
            "tagline": plan_config["tagline"]
        },
        "limits": {
            "max_vehicles": tenant.get("max_vehicles", plan_config["max_vehicles"]),
            "max_users": tenant.get("max_users", plan_config["max_users"]),
            "customizations_remaining": tenant.get("customizations_remaining", plan_config["customizations_per_month"]),
            "customizations_per_month": plan_config["customizations_per_month"]
        },
        "usage": {
            "vehicles": vehicles_count,
            "users": users_count
        },
        "features": features
    }


# ==================== TENANT SETTINGS (BRANDING & ANALYTICS) ====================

class TenantSettingsUpdate(BaseModel):
    """Update tenant settings for branding and analytics"""
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None  # Hex color code
    mileage_rate: Optional[float] = None  # Cost per km/mile
    fuel_cost_per_km: Optional[float] = None  # Fuel cost per km
    maintenance_cost_per_km: Optional[float] = None  # Maintenance cost per km
    currency: Optional[str] = None  # EUR, GBP, USD
    distance_unit: Optional[str] = None  # km or miles


@api_router.get("/tenant/settings")
async def get_tenant_settings(context: TenantContext = Depends(require_tenant_context)):
    """Get tenant settings including branding and analytics configuration"""
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get plan to check feature access
    plan_value = tenant.get("plan", "standard")
    plan_mapping = {"starter": "standard", "basic": "standard", "pro": "professional"}
    plan_value = plan_mapping.get(plan_value, plan_value)
    
    try:
        plan = TenantPlan(plan_value)
    except ValueError:
        plan = TenantPlan.STANDARD
    
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG[TenantPlan.STANDARD])
    features = plan_config["features"].copy()
    overrides = tenant.get("feature_overrides", {})
    for key, value in overrides.items():
        features[key] = value
    
    # Return settings
    settings = tenant.get("settings", {})
    return {
        "branding": {
            "logo_url": settings.get("logo_url"),
            "primary_color": settings.get("primary_color", "#7c3aed"),  # Default purple for Pro
            "enabled": features.get("custom_branding", False)
        },
        "cost_analytics": {
            "mileage_rate": settings.get("mileage_rate", 0.35),  # Default €0.35 per km
            "fuel_cost_per_km": settings.get("fuel_cost_per_km", 0.12),
            "maintenance_cost_per_km": settings.get("maintenance_cost_per_km", 0.08),
            "currency": settings.get("currency", "EUR"),
            "distance_unit": settings.get("distance_unit", "km"),
            "enabled": features.get("cost_analytics", False)
        }
    }


@api_router.put("/tenant/settings")
async def update_tenant_settings(
    settings_data: TenantSettingsUpdate,
    context: TenantContext = Depends(require_admin)
):
    """Update tenant settings (admin only)"""
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get plan to check feature access
    plan_value = tenant.get("plan", "standard")
    plan_mapping = {"starter": "standard", "basic": "standard", "pro": "professional"}
    plan_value = plan_mapping.get(plan_value, plan_value)
    
    try:
        plan = TenantPlan(plan_value)
    except ValueError:
        plan = TenantPlan.STANDARD
    
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG[TenantPlan.STANDARD])
    features = plan_config["features"].copy()
    overrides = tenant.get("feature_overrides", {})
    for key, value in overrides.items():
        features[key] = value
    
    # Build update dict
    current_settings = tenant.get("settings", {})
    update_fields = {}
    
    # Branding settings (requires custom_branding feature)
    if features.get("custom_branding"):
        if settings_data.logo_url is not None:
            update_fields["settings.logo_url"] = settings_data.logo_url
        if settings_data.primary_color is not None:
            update_fields["settings.primary_color"] = settings_data.primary_color
    
    # Cost analytics settings (requires cost_analytics feature)
    if features.get("cost_analytics"):
        if settings_data.mileage_rate is not None:
            update_fields["settings.mileage_rate"] = settings_data.mileage_rate
        if settings_data.fuel_cost_per_km is not None:
            update_fields["settings.fuel_cost_per_km"] = settings_data.fuel_cost_per_km
        if settings_data.maintenance_cost_per_km is not None:
            update_fields["settings.maintenance_cost_per_km"] = settings_data.maintenance_cost_per_km
        if settings_data.currency is not None:
            update_fields["settings.currency"] = settings_data.currency
        if settings_data.distance_unit is not None:
            update_fields["settings.distance_unit"] = settings_data.distance_unit
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.tenants.update_one({"id": context.tenant_id}, {"$set": update_fields})
    
    # Return updated settings
    updated_tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    updated_settings = updated_tenant.get("settings", {})
    
    return {
        "message": "Settings updated successfully",
        "settings": {
            "branding": {
                "logo_url": updated_settings.get("logo_url"),
                "primary_color": updated_settings.get("primary_color", "#7c3aed"),
                "enabled": features.get("custom_branding", False)
            },
            "cost_analytics": {
                "mileage_rate": updated_settings.get("mileage_rate", 0.35),
                "fuel_cost_per_km": updated_settings.get("fuel_cost_per_km", 0.12),
                "maintenance_cost_per_km": updated_settings.get("maintenance_cost_per_km", 0.08),
                "currency": updated_settings.get("currency", "EUR"),
                "distance_unit": updated_settings.get("distance_unit", "km"),
                "enabled": features.get("cost_analytics", False)
            }
        }
    }


# Create uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads" / "logos"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@api_router.post("/tenant/upload-logo")
async def upload_tenant_logo(
    file: UploadFile = File(...),
    context: TenantContext = Depends(require_admin)
):
    """Upload a logo image for the tenant (Professional tier only)"""
    # Check if tenant has custom_branding feature
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    plan_value = tenant.get("plan", "standard")
    plan_mapping = {"starter": "standard", "basic": "standard", "pro": "professional"}
    plan_value = plan_mapping.get(plan_value, plan_value)
    
    try:
        plan = TenantPlan(plan_value)
    except ValueError:
        plan = TenantPlan.STANDARD
    
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG[TenantPlan.STANDARD])
    features = plan_config["features"].copy()
    overrides = tenant.get("feature_overrides", {})
    for key, value in overrides.items():
        features[key] = value
    
    if not features.get("custom_branding"):
        raise HTTPException(status_code=403, detail="Custom branding not available on your plan")
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PNG, JPG, WEBP, SVG")
    
    # Validate file size (max 2MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 2MB")
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"{context.tenant_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Generate URL
    base_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    logo_url = f"{base_url}/api/uploads/logos/{filename}"
    
    # Update tenant settings
    await db.tenants.update_one(
        {"id": context.tenant_id},
        {"$set": {
            "settings.logo_url": logo_url,
            "settings.logo_filename": filename,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Logo uploaded successfully",
        "logo_url": logo_url
    }


@api_router.get("/uploads/logos/{filename}")
async def get_logo(filename: str):
    """Serve uploaded logo files"""
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Logo not found")
    
    return FileResponse(filepath)


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


class DeleteUserRequest(BaseModel):
    admin_password: str


@api_router.delete("/platform/users/{user_id}")
async def delete_user_completely(
    user_id: str,
    delete_request: DeleteUserRequest,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None
):
    """
    Super admin can delete a user completely.
    This removes the user from all tenants and deletes their account.
    Requires super admin password confirmation.
    """
    # Verify super admin password
    admin = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not admin or not verify_password(delete_request.admin_password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    # Get target user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting super admin
    if user.get("role") == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot delete super admin accounts")
    
    # Prevent self-deletion
    if user_id == context.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user_email = user["email"]
    
    # Delete all memberships
    deleted_memberships = await db.memberships.delete_many({"user_id": user_id})
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    # Log audit event
    await audit_service.log(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_DELETED,
        resource_type="user",
        resource_id=user_id,
        meta={
            "target_email": user_email,
            "memberships_deleted": deleted_memberships.deleted_count
        },
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "message": f"User '{user_email}' deleted successfully",
        "memberships_deleted": deleted_memberships.deleted_count
    }


class ChangeUserRoleRequest(BaseModel):
    tenant_id: str
    new_role: str  # Accept string instead of enum for flexibility
    admin_password: str


@api_router.put("/platform/users/{user_id}/change-role")
async def change_user_role(
    user_id: str,
    role_request: ChangeUserRoleRequest,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None
):
    """
    Super admin can change any user's role within a tenant.
    Requires super admin password confirmation.
    """
    # Verify super admin password
    admin = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not admin or not verify_password(role_request.admin_password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    # Validate role
    valid_roles = ["staff", "admin", "master_admin"]
    if role_request.new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
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
        {"$set": {"role": role_request.new_role}}
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
            "new_role": role_request.new_role
        },
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "message": f"Role updated for {user['email']}",
        "old_role": old_role,
        "new_role": role_request.new_role
    }


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


@api_router.get("/platform/audit-log/pdf")
async def download_audit_log_pdf(
    tenant_id: Optional[str] = None,
    filter_type: str = "all",  # 'all', 'command-centre', or tenant_id
    context: TenantContext = Depends(require_platform_admin)
):
    """Download Audit Log as PDF with company branding"""
    from services.pdf_service import pdf_generator
    
    query = {}
    filter_name = "All Activity"
    tenant_name = None
    
    if filter_type == "command-centre":
        # Platform-level events only (no tenant_id)
        query["tenant_id"] = {"$exists": False}
        filter_name = "Command Centre"
    elif tenant_id:
        query["tenant_id"] = tenant_id
        # Get tenant name
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "name": 1})
        if tenant:
            tenant_name = tenant.get("name")
            filter_name = tenant_name
    
    events = await db.audit_events.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(500).to_list(500)
    
    # Get company settings for branding
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        settings = {"company_name": "Quick Wing Fleet Management"}
    
    # Generate PDF
    pdf_buffer = pdf_generator.generate_audit_log_pdf(events, settings, filter_name, tenant_name)
    
    filename = f"audit_log_{filter_type}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


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
    
    # Generate password: if provided use it, otherwise use firstname + "123"
    if user_data.password:
        password = user_data.password
    else:
        email_prefix = user_data.email.split('@')[0]
        first_name = email_prefix.split('.')[0] if '.' in email_prefix else email_prefix
        password = f"{first_name}123"
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": get_password_hash(password),
        "is_active": True,
        "must_change_password": True,  # Force password change on first login
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
    
    return {
        "message": "User created successfully", 
        "user_id": user_id,
        "temporary_password": password,
        "must_change_password": True
    }


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
    
    # Check plan limits for users
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    current_user_count = await db.memberships.count_documents({"tenant_id": context.tenant_id})
    max_users = tenant.get("max_users", 20)
    
    if current_user_count >= max_users:
        raise HTTPException(
            status_code=403,
            detail=f"User limit reached ({max_users}). Please upgrade your plan to add more users."
        )
    
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
    
    # Generate temporary password for new users: firstname + "123"
    # Extract first name from email (before @ and before any dots) or from name field
    if user_data.password:
        temp_password = user_data.password
    else:
        email_prefix = user_data.email.split('@')[0]
        first_name = email_prefix.split('.')[0] if '.' in email_prefix else email_prefix
        temp_password = f"{first_name}123"
    
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
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    staff_login_url = f"{frontend_url}/{tenant['slug']}/login" if tenant else None
    
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


class TenantResetPasswordRequest(BaseModel):
    admin_password: str
    new_password: str


@api_router.post("/tenant/users/{user_id}/reset-password")
async def reset_tenant_user_password(
    user_id: str,
    reset_request: TenantResetPasswordRequest,
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """
    Franchise admin can reset staff passwords within their tenant.
    Requires admin password confirmation.
    Available on ALL plan types.
    """
    # Verify admin's password
    admin = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not admin or not verify_password(reset_request.admin_password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    # Check that target user is in this tenant
    membership = await db.memberships.find_one({
        "user_id": user_id,
        "tenant_id": context.tenant_id
    }, {"_id": 0})
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in this franchise")
    
    # Don't allow resetting master_admin password (they should reset their own)
    if membership.get("role") == "master_admin" and context.user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the master admin can change their own password")
    
    # Get target user details
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    new_hash = get_password_hash(reset_request.new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": new_hash}})
    
    # Log audit event
    await audit_service.log_user_action(
        actor_user_id=context.user_id,
        actor_email=context.user_email,
        action=AuditAction.USER_UPDATED,
        target_user_id=user_id,
        tenant_id=context.tenant_id,
        meta={"action": "password_reset", "target_email": user["email"]},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": f"Password reset successfully for {user['email']}"}


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
    """List vehicles in the current tenant with real-time booking status"""
    query = TenantQueryBuilder.scope(context.tenant_id)
    vehicles = await db.vehicles.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Get current time for booking status check
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    # Find active bookings for all vehicles in this tenant
    active_bookings_query = {
        "tenant_id": context.tenant_id,
        "status": "approved",
        "start_time": {"$lte": now_iso},
        "end_time": {"$gte": now_iso}
    }
    active_bookings = await db.bookings.find(active_bookings_query, {"_id": 0}).to_list(1000)
    
    # Create a map of vehicle_id -> active booking
    vehicle_bookings = {b["car_id"]: b for b in active_bookings}
    
    # Update vehicle status based on active bookings
    for vehicle in vehicles:
        vehicle_id = vehicle.get("id")
        if vehicle_id in vehicle_bookings and not vehicle.get("is_blocked"):
            # Vehicle has an active booking right now
            booking = vehicle_bookings[vehicle_id]
            vehicle["current_status"] = "In Use"
            vehicle["active_booking"] = {
                "user_name": booking.get("user_name"),
                "purpose": booking.get("purpose"),
                "end_time": booking.get("end_time")
            }
        elif vehicle.get("is_blocked"):
            vehicle["current_status"] = "Blocked"
        elif vehicle.get("current_status") == "In Use" and vehicle_id not in vehicle_bookings:
            # No active booking, but status was "In Use" - check if it should be free
            # Only auto-update if it was set by booking system
            pass  # Keep manual status
    
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
    vehicle_id: Optional[str] = None,
    context: TenantContext = Depends(require_admin)
):
    """
    Get hourly availability timeline for vehicles on a specific day.
    If vehicle_id is provided, shows data for that specific vehicle.
    Otherwise, shows aggregated data for all vehicles.
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
    
    # Build vehicle list for dropdown
    vehicle_list = [{"id": v["id"], "name": v.get("name", v.get("registration", "Unknown")), "registration": v.get("registration", "")} for v in vehicles if not v.get("is_blocked")]
    
    # If filtering by specific vehicle
    selected_vehicle = None
    if vehicle_id:
        selected_vehicle = next((v for v in vehicles if v["id"] == vehicle_id), None)
        if not selected_vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Get bookings for this day
    booking_query = {
        "tenant_id": tenant_id,
        "start_time": {"$lte": day_end.isoformat()},
        "end_time": {"$gte": day_start.isoformat()}
    }
    if vehicle_id:
        booking_query["car_id"] = vehicle_id
    
    bookings = await db.bookings.find(booking_query, {"_id": 0}).to_list(10000)
    
    # Build hourly timeline (07:00 - 22:00)
    timeline = []
    for hour in range(7, 23):  # 07:00 to 22:00
        hour_start = target_date.replace(hour=hour, minute=0, second=0, microsecond=0)
        hour_end = target_date.replace(hour=hour, minute=59, second=59, microsecond=999999)
        
        # Count vehicles in use during this hour
        vehicles_in_use = set()
        # Make hour_start and hour_end timezone-aware for comparison
        hour_start_aware = hour_start.replace(tzinfo=timezone.utc)
        hour_end_aware = hour_end.replace(tzinfo=timezone.utc)
        
        for booking in bookings:
            try:
                # Parse booking times and ensure they are timezone-aware
                start_str = booking["start_time"].replace("Z", "+00:00")
                end_str = booking["end_time"].replace("Z", "+00:00")
                
                booking_start = datetime.fromisoformat(start_str)
                booking_end = datetime.fromisoformat(end_str)
                
                # Make timezone-aware if naive
                if booking_start.tzinfo is None:
                    booking_start = booking_start.replace(tzinfo=timezone.utc)
                if booking_end.tzinfo is None:
                    booking_end = booking_end.replace(tzinfo=timezone.utc)
                
                # Check if booking overlaps with this hour
                if booking_start <= hour_end_aware and booking_end >= hour_start_aware:
                    vehicles_in_use.add(booking["car_id"])
            except (ValueError, KeyError, TypeError):
                continue
        
        in_use_count = len(vehicles_in_use)
        
        # For single vehicle view, show if booked (1) or free (0)
        if vehicle_id:
            is_booked = vehicle_id in vehicles_in_use
            timeline.append({
                "hour": f"{hour:02d}:00",
                "hour_24": hour,
                "total_fleet": 1,
                "in_use": 1 if is_booked else 0,
                "free": 0 if is_booked else 1,
                "utilization_percent": 100 if is_booked else 0,
                "status": "Booked" if is_booked else "Available"
            })
        else:
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
        "vehicle_list": vehicle_list,
        "selected_vehicle": {
            "id": selected_vehicle["id"],
            "name": selected_vehicle.get("name", selected_vehicle.get("registration", "Unknown")),
            "registration": selected_vehicle.get("registration", "")
        } if selected_vehicle else None,
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


# ==================== LOCATIONS (Admin-configured) ====================

@api_router.get("/locations")
async def list_locations(
    context: TenantContext = Depends(require_tenant_context)
):
    """List all configured locations for the tenant"""
    query = TenantQueryBuilder.scope(context.tenant_id)
    locations = await db.locations.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    return {"locations": locations}


@api_router.post("/locations")
async def create_location(
    location_data: LocationCreate,
    context: TenantContext = Depends(require_admin)
):
    """Create a new location (Admin only)"""
    location = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        **location_data.model_dump(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If this is set as default, unset other defaults
    if location_data.is_default:
        await db.locations.update_many(
            {"tenant_id": context.tenant_id},
            {"$set": {"is_default": False}}
        )
    
    await db.locations.insert_one(location)
    return {k: v for k, v in location.items() if k != "_id"}


@api_router.put("/locations/{location_id}")
async def update_location(
    location_id: str,
    location_data: LocationUpdate,
    context: TenantContext = Depends(require_admin)
):
    """Update a location (Admin only)"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, location_id)
    location = await db.locations.find_one(query)
    
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    update_data = {k: v for k, v in location_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If setting as default, unset other defaults
    if location_data.is_default:
        await db.locations.update_many(
            {"tenant_id": context.tenant_id, "id": {"$ne": location_id}},
            {"$set": {"is_default": False}}
        )
    
    await db.locations.update_one(query, {"$set": update_data})
    
    updated = await db.locations.find_one(query, {"_id": 0})
    return updated


@api_router.delete("/locations/{location_id}")
async def delete_location(
    location_id: str,
    context: TenantContext = Depends(require_admin)
):
    """Delete a location (Admin only)"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, location_id)
    result = await db.locations.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    
    return {"message": "Location deleted"}


# ==================== QR CODE ====================

@api_router.get("/vehicles/{vehicle_id}/qr")
async def get_vehicle_qr(
    vehicle_id: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """Get QR code for a vehicle - links to mileage logging page"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Generate QR with tenant context - links to mileage log page
    # Use FRONTEND_URL from environment, default to production URL
    base_url = os.environ.get('FRONTEND_URL', 'https://quick-wing.com')
    qr_url = f"{base_url}/{context.tenant_slug}/vehicle/{vehicle_id}/mileage"
    
    logger.info(f"Generating QR code for vehicle {vehicle_id} with URL: {qr_url}")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="image/png")


class MileageLogRequest(BaseModel):
    """Request model for logging vehicle mileage"""
    mileage: int
    notes: Optional[str] = None
    logged_via: Optional[str] = "manual"  # manual, qr_scan, etc.


@api_router.post("/vehicles/{vehicle_id}/log-mileage")
async def log_vehicle_mileage(
    vehicle_id: str,
    request: MileageLogRequest,
    context: TenantContext = Depends(require_tenant_context)
):
    """Log mileage for a vehicle (via QR scan or manual entry)"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Create mileage log entry
    mileage_log = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        "vehicle_id": vehicle_id,
        "mileage": request.mileage,
        "previous_mileage": vehicle.get("current_mileage"),
        "difference": request.mileage - vehicle.get("current_mileage", 0) if vehicle.get("current_mileage") else None,
        "notes": request.notes,
        "logged_by": context.user_email,
        "logged_via": request.logged_via,
        "logged_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert mileage log
    await db.mileage_logs.insert_one(mileage_log)
    
    # Update vehicle's current mileage
    await db.vehicles.update_one(
        query,
        {"$set": {
            "current_mileage": request.mileage,
            "last_mileage_update": datetime.now(timezone.utc).isoformat(),
            "last_mileage_logged_by": context.user_email
        }}
    )
    
    return {
        "message": "Mileage logged successfully",
        "mileage_log": {k: v for k, v in mileage_log.items() if k != "_id"}
    }


@api_router.get("/vehicles/{vehicle_id}/mileage-history")
async def get_vehicle_mileage_history(
    vehicle_id: str,
    limit: int = 20,
    context: TenantContext = Depends(require_tenant_context)
):
    """Get mileage history for a vehicle"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Get mileage logs
    logs = await db.mileage_logs.find(
        {"tenant_id": context.tenant_id, "vehicle_id": vehicle_id},
        {"_id": 0}
    ).sort("logged_at", -1).limit(limit).to_list(limit)
    
    return {
        "vehicle_id": vehicle_id,
        "current_mileage": vehicle.get("current_mileage"),
        "history": logs
    }


# ==================== PUBLIC QR CODE ENDPOINTS (NO AUTH REQUIRED) ====================

class PublicMileageSubmission(BaseModel):
    """Request model for public mileage submission via QR code"""
    mileage: int
    submitted_by_name: Optional[str] = None  # Optional - person's name
    notes: Optional[str] = None


@api_router.get("/public/vehicle/{tenant_slug}/{vehicle_id}")
async def get_public_vehicle_info(tenant_slug: str, vehicle_id: str):
    """
    PUBLIC ENDPOINT - No authentication required.
    Get vehicle information for QR code mileage submission page.
    """
    # Find tenant by slug
    tenant = await db.tenants.find_one({"slug": tenant_slug}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    # Find vehicle
    vehicle = await db.vehicles.find_one(
        {"tenant_id": tenant["id"], "id": vehicle_id},
        {"_id": 0}
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Return limited public info
    return {
        "vehicle": {
            "id": vehicle["id"],
            "name": vehicle.get("name", "Unknown Vehicle"),
            "registration": vehicle.get("registration", ""),
            "current_mileage": vehicle.get("current_mileage"),
            "last_mileage_update": vehicle.get("last_mileage_update"),
            "current_status": vehicle.get("current_status", "Unknown")
        },
        "tenant": {
            "name": tenant.get("name", "Unknown Organisation"),
            "slug": tenant_slug
        }
    }


@api_router.post("/public/vehicle/{tenant_slug}/{vehicle_id}/submit-mileage")
async def submit_public_mileage(
    tenant_slug: str,
    vehicle_id: str,
    submission: PublicMileageSubmission,
    request: Request = None
):
    """
    PUBLIC ENDPOINT - No authentication required.
    Submit mileage reading via QR code scan.
    """
    # Find tenant by slug
    tenant = await db.tenants.find_one({"slug": tenant_slug}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    tenant_id = tenant["id"]
    
    # Find vehicle
    vehicle = await db.vehicles.find_one(
        {"tenant_id": tenant_id, "id": vehicle_id},
        {"_id": 0}
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Validate mileage (should be >= current)
    current_mileage = vehicle.get("current_mileage", 0) or 0
    if submission.mileage < current_mileage:
        raise HTTPException(
            status_code=400, 
            detail=f"Mileage cannot be less than current reading ({current_mileage} km)"
        )
    
    # Create mileage log entry
    submitted_by = submission.submitted_by_name or "QR Scan (Anonymous)"
    mileage_log = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "vehicle_id": vehicle_id,
        "mileage": submission.mileage,
        "previous_mileage": current_mileage,
        "difference": submission.mileage - current_mileage if current_mileage else None,
        "notes": submission.notes,
        "logged_by": submitted_by,
        "logged_via": "qr_scan_public",
        "logged_at": datetime.now(timezone.utc).isoformat(),
        "ip_address": request.client.host if request and request.client else None
    }
    
    # Insert mileage log
    await db.mileage_logs.insert_one(mileage_log)
    
    # Update vehicle's current mileage
    await db.vehicles.update_one(
        {"tenant_id": tenant_id, "id": vehicle_id},
        {"$set": {
            "current_mileage": submission.mileage,
            "last_mileage_update": datetime.now(timezone.utc).isoformat(),
            "last_mileage_logged_by": submitted_by,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Check for service due alert
    service_alert = None
    service_due = vehicle.get("service_due_mileage")
    
    if service_due and submission.mileage:
        remaining_km = service_due - submission.mileage
        if remaining_km <= 0:
            service_alert = {
                "type": "overdue",
                "message": f"Service overdue by {abs(remaining_km)} km"
            }
        elif remaining_km <= 500:
            service_alert = {
                "type": "urgent",
                "message": f"Service due in {remaining_km} km"
            }
        elif remaining_km <= 1000:
            service_alert = {
                "type": "warning",
                "message": f"Service approaching in {remaining_km} km"
            }
    
    # Create status update record for audit trail
    status_update = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "car_id": vehicle_id,
        "status": vehicle.get("current_status", "Unknown"),
        "mileage": submission.mileage,
        "notes": f"Mileage submitted via QR scan by {submitted_by}",
        "reported_by": submitted_by,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "qr_scan_public",
        "service_alert": service_alert
    }
    await db.status_updates.insert_one(status_update)
    
    return {
        "success": True,
        "message": "Mileage submitted successfully",
        "vehicle_name": vehicle.get("name"),
        "registration": vehicle.get("registration"),
        "new_mileage": submission.mileage,
        "previous_mileage": current_mileage,
        "submitted_by": submitted_by,
        "service_alert": service_alert
    }


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


# Startup event
@app.on_event("startup")
async def startup():
    logger.info("Quick Wing Multi-Tenant SaaS starting up...")
    
    # Seed database with super admin
    await seed_super_admin()
    
    # Seed Malcolm's super admin account
    await seed_malcolm_admin()
    
    # Seed Open Claw bot account
    await seed_bot_account()
    
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


async def seed_bot_account():
    """Ensure Open Claw bot account exists on startup."""
    BOT_EMAIL = "bot@quickwing.com"
    BOT_PASSWORD = "bot123"
    BOT_NAME = "Open Claw Bot"
    
    try:
        existing = await db.users.find_one({"email": BOT_EMAIL})
        
        if existing:
            user_id = existing["id"]
            logger.info(f"Bot account exists: {BOT_EMAIL}")
            
            # Ensure password is correct and role is set
            password_hash = get_password_hash(BOT_PASSWORD)
            await db.users.update_one(
                {"email": BOT_EMAIL},
                {"$set": {"password_hash": password_hash, "is_active": True, "role": "bot"}}
            )
        else:
            # Create bot account
            user_id = str(uuid.uuid4())
            password_hash = get_password_hash(BOT_PASSWORD)
            bot_user = {
                "id": user_id,
                "email": BOT_EMAIL,
                "name": BOT_NAME,
                "password_hash": password_hash,
                "role": "bot",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(bot_user)
            logger.info(f"Created bot account: {BOT_EMAIL}")
        
        # Ensure membership exists for bot role
        existing_membership = await db.memberships.find_one({
            "user_id": user_id,
            "role": "bot"
        })
        
        if not existing_membership:
            membership = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "tenant_id": None,
                "role": "bot",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.memberships.insert_one(membership)
            logger.info("Created bot membership for Open Claw")
            
    except Exception as e:
        logger.error(f"Error seeding bot account: {e}")


async def seed_malcolm_admin():
    """Ensure Malcolm's super admin account exists on startup."""
    MALCOLM_EMAIL = "malcolm@quickwing.com"
    MALCOLM_PASSWORD = "Malcolm123"
    MALCOLM_NAME = "Malcolm"
    
    try:
        existing = await db.users.find_one({"email": MALCOLM_EMAIL})
        
        if existing:
            user_id = existing["id"]
            logger.info(f"Malcolm admin exists: {MALCOLM_EMAIL}")
            
            # Ensure password is correct and role is set
            password_hash = get_password_hash(MALCOLM_PASSWORD)
            await db.users.update_one(
                {"email": MALCOLM_EMAIL},
                {"$set": {"password_hash": password_hash, "is_active": True, "role": "super_admin"}}
            )
        else:
            # Create Malcolm's account
            user_id = str(uuid.uuid4())
            password_hash = get_password_hash(MALCOLM_PASSWORD)
            malcolm_user = {
                "id": user_id,
                "email": MALCOLM_EMAIL,
                "name": MALCOLM_NAME,
                "password_hash": password_hash,
                "role": "super_admin",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(malcolm_user)
            logger.info(f"Created Malcolm admin: {MALCOLM_EMAIL}")
        
        # Ensure membership exists
        existing_membership = await db.memberships.find_one({
            "user_id": user_id,
            "role": "super_admin"
        })
        
        if not existing_membership:
            membership = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "tenant_id": None,
                "role": "super_admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.memberships.insert_one(membership)
            logger.info("Created super_admin membership for Malcolm")
            
    except Exception as e:
        logger.error(f"Error seeding Malcolm admin: {e}")


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
                    logger.info("Updated existing membership to super_admin role")
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
                    logger.info("Created super_admin membership for existing user")
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
            logger.info("Created super_admin membership")
        
        logger.info("="*50)
        logger.info("ADMIN CREDENTIALS:")
        logger.info(f"  Email: {SUPER_ADMIN_EMAIL}")
        logger.info(f"  Password: {SUPER_ADMIN_PASSWORD}")
        logger.info(f"  URL: {os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/login")
        logger.info("="*50)
        
    except Exception as e:
        logger.error(f"Error seeding super admin: {e}")


# ==================== QUICK WING CONTENT WORKER ====================

class ContentAssetCreate(BaseModel):
    """Create a new content asset"""
    title: str
    file_type: str  # image, video
    original_file_url: str
    thumbnail_url: Optional[str] = None
    notes: Optional[str] = None


class ContentDraftCreate(BaseModel):
    """Create a content draft"""
    asset_id: str
    post_title: str
    post_type: str  # product_demo, pain_point, before_after, educational, trust_proof, feature_spotlight
    format_type: str  # reel, carousel, single_image, story
    caption_option_1: Optional[str] = None
    caption_option_2: Optional[str] = None
    caption_option_3: Optional[str] = None
    selected_caption: Optional[str] = None
    hook: Optional[str] = None
    cta: Optional[str] = None
    hashtags: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[str] = None


class ContentDraftUpdate(BaseModel):
    """Update a content draft"""
    post_title: Optional[str] = None
    caption_option_1: Optional[str] = None
    caption_option_2: Optional[str] = None
    caption_option_3: Optional[str] = None
    selected_caption: Optional[str] = None
    hook: Optional[str] = None
    cta: Optional[str] = None
    hashtags: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[str] = None


class PrivacyFlagCreate(BaseModel):
    """Create a privacy flag for an asset"""
    asset_id: str
    flag_type: str  # face, name, email, phone, address, license_plate, other
    detected_text: Optional[str] = None
    x_position: float
    y_position: float
    width: float
    height: float
    blur_applied: bool = False


class PostTemplateCreate(BaseModel):
    """Create a post template"""
    template_name: str
    format_type: str
    brand_style: Optional[str] = None
    logo_position: Optional[str] = None
    active: bool = True


class ContentIdeaCreate(BaseModel):
    """Create a content idea"""
    title: str
    category: str
    recommended_format: Optional[str] = None
    hook: Optional[str] = None
    caption_starter: Optional[str] = None
    cta: Optional[str] = None
    target_audience: Optional[str] = None
    reason_for_recommendation: Optional[str] = None
    confidence_score: Optional[float] = None


# Content Worker - Dashboard Stats
@api_router.get("/content-worker/stats")
async def get_content_worker_stats(context: TenantContext = Depends(require_super_admin)):
    """Get content worker dashboard statistics"""
    drafts = await db.content_drafts.count_documents({})
    in_review = await db.content_drafts.count_documents({"status": "review"})
    approved = await db.content_drafts.count_documents({"status": "approved"})
    scheduled = await db.content_drafts.count_documents({"status": "scheduled"})
    posted = await db.content_drafts.count_documents({"status": "posted"})
    rejected = await db.content_drafts.count_documents({"status": "rejected"})
    assets = await db.content_assets.count_documents({})
    ideas = await db.content_ideas.count_documents({})
    
    # Recent uploads
    recent_assets = await db.content_assets.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Recent ideas
    recent_ideas = await db.content_ideas.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "stats": {
            "total_drafts": drafts,
            "in_review": in_review,
            "approved": approved,
            "scheduled": scheduled,
            "posted": posted,
            "rejected": rejected,
            "total_assets": assets,
            "total_ideas": ideas
        },
        "recent_assets": recent_assets,
        "recent_ideas": recent_ideas
    }


# Content Assets
@api_router.get("/content-worker/assets")
async def get_content_assets(
    limit: int = 50,
    skip: int = 0,
    context: TenantContext = Depends(require_super_admin)
):
    """Get all content assets"""
    assets = await db.content_assets.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.content_assets.count_documents({})
    return {"assets": assets, "total": total}


@api_router.post("/content-worker/assets")
async def create_content_asset(
    asset: ContentAssetCreate,
    context: TenantContext = Depends(require_super_admin)
):
    """Create a new content asset"""
    asset_doc = {
        "id": str(uuid.uuid4()),
        "title": asset.title,
        "file_type": asset.file_type,
        "original_file_url": asset.original_file_url,
        "processed_file_url": None,
        "thumbnail_url": asset.thumbnail_url,
        "uploaded_by": context.user_email,
        "notes": asset.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.content_assets.insert_one(asset_doc)
    return {"message": "Asset created", "asset": {k: v for k, v in asset_doc.items() if k != "_id"}}


@api_router.post("/content-worker/assets/upload")
async def upload_content_asset(
    file: UploadFile = File(...),
    title: str = "",
    context: TenantContext = Depends(require_super_admin)
):
    """Upload a content asset file"""
    # Create content uploads directory
    content_uploads = ROOT_DIR / "uploads" / "content"
    content_uploads.mkdir(parents=True, exist_ok=True)
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PNG, JPG, WEBP, GIF, MP4, MOV, WEBM")
    
    # Read and save file
    contents = await file.read()
    if len(contents) > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 100MB")
    
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"content_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = content_uploads / filename
    
    with open(filepath, "wb") as f:
        f.write(contents)
    
    base_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    file_url = f"{base_url}/api/content-worker/files/{filename}"
    
    file_type = "video" if file.content_type.startswith("video") else "image"
    
    asset_doc = {
        "id": str(uuid.uuid4()),
        "title": title or file.filename,
        "file_type": file_type,
        "original_file_url": file_url,
        "processed_file_url": None,
        "thumbnail_url": file_url if file_type == "image" else None,
        "uploaded_by": context.user_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.content_assets.insert_one(asset_doc)
    
    return {"message": "Asset uploaded", "asset": {k: v for k, v in asset_doc.items() if k != "_id"}}


@api_router.get("/content-worker/files/{filename}")
async def get_content_file(filename: str):
    """Serve content files"""
    filepath = ROOT_DIR / "uploads" / "content" / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)


@api_router.delete("/content-worker/assets/{asset_id}")
async def delete_content_asset(asset_id: str, context: TenantContext = Depends(require_super_admin)):
    """Delete a content asset"""
    result = await db.content_assets.delete_one({"id": asset_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    # Also delete related drafts and privacy flags
    await db.content_drafts.delete_many({"asset_id": asset_id})
    await db.privacy_flags.delete_many({"asset_id": asset_id})
    return {"message": "Asset deleted"}


# Content Drafts
@api_router.get("/content-worker/drafts")
async def get_content_drafts(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    context: TenantContext = Depends(require_super_admin)
):
    """Get content drafts with optional status filter"""
    query = {}
    if status:
        query["status"] = status
    drafts = await db.content_drafts.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.content_drafts.count_documents(query)
    
    # Enrich with asset data
    for draft in drafts:
        asset = await db.content_assets.find_one({"id": draft.get("asset_id")}, {"_id": 0})
        draft["asset"] = asset
    
    return {"drafts": drafts, "total": total}


@api_router.get("/content-worker/drafts/{draft_id}")
async def get_content_draft(draft_id: str, context: TenantContext = Depends(require_super_admin)):
    """Get a specific content draft"""
    draft = await db.content_drafts.find_one({"id": draft_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    asset = await db.content_assets.find_one({"id": draft.get("asset_id")}, {"_id": 0})
    draft["asset"] = asset
    
    # Get privacy flags for the asset
    flags = await db.privacy_flags.find({"asset_id": draft.get("asset_id")}, {"_id": 0}).to_list(100)
    draft["privacy_flags"] = flags
    
    return draft


@api_router.post("/content-worker/drafts")
async def create_content_draft(
    draft: ContentDraftCreate,
    context: TenantContext = Depends(require_super_admin)
):
    """Create a new content draft"""
    # Verify asset exists
    asset = await db.content_assets.find_one({"id": draft.asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    draft_doc = {
        "id": str(uuid.uuid4()),
        "asset_id": draft.asset_id,
        "post_title": draft.post_title,
        "post_type": draft.post_type,
        "format_type": draft.format_type,
        "caption_option_1": draft.caption_option_1,
        "caption_option_2": draft.caption_option_2,
        "caption_option_3": draft.caption_option_3,
        "selected_caption": draft.selected_caption,
        "hook": draft.hook,
        "cta": draft.cta,
        "hashtags": draft.hashtags,
        "status": "draft",
        "scheduled_at": draft.scheduled_at,
        "approved_by": None,
        "notes": draft.notes,
        "created_by": context.user_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.content_drafts.insert_one(draft_doc)
    return {"message": "Draft created", "draft": {k: v for k, v in draft_doc.items() if k != "_id"}}


@api_router.put("/content-worker/drafts/{draft_id}")
async def update_content_draft(
    draft_id: str,
    update: ContentDraftUpdate,
    context: TenantContext = Depends(require_super_admin)
):
    """Update a content draft"""
    draft = await db.content_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Track approval
    if update.status == "approved":
        update_data["approved_by"] = context.user_email
    
    await db.content_drafts.update_one({"id": draft_id}, {"$set": update_data})
    
    updated = await db.content_drafts.find_one({"id": draft_id}, {"_id": 0})
    return {"message": "Draft updated", "draft": updated}


@api_router.post("/content-worker/drafts/{draft_id}/submit-review")
async def submit_draft_for_review(draft_id: str, context: TenantContext = Depends(require_super_admin)):
    """Submit a draft for review"""
    result = await db.content_drafts.update_one(
        {"id": draft_id},
        {"$set": {"status": "review", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"message": "Draft submitted for review"}


@api_router.post("/content-worker/drafts/{draft_id}/approve")
async def approve_draft(draft_id: str, context: TenantContext = Depends(require_super_admin)):
    """Approve a draft"""
    result = await db.content_drafts.update_one(
        {"id": draft_id},
        {"$set": {
            "status": "approved",
            "approved_by": context.user_email,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"message": "Draft approved"}


@api_router.post("/content-worker/drafts/{draft_id}/reject")
async def reject_draft(
    draft_id: str,
    notes: Optional[str] = None,
    context: TenantContext = Depends(require_super_admin)
):
    """Reject a draft"""
    update_data = {
        "status": "rejected",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if notes:
        update_data["notes"] = notes
    
    result = await db.content_drafts.update_one({"id": draft_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"message": "Draft rejected"}


@api_router.delete("/content-worker/drafts/{draft_id}")
async def delete_content_draft(draft_id: str, context: TenantContext = Depends(require_super_admin)):
    """Delete a content draft"""
    result = await db.content_drafts.delete_one({"id": draft_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"message": "Draft deleted"}


# Privacy Flags
@api_router.get("/content-worker/assets/{asset_id}/privacy-flags")
async def get_privacy_flags(asset_id: str, context: TenantContext = Depends(require_super_admin)):
    """Get privacy flags for an asset"""
    flags = await db.privacy_flags.find({"asset_id": asset_id}, {"_id": 0}).to_list(100)
    return {"flags": flags}


@api_router.post("/content-worker/privacy-flags")
async def create_privacy_flag(
    flag: PrivacyFlagCreate,
    context: TenantContext = Depends(require_super_admin)
):
    """Create a privacy flag"""
    flag_doc = {
        "id": str(uuid.uuid4()),
        "asset_id": flag.asset_id,
        "flag_type": flag.flag_type,
        "detected_text": flag.detected_text,
        "x_position": flag.x_position,
        "y_position": flag.y_position,
        "width": flag.width,
        "height": flag.height,
        "blur_applied": flag.blur_applied,
        "manually_adjusted": False,
        "reviewed_by": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.privacy_flags.insert_one(flag_doc)
    return {"message": "Privacy flag created", "flag": {k: v for k, v in flag_doc.items() if k != "_id"}}


@api_router.put("/content-worker/privacy-flags/{flag_id}")
async def update_privacy_flag(
    flag_id: str,
    x_position: Optional[float] = None,
    y_position: Optional[float] = None,
    width: Optional[float] = None,
    height: Optional[float] = None,
    blur_applied: Optional[bool] = None,
    context: TenantContext = Depends(require_super_admin)
):
    """Update a privacy flag"""
    update_data = {"manually_adjusted": True, "reviewed_by": context.user_email}
    if x_position is not None:
        update_data["x_position"] = x_position
    if y_position is not None:
        update_data["y_position"] = y_position
    if width is not None:
        update_data["width"] = width
    if height is not None:
        update_data["height"] = height
    if blur_applied is not None:
        update_data["blur_applied"] = blur_applied
    
    result = await db.privacy_flags.update_one({"id": flag_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Flag not found")
    return {"message": "Privacy flag updated"}


@api_router.delete("/content-worker/privacy-flags/{flag_id}")
async def delete_privacy_flag(flag_id: str, context: TenantContext = Depends(require_super_admin)):
    """Delete a privacy flag"""
    result = await db.privacy_flags.delete_one({"id": flag_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flag not found")
    return {"message": "Privacy flag deleted"}


# Post Templates
@api_router.get("/content-worker/templates")
async def get_post_templates(context: TenantContext = Depends(require_super_admin)):
    """Get all post templates"""
    templates = await db.post_templates.find({}, {"_id": 0}).to_list(100)
    return {"templates": templates}


@api_router.post("/content-worker/templates")
async def create_post_template(
    template: PostTemplateCreate,
    context: TenantContext = Depends(require_super_admin)
):
    """Create a post template"""
    template_doc = {
        "id": str(uuid.uuid4()),
        "template_name": template.template_name,
        "format_type": template.format_type,
        "brand_style": template.brand_style,
        "logo_position": template.logo_position,
        "active": template.active,
        "created_by": context.user_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.post_templates.insert_one(template_doc)
    return {"message": "Template created", "template": {k: v for k, v in template_doc.items() if k != "_id"}}


@api_router.put("/content-worker/templates/{template_id}")
async def update_post_template(
    template_id: str,
    template_name: Optional[str] = None,
    format_type: Optional[str] = None,
    brand_style: Optional[str] = None,
    logo_position: Optional[str] = None,
    active: Optional[bool] = None,
    context: TenantContext = Depends(require_super_admin)
):
    """Update a post template"""
    update_data = {}
    if template_name is not None:
        update_data["template_name"] = template_name
    if format_type is not None:
        update_data["format_type"] = format_type
    if brand_style is not None:
        update_data["brand_style"] = brand_style
    if logo_position is not None:
        update_data["logo_position"] = logo_position
    if active is not None:
        update_data["active"] = active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.post_templates.update_one({"id": template_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated"}


@api_router.delete("/content-worker/templates/{template_id}")
async def delete_post_template(template_id: str, context: TenantContext = Depends(require_super_admin)):
    """Delete a post template"""
    result = await db.post_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}


# Instagram Settings (placeholder)
@api_router.get("/content-worker/instagram-settings")
async def get_instagram_settings(context: TenantContext = Depends(require_super_admin)):
    """Get Instagram settings"""
    settings = await db.instagram_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "id": str(uuid.uuid4()),
            "account_name": None,
            "connection_status": "not_connected",
            "token_status": "none",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.instagram_settings.insert_one(settings)
    return settings


@api_router.put("/content-worker/instagram-settings")
async def update_instagram_settings(
    account_name: Optional[str] = None,
    context: TenantContext = Depends(require_super_admin)
):
    """Update Instagram settings (placeholder)"""
    settings = await db.instagram_settings.find_one({})
    if not settings:
        settings = {
            "id": str(uuid.uuid4()),
            "account_name": account_name,
            "connection_status": "not_connected",
            "token_status": "none",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.instagram_settings.insert_one(settings)
    else:
        await db.instagram_settings.update_one(
            {"id": settings["id"]},
            {"$set": {"account_name": account_name, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"message": "Instagram settings updated"}


# ==================== INSTAGRAM PUBLISHING & ANALYTICS ====================

class InstagramConnectionData(BaseModel):
    """Instagram connection data"""
    access_token: str
    account_id: str
    account_name: str
    token_expires_at: Optional[str] = None


@api_router.post("/content-worker/instagram/connect")
async def connect_instagram(
    connection_data: InstagramConnectionData,
    context: TenantContext = Depends(require_super_admin)
):
    """Connect Instagram account (simulated - in production would validate with Meta API)"""
    
    settings = await db.instagram_settings.find_one({})
    
    update_data = {
        "account_name": connection_data.account_name,
        "account_id": connection_data.account_id,
        "access_token": connection_data.access_token,  # In production, encrypt this
        "token_expires_at": connection_data.token_expires_at,
        "connection_status": "connected",
        "token_status": "valid",
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "last_sync_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if settings:
        await db.instagram_settings.update_one({"id": settings["id"]}, {"$set": update_data})
    else:
        update_data["id"] = str(uuid.uuid4())
        update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.instagram_settings.insert_one(update_data)
    
    return {"message": "Instagram connected", "account_name": connection_data.account_name}


@api_router.post("/content-worker/instagram/disconnect")
async def disconnect_instagram(context: TenantContext = Depends(require_super_admin)):
    """Disconnect Instagram account"""
    
    await db.instagram_settings.update_one(
        {},
        {"$set": {
            "access_token": None,
            "account_id": None,
            "connection_status": "not_connected",
            "token_status": "none",
            "connected_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Instagram disconnected"}


@api_router.post("/content-worker/instagram/refresh-token")
async def refresh_instagram_token(context: TenantContext = Depends(require_super_admin)):
    """Refresh Instagram token (placeholder - would call Meta API in production)"""
    
    settings = await db.instagram_settings.find_one({})
    if not settings or settings.get("connection_status") != "connected":
        raise HTTPException(status_code=400, detail="Instagram not connected")
    
    # In production, this would call Meta's token refresh endpoint
    new_expiry = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
    
    await db.instagram_settings.update_one(
        {},
        {"$set": {
            "token_status": "valid",
            "token_expires_at": new_expiry,
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Token refreshed", "expires_at": new_expiry}


@api_router.post("/content-worker/drafts/{draft_id}/schedule")
async def schedule_draft(
    draft_id: str,
    scheduled_at: str,
    context: TenantContext = Depends(require_super_admin)
):
    """Schedule an approved draft for publishing"""
    
    draft = await db.content_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft.get("status") not in ["approved"]:
        raise HTTPException(status_code=400, detail="Only approved drafts can be scheduled")
    
    # Validate scheduled time is in the future
    try:
        scheduled_datetime = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
        if scheduled_datetime <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    
    await db.content_drafts.update_one(
        {"id": draft_id},
        {"$set": {
            "status": "scheduled",
            "scheduled_at": scheduled_at,
            "scheduled_by": context.user_email,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Draft scheduled", "scheduled_at": scheduled_at}


@api_router.post("/content-worker/drafts/{draft_id}/unschedule")
async def unschedule_draft(
    draft_id: str,
    context: TenantContext = Depends(require_super_admin)
):
    """Unschedule a scheduled draft (revert to approved)"""
    
    draft = await db.content_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft.get("status") != "scheduled":
        raise HTTPException(status_code=400, detail="Only scheduled drafts can be unscheduled")
    
    await db.content_drafts.update_one(
        {"id": draft_id},
        {"$set": {
            "status": "approved",
            "scheduled_at": None,
            "scheduled_by": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Draft unscheduled, reverted to approved"}


@api_router.post("/content-worker/drafts/{draft_id}/publish")
async def publish_draft(
    draft_id: str,
    context: TenantContext = Depends(require_super_admin)
):
    """Publish a draft to Instagram (simulated - would call Meta API in production)"""
    
    draft = await db.content_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft.get("status") not in ["approved", "scheduled"]:
        raise HTTPException(status_code=400, detail="Only approved or scheduled drafts can be published")
    
    # Check Instagram connection
    settings = await db.instagram_settings.find_one({})
    if not settings or settings.get("connection_status") != "connected":
        raise HTTPException(status_code=400, detail="Instagram not connected. Please connect your account first.")
    
    # Set status to publishing
    await db.content_drafts.update_one(
        {"id": draft_id},
        {"$set": {"status": "publishing", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    try:
        # Simulate Instagram API call
        # In production, this would:
        # 1. Upload media to Instagram
        # 2. Create the post with caption
        # 3. Get the post ID and URL
        
        # Simulated success response
        instagram_post_id = f"ig_{uuid.uuid4().hex[:16]}"
        post_url = f"https://www.instagram.com/p/{uuid.uuid4().hex[:11]}/"
        
        await db.content_drafts.update_one(
            {"id": draft_id},
            {"$set": {
                "status": "posted",
                "instagram_post_id": instagram_post_id,
                "instagram_post_url": post_url,
                "published_at": datetime.now(timezone.utc).isoformat(),
                "published_by": context.user_email,
                "publish_error": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Initialize metrics record
        metrics_doc = {
            "id": str(uuid.uuid4()),
            "draft_id": draft_id,
            "instagram_post_id": instagram_post_id,
            "likes": 0,
            "comments": 0,
            "reach": 0,
            "saves": 0,
            "shares": 0,
            "impressions": 0,
            "pulled_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.instagram_metrics.insert_one(metrics_doc)
        
        return {
            "message": "Post published successfully",
            "instagram_post_id": instagram_post_id,
            "post_url": post_url
        }
        
    except Exception as e:
        # Handle publish failure
        await db.content_drafts.update_one(
            {"id": draft_id},
            {"$set": {
                "status": "failed",
                "publish_error": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail=f"Failed to publish: {str(e)}")


@api_router.post("/content-worker/drafts/{draft_id}/retry-publish")
async def retry_publish_draft(
    draft_id: str,
    context: TenantContext = Depends(require_super_admin)
):
    """Retry publishing a failed draft"""
    
    draft = await db.content_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft.get("status") != "failed":
        raise HTTPException(status_code=400, detail="Only failed drafts can be retried")
    
    # Reset to approved and try again
    await db.content_drafts.update_one(
        {"id": draft_id},
        {"$set": {
            "status": "approved",
            "publish_error": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Now publish
    return await publish_draft(draft_id, context)


@api_router.get("/content-worker/analytics/overview")
async def get_analytics_overview(
    context: TenantContext = Depends(require_super_admin)
):
    """Get analytics overview for published content"""
    
    # Get total published posts
    total_posts = await db.content_drafts.count_documents({"status": "posted"})
    
    # Get aggregate metrics
    pipeline = [
        {"$group": {
            "_id": None,
            "total_likes": {"$sum": "$likes"},
            "total_comments": {"$sum": "$comments"},
            "total_reach": {"$sum": "$reach"},
            "total_saves": {"$sum": "$saves"},
            "total_shares": {"$sum": "$shares"},
            "total_impressions": {"$sum": "$impressions"}
        }}
    ]
    
    metrics_agg = await db.instagram_metrics.aggregate(pipeline).to_list(1)
    
    if metrics_agg:
        totals = metrics_agg[0]
    else:
        totals = {
            "total_likes": 0,
            "total_comments": 0,
            "total_reach": 0,
            "total_saves": 0,
            "total_shares": 0,
            "total_impressions": 0
        }
    
    # Calculate engagement rate
    total_engagement = totals.get("total_likes", 0) + totals.get("total_comments", 0) + totals.get("total_saves", 0) + totals.get("total_shares", 0)
    total_reach = totals.get("total_reach", 0)
    engagement_rate = (total_engagement / total_reach * 100) if total_reach > 0 else 0
    
    return {
        "total_posts": total_posts,
        "total_likes": totals.get("total_likes", 0),
        "total_comments": totals.get("total_comments", 0),
        "total_reach": totals.get("total_reach", 0),
        "total_saves": totals.get("total_saves", 0),
        "total_shares": totals.get("total_shares", 0),
        "total_impressions": totals.get("total_impressions", 0),
        "engagement_rate": round(engagement_rate, 2),
        "avg_likes_per_post": round(totals.get("total_likes", 0) / total_posts, 1) if total_posts > 0 else 0,
        "avg_reach_per_post": round(totals.get("total_reach", 0) / total_posts, 1) if total_posts > 0 else 0
    }


@api_router.get("/content-worker/analytics/posts")
async def get_post_analytics(
    limit: int = 20,
    sort_by: str = "published_at",
    context: TenantContext = Depends(require_super_admin)
):
    """Get analytics for individual posts"""
    
    # Get posted drafts
    drafts = await db.content_drafts.find(
        {"status": "posted"},
        {"_id": 0}
    ).sort(sort_by, -1).limit(limit).to_list(limit)
    
    # Enrich with metrics
    for draft in drafts:
        metrics = await db.instagram_metrics.find_one(
            {"draft_id": draft.get("id")},
            {"_id": 0}
        )
        draft["metrics"] = metrics or {}
        
        # Get asset thumbnail
        if draft.get("asset_id"):
            asset = await db.content_assets.find_one(
                {"id": draft["asset_id"]},
                {"_id": 0, "thumbnail_url": 1, "original_file_url": 1}
            )
            draft["thumbnail"] = asset.get("thumbnail_url") or asset.get("original_file_url") if asset else None
    
    return {"posts": drafts, "total": len(drafts)}


@api_router.get("/content-worker/analytics/top-posts")
async def get_top_posts(
    metric: str = "likes",
    limit: int = 5,
    context: TenantContext = Depends(require_super_admin)
):
    """Get top performing posts by metric"""
    
    valid_metrics = ["likes", "comments", "reach", "saves", "shares", "impressions"]
    if metric not in valid_metrics:
        metric = "likes"
    
    # Get top metrics
    metrics = await db.instagram_metrics.find(
        {},
        {"_id": 0}
    ).sort(metric, -1).limit(limit).to_list(limit)
    
    # Enrich with draft data
    result = []
    for m in metrics:
        draft = await db.content_drafts.find_one(
            {"id": m.get("draft_id")},
            {"_id": 0, "post_title": 1, "post_type": 1, "format_type": 1, "asset_id": 1, "published_at": 1, "instagram_post_url": 1}
        )
        if draft:
            # Get thumbnail
            if draft.get("asset_id"):
                asset = await db.content_assets.find_one(
                    {"id": draft["asset_id"]},
                    {"_id": 0, "thumbnail_url": 1, "original_file_url": 1}
                )
                draft["thumbnail"] = asset.get("thumbnail_url") or asset.get("original_file_url") if asset else None
            
            result.append({
                **draft,
                "metrics": m
            })
    
    return {"posts": result, "sorted_by": metric}


@api_router.get("/content-worker/analytics/by-category")
async def get_analytics_by_category(
    context: TenantContext = Depends(require_super_admin)
):
    """Get analytics aggregated by content category"""
    
    # Get all posted drafts with their metrics
    drafts = await db.content_drafts.find(
        {"status": "posted"},
        {"_id": 0, "id": 1, "post_type": 1}
    ).to_list(100)
    
    category_stats = {}
    
    for draft in drafts:
        cat = draft.get("post_type", "unknown")
        if cat not in category_stats:
            category_stats[cat] = {"posts": 0, "likes": 0, "comments": 0, "reach": 0, "saves": 0}
        
        category_stats[cat]["posts"] += 1
        
        metrics = await db.instagram_metrics.find_one({"draft_id": draft.get("id")}, {"_id": 0})
        if metrics:
            category_stats[cat]["likes"] += metrics.get("likes", 0)
            category_stats[cat]["comments"] += metrics.get("comments", 0)
            category_stats[cat]["reach"] += metrics.get("reach", 0)
            category_stats[cat]["saves"] += metrics.get("saves", 0)
    
    # Calculate averages
    result = []
    for cat, stats in category_stats.items():
        if stats["posts"] > 0:
            result.append({
                "category": cat,
                "posts": stats["posts"],
                "total_likes": stats["likes"],
                "total_reach": stats["reach"],
                "avg_likes": round(stats["likes"] / stats["posts"], 1),
                "avg_reach": round(stats["reach"] / stats["posts"], 1),
                "engagement_rate": round((stats["likes"] + stats["comments"] + stats["saves"]) / stats["reach"] * 100, 2) if stats["reach"] > 0 else 0
            })
    
    result.sort(key=lambda x: x.get("avg_likes", 0), reverse=True)
    
    return {"categories": result}


@api_router.get("/content-worker/analytics/by-format")
async def get_analytics_by_format(
    context: TenantContext = Depends(require_super_admin)
):
    """Get analytics aggregated by content format"""
    
    drafts = await db.content_drafts.find(
        {"status": "posted"},
        {"_id": 0, "id": 1, "format_type": 1}
    ).to_list(100)
    
    format_stats = {}
    
    for draft in drafts:
        fmt = draft.get("format_type", "unknown")
        if fmt not in format_stats:
            format_stats[fmt] = {"posts": 0, "likes": 0, "comments": 0, "reach": 0, "saves": 0}
        
        format_stats[fmt]["posts"] += 1
        
        metrics = await db.instagram_metrics.find_one({"draft_id": draft.get("id")}, {"_id": 0})
        if metrics:
            format_stats[fmt]["likes"] += metrics.get("likes", 0)
            format_stats[fmt]["comments"] += metrics.get("comments", 0)
            format_stats[fmt]["reach"] += metrics.get("reach", 0)
            format_stats[fmt]["saves"] += metrics.get("saves", 0)
    
    result = []
    for fmt, stats in format_stats.items():
        if stats["posts"] > 0:
            result.append({
                "format": fmt,
                "posts": stats["posts"],
                "total_likes": stats["likes"],
                "total_reach": stats["reach"],
                "avg_likes": round(stats["likes"] / stats["posts"], 1),
                "avg_reach": round(stats["reach"] / stats["posts"], 1),
                "engagement_rate": round((stats["likes"] + stats["comments"] + stats["saves"]) / stats["reach"] * 100, 2) if stats["reach"] > 0 else 0
            })
    
    result.sort(key=lambda x: x.get("avg_likes", 0), reverse=True)
    
    return {"formats": result}


@api_router.post("/content-worker/analytics/sync")
async def sync_instagram_metrics(
    context: TenantContext = Depends(require_super_admin)
):
    """Sync metrics from Instagram (simulated - would call Meta API in production)"""
    
    settings = await db.instagram_settings.find_one({})
    if not settings or settings.get("connection_status") != "connected":
        raise HTTPException(status_code=400, detail="Instagram not connected")
    
    # Get all posted drafts
    drafts = await db.content_drafts.find(
        {"status": "posted", "instagram_post_id": {"$exists": True}},
        {"_id": 0, "id": 1, "instagram_post_id": 1}
    ).to_list(100)
    
    synced_count = 0
    
    for draft in drafts:
        # Simulate fetching metrics from Instagram API
        # In production, this would call the Instagram Insights API
        import random
        
        simulated_metrics = {
            "likes": random.randint(50, 500),
            "comments": random.randint(5, 50),
            "reach": random.randint(500, 5000),
            "saves": random.randint(10, 100),
            "shares": random.randint(5, 50),
            "impressions": random.randint(600, 6000),
            "pulled_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.instagram_metrics.update_one(
            {"draft_id": draft["id"]},
            {"$set": simulated_metrics},
            upsert=True
        )
        synced_count += 1
    
    # Update last sync timestamp
    await db.instagram_settings.update_one(
        {},
        {"$set": {"last_sync_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Synced metrics for {synced_count} posts", "synced_count": synced_count}


# Content Ideas
@api_router.get("/content-worker/ideas")
async def get_content_ideas(
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    context: TenantContext = Depends(require_super_admin)
):
    """Get content ideas"""
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    ideas = await db.content_ideas.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    total = await db.content_ideas.count_documents(query)
    return {"ideas": ideas, "total": total}


@api_router.post("/content-worker/ideas")
async def create_content_idea(
    idea: ContentIdeaCreate,
    context: TenantContext = Depends(require_super_admin)
):
    """Create a content idea"""
    idea_doc = {
        "id": str(uuid.uuid4()),
        "title": idea.title,
        "category": idea.category,
        "recommended_format": idea.recommended_format,
        "hook": idea.hook,
        "caption_starter": idea.caption_starter,
        "cta": idea.cta,
        "target_audience": idea.target_audience,
        "reason_for_recommendation": idea.reason_for_recommendation,
        "confidence_score": idea.confidence_score,
        "status": "new",
        "created_by": context.user_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.content_ideas.insert_one(idea_doc)
    return {"message": "Idea created", "idea": {k: v for k, v in idea_doc.items() if k != "_id"}}


@api_router.put("/content-worker/ideas/{idea_id}")
async def update_content_idea(
    idea_id: str,
    status: Optional[str] = None,
    context: TenantContext = Depends(require_super_admin)
):
    """Update a content idea status"""
    update_data = {}
    if status:
        update_data["status"] = status
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.content_ideas.update_one({"id": idea_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Idea not found")
    return {"message": "Idea updated"}


@api_router.delete("/content-worker/ideas/{idea_id}")
async def delete_content_idea(idea_id: str, context: TenantContext = Depends(require_super_admin)):
    """Delete a content idea"""
    result = await db.content_ideas.delete_one({"id": idea_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Idea not found")
    return {"message": "Idea deleted"}


# ==================== CONTENT IDEAS ENGINE ====================

# Content idea bank - curated ideas specific to Quick Wing value propositions
CONTENT_IDEAS_BANK = [
    # Product Demo Category
    {
        "category": "product_demo",
        "title": "60-Second Fleet Booking Demo",
        "hook": "Watch how fast your team can book a vehicle",
        "caption_starter": "No more calls. No more waiting. Quick Wing lets your team book a fleet vehicle in under 60 seconds.",
        "cta": "See the full booking flow in action",
        "target_audience": "Operations managers looking to streamline fleet access",
        "reason": "Booking speed is a top decision factor for fleet software buyers",
        "recommended_format": "reel",
        "goals": ["reach", "product_awareness"],
        "confidence": 92
    },
    {
        "category": "product_demo",
        "title": "Calendar View Walkthrough",
        "hook": "Your entire fleet schedule in one view",
        "caption_starter": "Daily, weekly, monthly - see exactly who has what vehicle and when. No more double bookings.",
        "cta": "Discover organized fleet visibility",
        "target_audience": "Fleet coordinators managing multiple vehicles",
        "reason": "Calendar visibility is consistently requested in demos",
        "recommended_format": "carousel",
        "goals": ["product_awareness", "education"],
        "confidence": 88
    },
    {
        "category": "product_demo",
        "title": "Mobile Booking in Action",
        "hook": "Book a vehicle from anywhere",
        "caption_starter": "Field teams need vehicles fast. Quick Wing works on any device - book, check availability, get confirmation.",
        "cta": "Try mobile fleet booking",
        "target_audience": "Field service teams and mobile workers",
        "reason": "Mobile-first workflows are increasingly important",
        "recommended_format": "reel",
        "goals": ["reach", "engagement"],
        "confidence": 85
    },
    
    # Pain Point Category
    {
        "category": "pain_point",
        "title": "The Spreadsheet Nightmare",
        "hook": "Still tracking your fleet in Excel?",
        "caption_starter": "Outdated data. Version conflicts. No real-time availability. There's a better way to manage your vehicles.",
        "cta": "Upgrade from spreadsheets today",
        "target_audience": "Businesses currently using manual fleet tracking",
        "reason": "Spreadsheet pain is a common entry point for new customers",
        "recommended_format": "carousel",
        "goals": ["leads", "product_awareness"],
        "confidence": 94
    },
    {
        "category": "pain_point",
        "title": "The Double Booking Problem",
        "hook": "Two people. One vehicle. Zero fun.",
        "caption_starter": "Double bookings cost time, money, and patience. Quick Wing shows real-time availability so this never happens.",
        "cta": "Eliminate double bookings forever",
        "target_audience": "Fleet managers dealing with booking conflicts",
        "reason": "Double booking is the #1 pain point mentioned in sales calls",
        "recommended_format": "reel",
        "goals": ["engagement", "leads"],
        "confidence": 96
    },
    {
        "category": "pain_point",
        "title": "The Admin Time Drain",
        "hook": "How many hours does your admin spend on fleet queries?",
        "caption_starter": "Checking availability. Confirming bookings. Chasing updates. Your admin team deserves automation.",
        "cta": "Free up your admin time",
        "target_audience": "Office managers and administrative staff",
        "reason": "Admin efficiency resonates with decision makers",
        "recommended_format": "single_image",
        "goals": ["leads", "engagement"],
        "confidence": 89
    },
    {
        "category": "pain_point",
        "title": "Where's the Vehicle?",
        "hook": "Do you actually know where your fleet is right now?",
        "caption_starter": "Missing vehicles. Unclear schedules. Frustrated teams. Get complete visibility with one dashboard.",
        "cta": "Know where every vehicle is",
        "target_audience": "Operations directors needing fleet oversight",
        "reason": "Visibility concerns drive urgency in purchase decisions",
        "recommended_format": "reel",
        "goals": ["reach", "leads"],
        "confidence": 87
    },
    
    # Before/After Category
    {
        "category": "before_after",
        "title": "Whiteboard vs Quick Wing",
        "hook": "Fleet management: then vs now",
        "caption_starter": "Before: Scribbled notes, erased bookings, constant confusion. After: Digital calendar, instant updates, total clarity.",
        "cta": "Make the switch today",
        "target_audience": "Small businesses using physical booking systems",
        "reason": "Visual before/after content performs well on Instagram",
        "recommended_format": "carousel",
        "goals": ["engagement", "product_awareness"],
        "confidence": 91
    },
    {
        "category": "before_after",
        "title": "Morning Chaos vs Morning Clarity",
        "hook": "8:30 AM at most businesses vs 8:30 AM with Quick Wing",
        "caption_starter": "Before: Frantic calls about vehicle availability. After: Everyone checks the app and just goes.",
        "cta": "Start your mornings right",
        "target_audience": "Teams with early morning fleet coordination",
        "reason": "Relatable daily scenarios drive engagement",
        "recommended_format": "reel",
        "goals": ["reach", "engagement"],
        "confidence": 86
    },
    {
        "category": "before_after",
        "title": "Compliance Stress vs Compliance Control",
        "hook": "How we used to track NCT dates vs how we track them now",
        "caption_starter": "Before: Sticky notes and calendar reminders. After: Automatic alerts 30 days before every deadline.",
        "cta": "Never miss a compliance deadline",
        "target_audience": "Fleet managers responsible for vehicle compliance",
        "reason": "Compliance is a high-stakes topic that gets attention",
        "recommended_format": "carousel",
        "goals": ["education", "leads"],
        "confidence": 90
    },
    
    # Educational Category
    {
        "category": "educational",
        "title": "5 Signs You've Outgrown Spreadsheets",
        "hook": "Is your fleet tracking system holding you back?",
        "caption_starter": "1. You've had double bookings. 2. Updates take hours. 3. Nobody trusts the data. 4. New staff can't figure it out. 5. You're losing time daily.",
        "cta": "It's time to upgrade",
        "target_audience": "Growing businesses with expanding fleets",
        "reason": "Educational listicles perform well and establish authority",
        "recommended_format": "carousel",
        "goals": ["education", "leads"],
        "confidence": 93
    },
    {
        "category": "educational",
        "title": "Fleet Booking Best Practices",
        "hook": "3 rules every fleet manager should follow",
        "caption_starter": "1. Book in advance when possible. 2. Always confirm return times. 3. Use a system that shows real-time availability.",
        "cta": "Implement these today",
        "target_audience": "New fleet managers and coordinators",
        "reason": "Best practice content builds trust with potential customers",
        "recommended_format": "carousel",
        "goals": ["education", "engagement"],
        "confidence": 84
    },
    {
        "category": "educational",
        "title": "What to Look for in Fleet Software",
        "hook": "Choosing fleet management software? Check these boxes first.",
        "caption_starter": "Real-time availability. Easy booking interface. Compliance tracking. Usage reports. Mobile access. These aren't nice-to-haves.",
        "cta": "See how Quick Wing stacks up",
        "target_audience": "Businesses evaluating fleet software options",
        "reason": "Buyer's guide content captures decision-stage prospects",
        "recommended_format": "carousel",
        "goals": ["leads", "education"],
        "confidence": 88
    },
    {
        "category": "educational",
        "title": "The True Cost of Manual Fleet Tracking",
        "hook": "Free spreadsheets aren't actually free",
        "caption_starter": "Admin hours. Booking errors. Compliance fines. Frustrated staff. The hidden costs add up faster than you think.",
        "cta": "Calculate your real cost",
        "target_audience": "Finance managers and business owners",
        "reason": "Cost-focused content resonates with budget holders",
        "recommended_format": "single_image",
        "goals": ["leads", "education"],
        "confidence": 85
    },
    
    # Trust/Proof Category
    {
        "category": "trust_proof",
        "title": "Customer Success Story",
        "hook": "How [Customer] cut fleet admin time by 70%",
        "caption_starter": "Before Quick Wing, their team spent hours on vehicle coordination. Now? It takes minutes. Here's what changed.",
        "cta": "Read the full story",
        "target_audience": "Skeptical prospects wanting proof",
        "reason": "Customer stories are the most trusted content type",
        "recommended_format": "carousel",
        "goals": ["leads", "engagement"],
        "confidence": 95
    },
    {
        "category": "trust_proof",
        "title": "Real Results: Booking Time Reduction",
        "hook": "From 10 minutes to 30 seconds",
        "caption_starter": "That's how much faster our customers book vehicles after switching to Quick Wing. Real data. Real impact.",
        "cta": "Get these results for your team",
        "target_audience": "Data-driven decision makers",
        "reason": "Specific metrics build credibility",
        "recommended_format": "single_image",
        "goals": ["leads", "product_awareness"],
        "confidence": 91
    },
    {
        "category": "trust_proof",
        "title": "Why Teams Choose Quick Wing",
        "hook": "What our customers say about switching",
        "caption_starter": "Easy to use. Finally organized. No more chaos. These are the words we hear most from teams who made the switch.",
        "cta": "Join them today",
        "target_audience": "Prospects in evaluation phase",
        "reason": "Social proof reduces purchase anxiety",
        "recommended_format": "carousel",
        "goals": ["engagement", "leads"],
        "confidence": 87
    },
    
    # Feature Spotlight Category
    {
        "category": "feature_spotlight",
        "title": "Compliance Alerts Deep Dive",
        "hook": "Never miss an NCT, tax, or service date again",
        "caption_starter": "Quick Wing tracks every compliance deadline and alerts you 30 days before. No spreadsheets. No sticky notes. Just automatic reminders.",
        "cta": "Set up compliance tracking",
        "target_audience": "Fleet managers worried about compliance",
        "reason": "Compliance is a key differentiator and pain point",
        "recommended_format": "reel",
        "goals": ["product_awareness", "leads"],
        "confidence": 92
    },
    {
        "category": "feature_spotlight",
        "title": "The Booking Calendar Explained",
        "hook": "See your entire fleet at a glance",
        "caption_starter": "Day view. Week view. Month view. Filter by vehicle. Filter by location. Quick Wing's calendar shows exactly what you need.",
        "cta": "Explore the calendar",
        "target_audience": "Visual thinkers who need clear interfaces",
        "reason": "The calendar is our most-used and most-praised feature",
        "recommended_format": "carousel",
        "goals": ["product_awareness", "education"],
        "confidence": 89
    },
    {
        "category": "feature_spotlight",
        "title": "Usage Reports That Actually Help",
        "hook": "Which vehicles are overused? Underused? Now you'll know.",
        "caption_starter": "Quick Wing's reports show booking patterns, utilization rates, and usage trends. Make decisions based on data, not guesses.",
        "cta": "See your fleet data clearly",
        "target_audience": "Managers who need to optimize fleet utilization",
        "reason": "Reporting is a key upgrade driver",
        "recommended_format": "carousel",
        "goals": ["product_awareness", "leads"],
        "confidence": 86
    },
    {
        "category": "feature_spotlight",
        "title": "Staff Permissions Done Right",
        "hook": "Control who can book what",
        "caption_starter": "Admins see everything. Staff see what they need. Quick Wing's permission system keeps things organized and secure.",
        "cta": "Set up your team access",
        "target_audience": "Organizations with multiple user roles",
        "reason": "Permissions matter for larger organizations",
        "recommended_format": "single_image",
        "goals": ["product_awareness", "education"],
        "confidence": 82
    }
]

# Performance placeholders (structure for future real data)
CATEGORY_PERFORMANCE = {
    "product_demo": {"score": 85, "engagement_rate": 4.2, "posts_this_month": 3},
    "pain_point": {"score": 92, "engagement_rate": 5.1, "posts_this_month": 4},
    "before_after": {"score": 88, "engagement_rate": 4.8, "posts_this_month": 2},
    "educational": {"score": 78, "engagement_rate": 3.5, "posts_this_month": 3},
    "trust_proof": {"score": 95, "engagement_rate": 5.8, "posts_this_month": 1},
    "feature_spotlight": {"score": 80, "engagement_rate": 3.9, "posts_this_month": 2}
}

FORMAT_PERFORMANCE = {
    "reel": {"score": 94, "avg_reach": 2500, "engagement_rate": 5.2},
    "carousel": {"score": 86, "avg_reach": 1800, "engagement_rate": 4.5},
    "single_image": {"score": 72, "avg_reach": 1200, "engagement_rate": 3.2},
    "story": {"score": 68, "avg_reach": 800, "engagement_rate": 2.8}
}


def generate_weekly_suggestions(goal: str = None, limit: int = 7) -> list:
    """Generate balanced weekly content suggestions"""
    import random
    
    # Filter by goal if specified
    if goal:
        ideas = [i for i in CONTENT_IDEAS_BANK if goal in i.get("goals", [])]
    else:
        ideas = CONTENT_IDEAS_BANK.copy()
    
    # Ensure category balance - aim for at least one from each category
    categories = ["product_demo", "pain_point", "before_after", "educational", "trust_proof", "feature_spotlight"]
    selected = []
    
    # First, pick one from each category (if available)
    for cat in categories:
        cat_ideas = [i for i in ideas if i["category"] == cat]
        if cat_ideas and len(selected) < limit:
            # Sort by confidence and pick top one
            cat_ideas.sort(key=lambda x: x.get("confidence", 50), reverse=True)
            selected.append(cat_ideas[0])
    
    # Fill remaining slots with highest confidence ideas not already selected
    remaining = [i for i in ideas if i not in selected]
    remaining.sort(key=lambda x: x.get("confidence", 50), reverse=True)
    
    while len(selected) < limit and remaining:
        selected.append(remaining.pop(0))
    
    # Shuffle to avoid predictable order
    random.shuffle(selected)
    
    # Add unique IDs and status
    for i, idea in enumerate(selected):
        idea = idea.copy()
        idea["id"] = f"suggestion_{uuid.uuid4().hex[:8]}"
        idea["status"] = "suggested"
        idea["week_position"] = i + 1
        selected[i] = idea
    
    return selected[:limit]


@api_router.get("/content-worker/ideas/suggestions")
async def get_weekly_suggestions(
    goal: Optional[str] = None,
    limit: int = 7,
    context: TenantContext = Depends(require_super_admin)
):
    """Get AI-suggested content ideas for the week"""
    suggestions = generate_weekly_suggestions(goal, limit)
    
    return {
        "suggestions": suggestions,
        "total": len(suggestions),
        "goal_filter": goal,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/content-worker/ideas/performance")
async def get_content_performance(
    context: TenantContext = Depends(require_super_admin)
):
    """Get category and format performance metrics (placeholder for future analytics)"""
    
    # Calculate posts per category from actual drafts
    category_counts = {}
    format_counts = {}
    
    async for draft in db.content_drafts.find({"status": {"$in": ["approved", "posted"]}}, {"_id": 0, "post_type": 1, "format_type": 1}):
        cat = draft.get("post_type", "unknown")
        fmt = draft.get("format_type", "unknown")
        category_counts[cat] = category_counts.get(cat, 0) + 1
        format_counts[fmt] = format_counts.get(fmt, 0) + 1
    
    # Merge with placeholder performance data
    categories = []
    for cat, data in CATEGORY_PERFORMANCE.items():
        categories.append({
            "id": cat,
            "name": cat.replace("_", " ").title(),
            "score": data["score"],
            "engagement_rate": data["engagement_rate"],
            "posts_count": category_counts.get(cat, data["posts_this_month"]),
            "trend": "up" if data["score"] > 80 else "stable"
        })
    
    formats = []
    for fmt, data in FORMAT_PERFORMANCE.items():
        formats.append({
            "id": fmt,
            "name": fmt.replace("_", " ").title(),
            "score": data["score"],
            "avg_reach": data["avg_reach"],
            "engagement_rate": data["engagement_rate"],
            "posts_count": format_counts.get(fmt, 0),
            "trend": "up" if data["score"] > 85 else "stable"
        })
    
    # Sort by score
    categories.sort(key=lambda x: x["score"], reverse=True)
    formats.sort(key=lambda x: x["score"], reverse=True)
    
    return {
        "categories": categories,
        "formats": formats,
        "note": "Performance data is currently based on industry benchmarks. Real analytics will be integrated when Instagram API is connected."
    }


class CreateIdeaFromSuggestion(BaseModel):
    """Create a content idea from a suggestion"""
    title: str
    category: str
    recommended_format: str
    hook: Optional[str] = None
    caption_starter: Optional[str] = None
    cta: Optional[str] = None
    target_audience: Optional[str] = None
    reason_for_recommendation: Optional[str] = None
    confidence_score: Optional[int] = None
    goal: Optional[str] = None


@api_router.post("/content-worker/ideas/from-suggestion")
async def create_idea_from_suggestion(
    idea_data: CreateIdeaFromSuggestion,
    context: TenantContext = Depends(require_super_admin)
):
    """Save a suggestion as a content idea"""
    idea_doc = {
        "id": str(uuid.uuid4()),
        "title": idea_data.title,
        "category": idea_data.category,
        "recommended_format": idea_data.recommended_format,
        "hook": idea_data.hook,
        "caption_starter": idea_data.caption_starter,
        "cta": idea_data.cta,
        "target_audience": idea_data.target_audience,
        "reason_for_recommendation": idea_data.reason_for_recommendation,
        "confidence_score": idea_data.confidence_score,
        "goal": idea_data.goal,
        "status": "saved",
        "created_by": context.user_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_ideas.insert_one(idea_doc)
    
    return {
        "message": "Idea saved",
        "idea": {k: v for k, v in idea_doc.items() if k != "_id"}
    }


@api_router.post("/content-worker/ideas/{idea_id}/create-draft")
async def create_draft_from_idea(
    idea_id: str,
    context: TenantContext = Depends(require_super_admin)
):
    """Create a content draft from an idea"""
    
    # Check if it's a saved idea in DB
    idea = await db.content_ideas.find_one({"id": idea_id}, {"_id": 0})
    
    if not idea:
        # Check if it's a suggestion ID (starts with suggestion_)
        if idea_id.startswith("suggestion_"):
            return {"error": "Please save the suggestion first before creating a draft"}
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # Create draft from idea
    draft_id = str(uuid.uuid4())
    
    # Generate captions based on idea
    captions = generate_captions(idea.get("category", "product_demo"), idea.get("goal", "operational_clarity"))
    
    draft_doc = {
        "id": draft_id,
        "asset_id": None,  # No asset yet
        "post_title": idea.get("title", "Untitled Post"),
        "post_type": idea.get("category", "product_demo"),
        "format_type": idea.get("recommended_format", "reel"),
        "content_focus": idea.get("goal", "operational_clarity"),
        "hook": idea.get("hook"),
        "cta": idea.get("cta"),
        "caption_option_1": idea.get("caption_starter"),
        "generated_captions": captions,
        "selected_caption_index": 0,
        "selected_caption": f"{idea.get('hook', '')}\n\n{idea.get('caption_starter', '')}\n\n{idea.get('cta', '')}",
        "hashtags": "#FleetManagement #QuickWing #BusinessEfficiency",
        "notes": f"Created from idea: {idea.get('title')}\nTarget audience: {idea.get('target_audience', 'N/A')}\nReason: {idea.get('reason_for_recommendation', 'N/A')}",
        "from_idea_id": idea_id,
        "status": "draft",
        "privacy_reviewed": False,
        "created_by": context.user_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_drafts.insert_one(draft_doc)
    
    # Update idea status
    await db.content_ideas.update_one(
        {"id": idea_id},
        {"$set": {"status": "draft_created", "draft_id": draft_id}}
    )
    
    return {
        "message": "Draft created from idea",
        "draft_id": draft_id,
        "draft": {k: v for k, v in draft_doc.items() if k != "_id"}
    }


# ==================== CONTENT WORKER - EXTENDED WORKFLOW ====================

import pytesseract
import cv2
import re
import base64
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Privacy detection patterns
PRIVACY_PATTERNS = {
    'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    'phone': r'(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}',
    'registration': r'[A-Z]{1,3}[-\s]?\d{1,4}[-\s]?[A-Z]{1,3}',
    'time_booking': r'\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?(?:\s*(?:AM|PM|am|pm))?',
    'date': r'\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}',
    'name_pattern': r'(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?',
}

# Sensitive keywords that may indicate private info
SENSITIVE_KEYWORDS = [
    'booking', 'booked', 'reserved', 'customer', 'client', 'patient',
    'name:', 'email:', 'phone:', 'mobile:', 'contact:', 'address:',
    'registration', 'reg no', 'license', 'vehicle:', 'car:',
    'pickup', 'drop-off', 'collection', 'delivery',
    'appointment', 'scheduled', 'confirmed'
]


def detect_privacy_issues(image_path: str) -> list:
    """Detect potentially sensitive information in an image using OCR"""
    try:
        img = Image.open(image_path)
        
        # Run OCR
        ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        
        detected_items = []
        img_width, img_height = img.size
        
        # Process OCR results
        n_boxes = len(ocr_data['text'])
        for i in range(n_boxes):
            text = ocr_data['text'][i].strip()
            if not text or len(text) < 2:
                continue
            
            conf = int(ocr_data['conf'][i]) if ocr_data['conf'][i] != '-1' else 0
            if conf < 30:  # Skip low confidence
                continue
            
            x = ocr_data['left'][i]
            y = ocr_data['top'][i]
            w = ocr_data['width'][i]
            h = ocr_data['height'][i]
            
            # Convert to percentages for responsive positioning
            x_pct = (x / img_width) * 100
            y_pct = (y / img_height) * 100
            w_pct = (w / img_width) * 100
            h_pct = (h / img_height) * 100
            
            detected_type = None
            
            # Check against patterns
            for pattern_name, pattern in PRIVACY_PATTERNS.items():
                if re.search(pattern, text, re.IGNORECASE):
                    detected_type = pattern_name
                    break
            
            # Check for sensitive keywords
            if not detected_type:
                text_lower = text.lower()
                for keyword in SENSITIVE_KEYWORDS:
                    if keyword in text_lower:
                        detected_type = 'sensitive_keyword'
                        break
            
            # Check if looks like a name (capitalized words)
            if not detected_type and re.match(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$', text):
                detected_type = 'potential_name'
            
            if detected_type:
                detected_items.append({
                    'id': str(uuid.uuid4()),
                    'type': detected_type,
                    'text': text,
                    'x': x_pct,
                    'y': y_pct,
                    'width': w_pct,
                    'height': h_pct,
                    'confidence': conf
                })
        
        return detected_items
    except Exception as e:
        logger.error(f"Privacy detection error: {e}")
        return []


def extract_video_frames(video_path: str, num_frames: int = 3) -> list:
    """Extract key frames from a video"""
    try:
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if total_frames == 0:
            return []
        
        # Calculate frame positions (evenly distributed)
        frame_positions = []
        if total_frames <= num_frames:
            frame_positions = list(range(total_frames))
        else:
            step = total_frames // (num_frames + 1)
            frame_positions = [step * (i + 1) for i in range(num_frames)]
        
        frames = []
        content_uploads = ROOT_DIR / "uploads" / "content" / "frames"
        content_uploads.mkdir(parents=True, exist_ok=True)
        
        base_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
        
        for idx, pos in enumerate(frame_positions):
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
            ret, frame = cap.read()
            if ret:
                frame_id = f"frame_{uuid.uuid4().hex[:8]}"
                filename = f"{frame_id}.jpg"
                filepath = content_uploads / filename
                cv2.imwrite(str(filepath), frame)
                
                frames.append({
                    'id': frame_id,
                    'frame_number': idx + 1,
                    'position': pos,
                    'url': f"{base_url}/api/content-worker/files/frames/{filename}",
                    'filename': filename
                })
        
        cap.release()
        return frames
    except Exception as e:
        logger.error(f"Frame extraction error: {e}")
        return []


def create_blurred_image(image_path: str, blur_zones: list) -> Image.Image:
    """Apply blur to specified zones in an image"""
    img = Image.open(image_path).convert('RGB')
    img_width, img_height = img.size
    
    for zone in blur_zones:
        # Convert percentages to pixels
        x = int((zone['x'] / 100) * img_width)
        y = int((zone['y'] / 100) * img_height)
        w = int((zone['width'] / 100) * img_width)
        h = int((zone['height'] / 100) * img_height)
        
        # Ensure valid bounds
        x = max(0, x)
        y = max(0, y)
        w = min(w, img_width - x)
        h = min(h, img_height - y)
        
        if w > 0 and h > 0:
            # Extract region and apply blur
            region = img.crop((x, y, x + w, y + h))
            blurred = region.filter(ImageFilter.GaussianBlur(radius=15))
            img.paste(blurred, (x, y))
    
    return img


def create_branded_preview(image_path: str, blur_zones: list, size: tuple, add_branding: bool = True) -> Image.Image:
    """Create a branded preview with blur applied"""
    # Load and process image
    img = Image.open(image_path).convert('RGB')
    
    # Apply blur zones
    img_width, img_height = img.size
    for zone in blur_zones:
        x = int((zone['x'] / 100) * img_width)
        y = int((zone['y'] / 100) * img_height)
        w = int((zone['width'] / 100) * img_width)
        h = int((zone['height'] / 100) * img_height)
        
        x = max(0, x)
        y = max(0, y)
        w = min(w, img_width - x)
        h = min(h, img_height - y)
        
        if w > 0 and h > 0:
            region = img.crop((x, y, x + w, y + h))
            blurred = region.filter(ImageFilter.GaussianBlur(radius=15))
            img.paste(blurred, (x, y))
    
    # Resize to target size while maintaining aspect ratio
    target_width, target_height = size
    img_ratio = img_width / img_height
    target_ratio = target_width / target_height
    
    if img_ratio > target_ratio:
        # Image is wider - fit to width
        new_width = target_width
        new_height = int(target_width / img_ratio)
    else:
        # Image is taller - fit to height
        new_height = target_height
        new_width = int(target_height * img_ratio)
    
    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Create canvas with Quick Wing brand color
    canvas = Image.new('RGB', (target_width, target_height), (248, 250, 252))  # Light gray-blue
    
    # Center the image
    x_offset = (target_width - new_width) // 2
    y_offset = (target_height - new_height) // 2
    canvas.paste(img, (x_offset, y_offset))
    
    if add_branding:
        draw = ImageDraw.Draw(canvas)
        
        # Add subtle branding bar at bottom
        bar_height = 60
        bar_y = target_height - bar_height
        draw.rectangle([(0, bar_y), (target_width, target_height)], fill=(30, 58, 95))  # Quick Wing navy
        
        # Add brand text
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
        except:
            font = ImageFont.load_default()
        
        draw.text((20, bar_y + 20), "Quick Wing Fleet Management", fill=(255, 255, 255), font=font)
    
    return canvas


def generate_captions(post_type: str, content_focus: str = None) -> list:
    """Generate 3 caption options based on post type and content focus"""
    
    # Caption templates based on content focus
    caption_templates = {
        'booking_simplicity': [
            {
                'hook': "Booking a fleet vehicle shouldn't take 10 minutes.",
                'body': "Quick Wing lets your team book in seconds. One calendar. Zero confusion.",
                'cta': "See how simple fleet booking can be.",
                'hashtags': "#FleetManagement #BookingSoftware #OperationalEfficiency #QuickWing"
            },
            {
                'hook': "Your team needs a car. They need it now.",
                'body': "Quick Wing shows availability instantly. No calls. No spreadsheets. Just book.",
                'cta': "Simplify your fleet bookings today.",
                'hashtags': "#FleetBooking #BusinessEfficiency #FleetSoftware #QuickWing"
            },
            {
                'hook': "Still using a whiteboard for fleet bookings?",
                'body': "There's a better way. Real-time availability. Instant confirmation. Complete history.",
                'cta': "Upgrade your booking process.",
                'hashtags': "#FleetManagement #DigitalTransformation #BusinessTools #QuickWing"
            }
        ],
        'calendar_visibility': [
            {
                'hook': "Know exactly where every vehicle is. Every hour.",
                'body': "Quick Wing's calendar view gives you complete fleet visibility at a glance.",
                'cta': "Take control of your fleet schedule.",
                'hashtags': "#FleetVisibility #VehicleManagement #BusinessCalendar #QuickWing"
            },
            {
                'hook': "Fleet chaos ends with one calendar.",
                'body': "See all bookings. All vehicles. All in one place. That's Quick Wing.",
                'cta': "Discover organized fleet management.",
                'hashtags': "#FleetOrganization #BusinessSoftware #CalendarManagement #QuickWing"
            },
            {
                'hook': "Your fleet schedule, finally visible.",
                'body': "Daily, weekly, monthly views. Filter by vehicle or location. Always know what's available.",
                'cta': "See your fleet clearly.",
                'hashtags': "#FleetScheduling #BusinessClarity #OperationsManagement #QuickWing"
            }
        ],
        'compliance_tracking': [
            {
                'hook': "NCT expiring? Tax due? You'll know first.",
                'body': "Quick Wing tracks every compliance deadline. Automatic alerts. Zero surprises.",
                'cta': "Stay compliant without the stress.",
                'hashtags': "#FleetCompliance #VehicleMaintenance #BusinessCompliance #QuickWing"
            },
            {
                'hook': "Missing a compliance deadline costs more than software.",
                'body': "Track tax, NCT, services, and insurance in one place. Get alerts before it's urgent.",
                'cta': "Never miss another deadline.",
                'hashtags': "#ComplianceTracking #FleetSafety #RiskManagement #QuickWing"
            },
            {
                'hook': "Compliance shouldn't keep you up at night.",
                'body': "Automatic tracking. Timely reminders. Complete documentation. That's peace of mind.",
                'cta': "Manage compliance effortlessly.",
                'hashtags': "#FleetCompliance #BusinessAutomation #SafetyFirst #QuickWing"
            }
        ],
        'admin_efficiency': [
            {
                'hook': "Your admin team has better things to do.",
                'body': "Quick Wing automates the repetitive tasks. Your team handles what matters.",
                'cta': "Free up your admin time.",
                'hashtags': "#AdminEfficiency #WorkflowAutomation #BusinessProductivity #QuickWing"
            },
            {
                'hook': "How much time does your admin spend on fleet queries?",
                'body': "Self-service bookings. Instant availability. Automatic confirmations. Problem solved.",
                'cta': "Reduce admin overhead today.",
                'hashtags': "#TimeManagement #BusinessEfficiency #FleetAdmin #QuickWing"
            },
            {
                'hook': "Less admin. More productivity.",
                'body': "When staff can book their own vehicles, your admin team can focus on growth.",
                'cta': "Streamline your operations.",
                'hashtags': "#OperationalEfficiency #AdminTools #BusinessGrowth #QuickWing"
            }
        ],
        'time_saving': [
            {
                'hook': "Stop wasting time on fleet coordination.",
                'body': "Quick Wing handles bookings, availability, and confirmations automatically.",
                'cta': "Reclaim hours every week.",
                'hashtags': "#TimeSaving #BusinessAutomation #FleetEfficiency #QuickWing"
            },
            {
                'hook': "30 minutes saved per booking adds up fast.",
                'body': "Instant availability checks. One-click booking. No back-and-forth.",
                'cta': "Start saving time now.",
                'hashtags': "#ProductivityTools #BusinessTime #FleetManagement #QuickWing"
            },
            {
                'hook': "Time is money. Stop spending it on fleet admin.",
                'body': "Quick Wing automates the busywork so you can focus on what drives revenue.",
                'cta': "Invest your time wisely.",
                'hashtags': "#BusinessProductivity #Automation #FleetSoftware #QuickWing"
            }
        ],
        'reducing_chaos': [
            {
                'hook': "Fleet management shouldn't feel like chaos.",
                'body': "One system. Clear visibility. Complete control. That's Quick Wing.",
                'cta': "Bring order to your fleet.",
                'hashtags': "#FleetControl #BusinessOrganization #OperationalClarity #QuickWing"
            },
            {
                'hook': "Double bookings. Missing vehicles. Endless calls.",
                'body': "Quick Wing eliminates the confusion with real-time tracking and clear schedules.",
                'cta': "End the fleet chaos.",
                'hashtags': "#FleetOrganization #BusinessSolutions #DoubleBooking #QuickWing"
            },
            {
                'hook': "Your fleet deserves better than spreadsheets.",
                'body': "Purpose-built software. Real-time updates. No more guesswork.",
                'cta': "Upgrade from chaos to clarity.",
                'hashtags': "#FleetManagement #NoMoreSpreadsheets #BusinessTools #QuickWing"
            }
        ],
        'operational_clarity': [
            {
                'hook': "See everything. Know everything. Control everything.",
                'body': "Quick Wing gives you complete operational visibility across your entire fleet.",
                'cta': "Gain operational clarity today.",
                'hashtags': "#OperationalVisibility #FleetControl #BusinessInsights #QuickWing"
            },
            {
                'hook': "Decisions are easier when you can see clearly.",
                'body': "Real-time fleet status. Usage reports. Booking analytics. All in one dashboard.",
                'cta': "Make informed decisions.",
                'hashtags': "#DataDrivenDecisions #FleetAnalytics #BusinessClarity #QuickWing"
            },
            {
                'hook': "Clarity isn't a luxury. It's a necessity.",
                'body': "Know which vehicles are available, booked, or need attention. Always.",
                'cta': "Get the clarity you need.",
                'hashtags': "#OperationalExcellence #FleetVisibility #BusinessManagement #QuickWing"
            }
        ]
    }
    
    # Default to operational_clarity if focus not specified or not found
    focus_key = content_focus or 'operational_clarity'
    if focus_key not in caption_templates:
        focus_key = 'operational_clarity'
    
    return caption_templates[focus_key]


@api_router.post("/content-worker/extract-frames")
async def extract_frames_from_video(
    asset_id: str,
    num_frames: int = 3,
    context: TenantContext = Depends(require_super_admin)
):
    """Extract key frames from a video asset"""
    asset = await db.content_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    if asset.get("file_type") != "video":
        raise HTTPException(status_code=400, detail="Asset is not a video")
    
    # Get the video file path
    file_url = asset.get("original_file_url", "")
    filename = file_url.split("/")[-1]
    video_path = ROOT_DIR / "uploads" / "content" / filename
    
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    
    frames = extract_video_frames(str(video_path), min(num_frames, 5))
    
    if not frames:
        raise HTTPException(status_code=500, detail="Failed to extract frames")
    
    return {"frames": frames, "total": len(frames)}


@api_router.get("/content-worker/files/frames/{filename}")
async def get_frame_file(filename: str):
    """Serve extracted frame files"""
    filepath = ROOT_DIR / "uploads" / "content" / "frames" / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Frame not found")
    return FileResponse(filepath)


@api_router.post("/content-worker/detect-privacy")
async def detect_privacy_in_image(
    asset_id: str = None,
    frame_filename: str = None,
    context: TenantContext = Depends(require_super_admin)
):
    """Detect potentially sensitive information in an image or frame"""
    
    if frame_filename:
        image_path = ROOT_DIR / "uploads" / "content" / "frames" / frame_filename
    elif asset_id:
        asset = await db.content_assets.find_one({"id": asset_id}, {"_id": 0})
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        file_url = asset.get("original_file_url", "")
        filename = file_url.split("/")[-1]
        image_path = ROOT_DIR / "uploads" / "content" / filename
    else:
        raise HTTPException(status_code=400, detail="Provide asset_id or frame_filename")
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    
    detected = detect_privacy_issues(str(image_path))
    
    return {
        "detected_items": detected,
        "total": len(detected),
        "message": f"Found {len(detected)} potential privacy issues"
    }


@api_router.post("/content-worker/generate-preview")
async def generate_post_preview(
    asset_id: str,
    blur_zones: list = [],
    preview_size: str = "square",
    context: TenantContext = Depends(require_super_admin)
):
    """Generate a branded preview with blur applied"""
    asset = await db.content_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    file_url = asset.get("original_file_url", "")
    filename = file_url.split("/")[-1]
    image_path = ROOT_DIR / "uploads" / "content" / filename
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    
    # Determine size
    sizes = {
        "square": (1080, 1080),
        "portrait": (1080, 1350)
    }
    size = sizes.get(preview_size, (1080, 1080))
    
    # Generate preview
    preview = create_branded_preview(str(image_path), blur_zones, size)
    
    # Save preview
    preview_dir = ROOT_DIR / "uploads" / "content" / "previews"
    preview_dir.mkdir(parents=True, exist_ok=True)
    
    preview_filename = f"preview_{asset_id}_{preview_size}_{uuid.uuid4().hex[:8]}.jpg"
    preview_path = preview_dir / preview_filename
    preview.save(str(preview_path), "JPEG", quality=90)
    
    base_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    preview_url = f"{base_url}/api/content-worker/files/previews/{preview_filename}"
    
    return {
        "preview_url": preview_url,
        "size": preview_size,
        "dimensions": size
    }


@api_router.get("/content-worker/files/previews/{filename}")
async def get_preview_file(filename: str):
    """Serve preview files"""
    filepath = ROOT_DIR / "uploads" / "content" / "previews" / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Preview not found")
    return FileResponse(filepath)


@api_router.post("/content-worker/generate-captions")
async def generate_caption_options(
    post_type: str = "product_demo",
    content_focus: str = "operational_clarity",
    context: TenantContext = Depends(require_super_admin)
):
    """Generate 3 caption options for a post"""
    captions = generate_captions(post_type, content_focus)
    return {"captions": captions, "content_focus": content_focus}


class DraftWithWorkflowCreate(BaseModel):
    """Create a draft with full workflow data"""
    asset_id: str
    post_title: str
    post_type: str
    format_type: str
    content_focus: Optional[str] = "operational_clarity"
    blur_zones: Optional[list] = []
    generated_captions: Optional[list] = []
    selected_caption_index: Optional[int] = None
    preview_url_square: Optional[str] = None
    preview_url_portrait: Optional[str] = None
    privacy_reviewed: bool = False
    hook: Optional[str] = None
    cta: Optional[str] = None
    hashtags: Optional[str] = None
    notes: Optional[str] = None


@api_router.post("/content-worker/drafts/create-with-workflow")
async def create_draft_with_workflow(
    draft_data: DraftWithWorkflowCreate,
    context: TenantContext = Depends(require_super_admin)
):
    """Create a draft with all workflow data (privacy zones, captions, previews)"""
    
    # Verify asset exists
    asset = await db.content_assets.find_one({"id": draft_data.asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    draft_id = str(uuid.uuid4())
    
    # Build selected caption from generated options
    selected_caption = None
    if draft_data.generated_captions and draft_data.selected_caption_index is not None:
        if 0 <= draft_data.selected_caption_index < len(draft_data.generated_captions):
            cap = draft_data.generated_captions[draft_data.selected_caption_index]
            selected_caption = f"{cap.get('hook', '')}\n\n{cap.get('body', '')}\n\n{cap.get('cta', '')}\n\n{cap.get('hashtags', '')}"
    
    draft_doc = {
        "id": draft_id,
        "asset_id": draft_data.asset_id,
        "post_title": draft_data.post_title,
        "post_type": draft_data.post_type,
        "format_type": draft_data.format_type,
        "content_focus": draft_data.content_focus,
        "generated_captions": draft_data.generated_captions,
        "selected_caption_index": draft_data.selected_caption_index,
        "caption_option_1": draft_data.generated_captions[0] if len(draft_data.generated_captions) > 0 else None,
        "caption_option_2": draft_data.generated_captions[1] if len(draft_data.generated_captions) > 1 else None,
        "caption_option_3": draft_data.generated_captions[2] if len(draft_data.generated_captions) > 2 else None,
        "selected_caption": selected_caption,
        "hook": draft_data.hook or (draft_data.generated_captions[0].get('hook') if draft_data.generated_captions else None),
        "cta": draft_data.cta or (draft_data.generated_captions[0].get('cta') if draft_data.generated_captions else None),
        "hashtags": draft_data.hashtags or (draft_data.generated_captions[0].get('hashtags') if draft_data.generated_captions else None),
        "preview_url_square": draft_data.preview_url_square,
        "preview_url_portrait": draft_data.preview_url_portrait,
        "privacy_reviewed": draft_data.privacy_reviewed,
        "status": "draft",
        "approved_by": None,
        "notes": draft_data.notes,
        "created_by": context.user_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_drafts.insert_one(draft_doc)
    
    # Save blur zones as privacy flags
    for zone in draft_data.blur_zones:
        flag_doc = {
            "id": str(uuid.uuid4()),
            "asset_id": draft_data.asset_id,
            "draft_id": draft_id,
            "flag_type": zone.get('type', 'manual'),
            "detected_text": zone.get('text'),
            "x_position": zone.get('x', 0),
            "y_position": zone.get('y', 0),
            "width": zone.get('width', 10),
            "height": zone.get('height', 10),
            "blur_applied": True,
            "manually_adjusted": zone.get('manually_adjusted', False),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.privacy_flags.insert_one(flag_doc)
    
    # Update asset with processed preview URL
    if draft_data.preview_url_square:
        await db.content_assets.update_one(
            {"id": draft_data.asset_id},
            {"$set": {"processed_file_url": draft_data.preview_url_square}}
        )
    
    return {
        "message": "Draft created with workflow data",
        "draft": {k: v for k, v in draft_doc.items() if k != "_id"}
    }


@api_router.put("/content-worker/drafts/{draft_id}/review-action")
async def draft_review_action(
    draft_id: str,
    action: str,  # approve, reject, send_back
    notes: Optional[str] = None,
    selected_caption_index: Optional[int] = None,
    context: TenantContext = Depends(require_super_admin)
):
    """Perform review action on a draft"""
    draft = await db.content_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if action == "approve":
        update_data["status"] = "approved"
        update_data["approved_by"] = context.user_email
    elif action == "reject":
        update_data["status"] = "rejected"
    elif action == "send_back":
        update_data["status"] = "draft"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    if notes:
        update_data["review_notes"] = notes
    
    if selected_caption_index is not None:
        update_data["selected_caption_index"] = selected_caption_index
        # Update selected caption text
        captions = draft.get("generated_captions", [])
        if 0 <= selected_caption_index < len(captions):
            cap = captions[selected_caption_index]
            update_data["selected_caption"] = f"{cap.get('hook', '')}\n\n{cap.get('body', '')}\n\n{cap.get('cta', '')}\n\n{cap.get('hashtags', '')}"
    
    await db.content_drafts.update_one({"id": draft_id}, {"$set": update_data})
    
    return {"message": f"Draft {action} successful", "status": update_data.get("status")}


@api_router.put("/content-worker/drafts/{draft_id}/update-caption")
async def update_draft_caption(
    draft_id: str,
    caption_index: int,
    hook: Optional[str] = None,
    body: Optional[str] = None,
    cta: Optional[str] = None,
    hashtags: Optional[str] = None,
    context: TenantContext = Depends(require_super_admin)
):
    """Update a specific caption option in a draft"""
    draft = await db.content_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    captions = draft.get("generated_captions", [])
    if caption_index < 0 or caption_index >= len(captions):
        raise HTTPException(status_code=400, detail="Invalid caption index")
    
    if hook is not None:
        captions[caption_index]['hook'] = hook
    if body is not None:
        captions[caption_index]['body'] = body
    if cta is not None:
        captions[caption_index]['cta'] = cta
    if hashtags is not None:
        captions[caption_index]['hashtags'] = hashtags
    
    await db.content_drafts.update_one(
        {"id": draft_id},
        {"$set": {
            "generated_captions": captions,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Caption updated", "caption": captions[caption_index]}


@api_router.get("/content-worker/drafts/{draft_id}/full")
async def get_draft_with_full_details(
    draft_id: str,
    context: TenantContext = Depends(require_super_admin)
):
    """Get a draft with all associated data (asset, privacy flags, etc.)"""
    draft = await db.content_drafts.find_one({"id": draft_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Get associated asset
    asset = await db.content_assets.find_one({"id": draft.get("asset_id")}, {"_id": 0})
    draft["asset"] = asset
    
    # Get privacy flags for this draft
    flags = await db.privacy_flags.find(
        {"$or": [{"draft_id": draft_id}, {"asset_id": draft.get("asset_id")}]},
        {"_id": 0}
    ).to_list(100)
    draft["privacy_flags"] = flags
    
    # Convert flags to blur zones format for frontend
    draft["blur_zones"] = [
        {
            "id": f["id"],
            "type": f.get("flag_type", "manual"),
            "text": f.get("detected_text"),
            "x": f.get("x_position", 0),
            "y": f.get("y_position", 0),
            "width": f.get("width", 10),
            "height": f.get("height", 10),
            "manually_adjusted": f.get("manually_adjusted", False)
        }
        for f in flags
    ]
    
    return draft


# Include router - MUST be after all routes are defined
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown():
    client.close()
