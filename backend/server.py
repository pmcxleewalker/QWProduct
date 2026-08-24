"""
Quick Wing Fleet Management - Multi-Tenant SaaS Platform
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, Request, UploadFile, File, Response
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Any, Dict
from datetime import timedelta, datetime, timezone
import uuid
import secrets
import asyncio
import qrcode
from io import BytesIO
import json
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
    VehicleCreate, VehicleUpdate, Vehicle, DropOffLocation, GeofenceUpdate,
    TrackerDeviceCreate, TrackerDeviceUpdate,
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
from services.email_service import send_staff_invitation_email, send_owner_welcome_email
from services.cache import (
    cache as ttl_cache,
    tenant_settings_key,
    vehicles_key,
    locations_key,
    tenant_prefix,
)
from services.documents import (
    TemplateCreate as DocTemplateCreate,
    TemplateUpdate as DocTemplateUpdate,
    SubmissionCreate as DocSubmissionCreate,
    SubmissionUpdate as DocSubmissionUpdate,
    build_template_doc, merge_template_update, build_submission_doc,
    BUILTIN_TEMPLATES,
)
from backup_service import BackupService, serialize_backup

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


# ==================== PUBLIC URL HELPER ====================
# Quick Wing's stable customer-facing domain.
# DO NOT use FRONTEND_URL here — Emergent's deployment platform may auto-populate
# FRONTEND_URL with the deployment's default domain (e.g. *.emergent.host),
# but franchise login URLs and QR codes must always point to the branded domain.
def get_public_url() -> str:
    """Return the public customer-facing URL for tenant login links and QR codes."""
    return os.environ.get('QUICK_WING_PUBLIC_URL') or 'https://quick-wing.com'


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
    
    # Demo users have no password — magic link is the only entry point.
    # Reject BEFORE calling verify_password so bcrypt doesn't crash on the
    # sentinel hash.
    if user and user.get("is_demo"):
        raise HTTPException(
            status_code=401,
            detail="This account is demo-only. Please use the magic link you were sent."
        )

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

    # Stamp last_login_at so admins can see who's actually logged in.
    # Fire-and-forget — never block the login flow on this update.
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_login_at": now_iso}},
        )
    except Exception:
        pass
    
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


# ==================== USER PROFILE (self-service) ====================

class ProfileUpdateRequest(BaseModel):
    """Fields a user can edit on their own profile.
    Currently only the driver's licence expiry — we may extend this later
    (e.g. phone number, emergency contact). Keep it minimal so we don't
    accidentally expose internal flags like is_active or require_password_change.
    """
    driver_licence_expiry: Optional[str] = None  # YYYY-MM-DD or "" to clear
    driver_licence_number: Optional[str] = None  # free-form, optional
    display_name: Optional[str] = None  # short nickname used in greetings ("K")


def _validate_iso_date_or_none(value: Optional[str]) -> Optional[str]:
    """Accept '' / None to clear the field. Otherwise require YYYY-MM-DD."""
    if value is None or value == "":
        return None
    try:
        # datetime.fromisoformat handles YYYY-MM-DD just fine
        datetime.fromisoformat(value)
        return value
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format: {value!r}. Expected YYYY-MM-DD.",
        )


@api_router.patch("/users/me/profile")
async def update_my_profile(
    payload: ProfileUpdateRequest,
    context: TenantContext = Depends(get_tenant_context),
    request: Request = None,
):
    """Let any logged-in user update their own profile fields.
    Staff use this to record their driver's licence expiry so admins can
    surface a 30-day renewal reminder."""
    update_fields: dict = {}

    # Driver's licence expiry: allow set + clear
    if payload.driver_licence_expiry is not None:
        update_fields["driver_licence_expiry"] = _validate_iso_date_or_none(
            payload.driver_licence_expiry
        )
    if payload.driver_licence_number is not None:
        # Empty string clears it
        update_fields["driver_licence_number"] = (
            payload.driver_licence_number.strip() or None
        )
    if payload.display_name is not None:
        # Short nickname used in greetings — None / empty clears it.
        trimmed = payload.display_name.strip()
        if len(trimmed) > 30:
            raise HTTPException(status_code=400, detail="Display name must be 30 characters or fewer")
        update_fields["display_name"] = trimmed or None

    if not update_fields:
        raise HTTPException(status_code=400, detail="No profile fields supplied")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"id": context.user_id},
        {"$set": update_fields},
    )

    # Light-touch audit log — useful for licence-expiry disputes later
    try:
        await audit_service.log(
            actor_user_id=context.user_id,
            actor_email=context.user_email,
            action=AuditAction.USER_UPDATED,
            tenant_id=context.tenant_id,
            resource_type="user_profile",
            resource_id=context.user_id,
            meta={"fields": list(update_fields.keys())},
            ip_address=request.client.host if request and request.client else None,
        )
    except Exception:
        pass

    updated = await db.users.find_one(
        {"id": context.user_id},
        {"_id": 0, "password_hash": 0},
    )
    return {"message": "Profile updated", "user": updated}


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
        "id": str(uuid.uuid4()),
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
        "id": str(uuid.uuid4()),
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
    Used for branded login pages — exposes the tenant's logo so the
    login screen can show the client's own brand BEFORE the user has
    authenticated. Only safe-to-publish fields are returned; nothing
    sensitive is leaked.
    """
    tenant = await db.tenants.find_one(
        {"slug": slug},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "status": 1, "settings": 1},
    )

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.get("settings") or {}
    return {
        "id": tenant.get("id"),
        "name": tenant.get("name"),
        "slug": tenant.get("slug"),
        "status": tenant.get("status"),
        "logo_url": settings.get("logo_url") or None,
        "primary_color": settings.get("primary_color") or None,
    }


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
    # Monthly price: custom price overrides plan default
    monthly_price = (
        tenant_data.custom_price
        if tenant_data.custom_price is not None
        else float(plan_config.get("price", 0))
    )
    tenant = {
        "id": tenant_id,
        "name": tenant_data.name,
        "slug": tenant_data.slug,
        "status": TenantStatus.ACTIVE.value,
        "plan": tenant_data.plan.value,
        "max_vehicles": max_vehicles,
        "max_users": max_users,
        "monthly_price": monthly_price,
        "customizations_remaining": customizations,
        "customizations_reset_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "feature_overrides": tenant_data.feature_overrides or {},
        "subscription_expires_at": None,
        "is_demo": bool(tenant_data.is_demo),
        "gps_enabled": bool(getattr(tenant_data, "gps_enabled", False)),
        "gps_settings": dict(GPS_DEFAULTS) if getattr(tenant_data, "gps_enabled", False) else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tenants.insert_one(tenant)
    
    # Remove MongoDB's _id before returning
    tenant.pop('_id', None)

    # ---- Demo branch: no password master admin, no email creds, magic link only ----
    if tenant_data.is_demo:
        demo_email = f"demo+{tenant_data.slug}@quickwing.com"
        demo_name = f"{tenant_data.name} Demo Viewer"
        demo_user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": demo_user_id,
            "email": demo_email,
            "name": demo_name,
            "password_hash": "!DEMO_MAGIC_LINK_ONLY!",  # not a valid bcrypt — password login blocked
            "role": UserRole.MASTER_ADMIN.value,
            "tenant_id": tenant_id,
            "is_active": True,
            "is_demo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.memberships.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": demo_user_id,
            "tenant_id": tenant_id,
            "role": UserRole.MASTER_ADMIN.value,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Mint the magic link (bound to THIS tenant, not shared)
        token_row = await _mint_demo_token_for_tenant(
            tenant=tenant,
            expires_in_days=int(getattr(tenant_data, "demo_link_expires_in_days", 30) or 30),
            created_by_user_id=context.user_id,
            created_by_email=context.user_email,
            prospect_name=tenant_data.name,
            prospect_email="",
        )
        return {
            "tenant": tenant,
            "is_demo": True,
            "master_admin": None,        # no admin credentials at all
            "magic_link": _demo_token_public(token_row, base_url=_base_url_from_request(request)),
        }
    # ------------------------------------------------------------------------------

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
    
    # AUTO-ADD SUPPORT ADMIN — disabled May 2026 at customer request. The
    # support@quickwing.com cross-tenant account was being shown in franchise
    # team lists and confused master admins. Re-enable the block below if
    # Quick Wing ever needs an off-site support backdoor again.
    #
    # support_admin = await db.users.find_one({"email": SUPPORT_ADMIN_EMAIL}, {"_id": 0})
    # if not support_admin:
    #     support_user_id = str(uuid.uuid4())
    #     await db.users.insert_one({
    #         "id": support_user_id,
    #         "email": SUPPORT_ADMIN_EMAIL,
    #         "name": SUPPORT_ADMIN_NAME,
    #         "password_hash": get_password_hash(SUPPORT_ADMIN_PASSWORD),
    #         "is_active": True,
    #         "require_password_change": False,
    #         "created_at": datetime.now(timezone.utc).isoformat(),
    #     })
    # else:
    #     support_user_id = support_admin["id"]
    #
    # existing_support_membership = await db.memberships.find_one({
    #     "user_id": support_user_id,
    #     "tenant_id": tenant_id,
    # })
    # if not existing_support_membership:
    #     await db.memberships.insert_one({
    #         "id": str(uuid.uuid4()),
    #         "user_id": support_user_id,
    #         "tenant_id": tenant_id,
    #         "role": UserRole.MASTER_ADMIN.value,
    #         "created_at": datetime.now(timezone.utc).isoformat(),
    #     })
    
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
    # Format: {QUICK_WING_PUBLIC_URL}/{tenant_slug}/login
    # Uses get_public_url() (not FRONTEND_URL) to ensure tenant URLs always point
    # to the branded customer domain, not the Emergent deployment hostname.
    base_url = get_public_url()
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
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None,
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

        # For demo tenants, attach the currently-active magic link so the
        # Clients list can render a copyable URL instead of a password box.
        if tenant.get("is_demo"):
            active_link = await db.demo_tokens.find_one(
                {"tenant_id": tenant["id"], "revoked_at": None},
                {"_id": 0},
                sort=[("created_at", -1)],
            )
            tenant["magic_link"] = _demo_token_public(active_link, base_url=_base_url_from_request(request)) if active_link else None
    
    return {"tenants": tenants, "total": total}


@api_router.post("/platform/tenants/{tenant_id}/magic-link")
async def regenerate_tenant_magic_link(
    tenant_id: str,
    payload: Optional[dict] = None,
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None,
):
    """Regenerate the magic link for a demo tenant. Revokes any previously
    active links so the old URL stops working. Refuses on non-demo tenants."""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not tenant.get("is_demo"):
        raise HTTPException(status_code=400, detail="This is not a demo tenant")

    # Revoke previously active links for this tenant
    await db.demo_tokens.update_many(
        {"tenant_id": tenant_id, "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
    )

    expires_in_days = 30
    if isinstance(payload, dict) and payload.get("expires_in_days"):
        try:
            expires_in_days = int(payload["expires_in_days"])
        except (TypeError, ValueError):
            pass

    row = await _mint_demo_token_for_tenant(
        tenant=tenant,
        expires_in_days=expires_in_days,
        created_by_user_id=context.user_id,
        created_by_email=context.user_email,
        prospect_name=tenant.get("name", ""),
        prospect_email="",
    )
    return _demo_token_public(row, base_url=_base_url_from_request(request))


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


class ComplianceSettingsUpdate(BaseModel):
    """Update compliance reminder settings"""
    tax_warning_days: Optional[int] = None  # Days before tax due to alert (default 60)
    nct_warning_days: Optional[int] = None  # Days before NCT due to alert (default 60)
    insurance_warning_days: Optional[int] = None  # Days before insurance renewal to alert (default 60)
    service_warning_km: Optional[int] = None  # KM before service due to alert (default 10)
    enable_tax_alerts: Optional[bool] = None
    enable_nct_alerts: Optional[bool] = None
    enable_insurance_alerts: Optional[bool] = None
    enable_service_alerts: Optional[bool] = None


@api_router.get("/tenant/settings")
async def get_tenant_settings(context: TenantContext = Depends(require_tenant_context)):
    """Get tenant settings including branding and analytics configuration.

    Cached for 30s per tenant — invalidated by any mutation that touches the
    tenant document (settings PUT, compliance settings PUT, logo upload, plan
    overrides, etc.).
    """
    cached = await ttl_cache.get(tenant_settings_key(context.tenant_id))
    if cached is not None:
        return cached

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
    compliance_settings = settings.get("compliance", {})
    response = {
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
        },
        "compliance": {
            "tax_warning_days": compliance_settings.get("tax_warning_days", 60),
            "nct_warning_days": compliance_settings.get("nct_warning_days", 60),
            "insurance_warning_days": compliance_settings.get("insurance_warning_days", 60),
            "service_warning_km": compliance_settings.get("service_warning_km", 10),
            "enable_tax_alerts": compliance_settings.get("enable_tax_alerts", True),
            "enable_nct_alerts": compliance_settings.get("enable_nct_alerts", True),
            "enable_insurance_alerts": compliance_settings.get("enable_insurance_alerts", True),
            "enable_service_alerts": compliance_settings.get("enable_service_alerts", True)
        },
        # GPS Fleet Tracking (SinoTrack bridge). Frontend uses `enabled` to
        # gate the Live Map tab and all tracker UI. Phase 1 = toggle only;
        # the actual poller lands in Phase 2.
        "gps": {
            "enabled": bool(tenant.get("gps_enabled", False)),
            "speed_limit_kmh": (tenant.get("gps_settings") or {}).get("speed_limit_kmh", 120),
            "poll_interval_seconds": (tenant.get("gps_settings") or {}).get("poll_interval_seconds", 30),
            "history_retention_days": (tenant.get("gps_settings") or {}).get("history_retention_days", 60),
            "device_password": (tenant.get("gps_settings") or {}).get("device_password", "123456"),
        }
    }
    await ttl_cache.set(tenant_settings_key(context.tenant_id), response, ttl=30)
    return response


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
        await ttl_cache.invalidate(tenant_settings_key(context.tenant_id))
    
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


@api_router.put("/tenant/settings/compliance")
async def update_compliance_settings(
    settings_data: ComplianceSettingsUpdate,
    context: TenantContext = Depends(require_admin)
):
    """Update compliance reminder settings"""
    update_fields = {}
    
    if settings_data.tax_warning_days is not None:
        update_fields["settings.compliance.tax_warning_days"] = settings_data.tax_warning_days
    if settings_data.nct_warning_days is not None:
        update_fields["settings.compliance.nct_warning_days"] = settings_data.nct_warning_days
    if settings_data.insurance_warning_days is not None:
        update_fields["settings.compliance.insurance_warning_days"] = settings_data.insurance_warning_days
    if settings_data.service_warning_km is not None:
        update_fields["settings.compliance.service_warning_km"] = settings_data.service_warning_km
    if settings_data.enable_tax_alerts is not None:
        update_fields["settings.compliance.enable_tax_alerts"] = settings_data.enable_tax_alerts
    if settings_data.enable_nct_alerts is not None:
        update_fields["settings.compliance.enable_nct_alerts"] = settings_data.enable_nct_alerts
    if settings_data.enable_insurance_alerts is not None:
        update_fields["settings.compliance.enable_insurance_alerts"] = settings_data.enable_insurance_alerts
    if settings_data.enable_service_alerts is not None:
        update_fields["settings.compliance.enable_service_alerts"] = settings_data.enable_service_alerts
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.tenants.update_one({"id": context.tenant_id}, {"$set": update_fields})
        await ttl_cache.invalidate(tenant_settings_key(context.tenant_id))
    
    # Return updated compliance settings
    updated_tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    compliance_settings = updated_tenant.get("settings", {}).get("compliance", {})
    
    return {
        "message": "Compliance settings updated successfully",
        "compliance": {
            "tax_warning_days": compliance_settings.get("tax_warning_days", 60),
            "nct_warning_days": compliance_settings.get("nct_warning_days", 60),
            "insurance_warning_days": compliance_settings.get("insurance_warning_days", 60),
            "service_warning_km": compliance_settings.get("service_warning_km", 10),
            "enable_tax_alerts": compliance_settings.get("enable_tax_alerts", True),
            "enable_nct_alerts": compliance_settings.get("enable_nct_alerts", True),
            "enable_insurance_alerts": compliance_settings.get("enable_insurance_alerts", True),
            "enable_service_alerts": compliance_settings.get("enable_service_alerts", True)
        }
    }


# ==================== GPS FLEET TRACKING (Phase 1: settings only) ====================
# The SinoTrack bridge (Phase 2+) writes tracker positions / history into
# tenant-scoped collections. Phase 1 exposes only the on/off toggle + a few
# knobs so tenants can be onboarded ahead of the poller landing.

class GpsSettingsUpdate(BaseModel):
    """Payload for PUT /api/tenant/settings/gps. All fields optional so the
    caller can flip just the toggle or just the speed limit."""
    enabled: Optional[bool] = None
    speed_limit_kmh: Optional[int] = None       # default 120
    poll_interval_seconds: Optional[int] = None # default 30
    history_retention_days: Optional[int] = None # default 60
    device_password: Optional[str] = None       # default "123456"


GPS_DEFAULTS = {
    "speed_limit_kmh": 120,
    "poll_interval_seconds": 30,
    "history_retention_days": 60,
    "device_password": "123456",
}


def _gps_response(tenant: dict) -> dict:
    """Shape the GPS block returned by settings endpoints."""
    gs = tenant.get("gps_settings") or {}
    return {
        "enabled": bool(tenant.get("gps_enabled", False)),
        "speed_limit_kmh": gs.get("speed_limit_kmh", GPS_DEFAULTS["speed_limit_kmh"]),
        "poll_interval_seconds": gs.get("poll_interval_seconds", GPS_DEFAULTS["poll_interval_seconds"]),
        "history_retention_days": gs.get("history_retention_days", GPS_DEFAULTS["history_retention_days"]),
        "device_password": gs.get("device_password", GPS_DEFAULTS["device_password"]),
    }


@api_router.put("/tenant/settings/gps")
async def update_gps_settings(
    payload: GpsSettingsUpdate,
    context: TenantContext = Depends(require_admin),
):
    """Toggle GPS Fleet Tracking and configure its per-tenant knobs.
    Admin-only. Enabling initialises `gps_settings` with defaults; disabling
    retains the settings so data isn't lost. The Phase 2 poller loop simply
    skips tenants where gps_enabled is false."""
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_fields = {}
    if payload.enabled is not None:
        update_fields["gps_enabled"] = bool(payload.enabled)
        # First-time enable: seed defaults if none stored yet
        if payload.enabled and not tenant.get("gps_settings"):
            update_fields["gps_settings"] = dict(GPS_DEFAULTS)

    # Merge any overrides into gps_settings
    current_settings = dict(tenant.get("gps_settings") or GPS_DEFAULTS)
    merged = dict(current_settings)
    changed = False
    if payload.speed_limit_kmh is not None:
        merged["speed_limit_kmh"] = max(30, min(300, int(payload.speed_limit_kmh)))
        changed = True
    if payload.poll_interval_seconds is not None:
        merged["poll_interval_seconds"] = max(10, min(600, int(payload.poll_interval_seconds)))
        changed = True
    if payload.history_retention_days is not None:
        merged["history_retention_days"] = max(7, min(730, int(payload.history_retention_days)))
        changed = True
    if payload.device_password is not None:
        merged["device_password"] = str(payload.device_password).strip() or GPS_DEFAULTS["device_password"]
        changed = True
    if changed:
        update_fields["gps_settings"] = merged

    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.tenants.update_one({"id": context.tenant_id}, {"$set": update_fields})
        await ttl_cache.invalidate(tenant_settings_key(context.tenant_id))

    updated_tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    return {
        "message": "GPS settings updated successfully",
        "gps": _gps_response(updated_tenant),
    }


# ---------- Tracker Devices (Phase 2) ----------

@api_router.post("/tracker/devices")
async def register_tracker_device(
    payload: TrackerDeviceCreate,
    context: TenantContext = Depends(require_admin),
):
    """Register a SinoTrack tracker under the current tenant. Verifies the
    IMEI + password against SinoTrack's cloud before saving so admins get
    immediate feedback if the credentials are wrong."""
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    if not tenant or not tenant.get("gps_enabled"):
        raise HTTPException(status_code=400, detail="Enable GPS Fleet Tracking first")

    imei = (payload.imei or "").strip()
    # Demo IMEIs are alphanumeric, prefixed DEMO- or SIM-. Real hardware
    # IMEIs are pure digits.
    is_demo_device = imei.upper().startswith("DEMO-") or imei.upper().startswith("SIM-")
    if is_demo_device:
        if not (5 <= len(imei) <= 30):
            raise HTTPException(status_code=400, detail="Demo IMEI must be 5-30 characters (e.g. DEMO-001)")
    else:
        if not imei.isdigit() or not (10 <= len(imei) <= 20):
            raise HTTPException(status_code=400, detail="IMEI must be 10-20 digits")

    existing = await db.tracker_devices.find_one(
        {"tenant_id": context.tenant_id, "imei": imei}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=409, detail="This IMEI is already registered for your tenant")

    # Optional car assignment must belong to this tenant
    car_id = (payload.car_id or "").strip() or None
    if car_id:
        car = await db.vehicles.find_one(
            {"id": car_id, "tenant_id": context.tenant_id}, {"_id": 0}
        )
        if not car:
            raise HTTPException(status_code=404, detail="Vehicle not found for this tenant")
        already = await db.tracker_devices.find_one(
            {"tenant_id": context.tenant_id, "car_id": car_id, "is_active": True},
            {"_id": 0},
        )
        if already:
            raise HTTPException(status_code=409, detail="This vehicle already has an active tracker")

    # Verify with SinoTrack (skipped for demo devices — those use the local
    # simulator instead of hitting the real cloud). Real-device verify is
    # non-fatal so tenants without an internet-connected device can pre-register.
    device_password = (tenant.get("gps_settings") or {}).get("device_password", "123456")
    verified = False
    if not is_demo_device:
        try:
            from services.sinotrack_client import login as _login
            verified = await asyncio.to_thread(_login, imei, device_password)
        except Exception as e:
            logger.warning(f"[tracker] IMEI verify failed: {e}")

    doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        "imei": imei,
        "car_id": car_id,
        "label": (payload.label or "").strip(),
        "sim_number": (payload.sim_number or "").strip(),
        "apn": (payload.apn or "").strip(),
        "is_active": True,
        "is_demo": is_demo_device,
        "verified_with_sinotrack": verified,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tracker_devices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/tracker/devices")
async def list_tracker_devices(
    context: TenantContext = Depends(get_tenant_context),
):
    """List all trackers for the current tenant."""
    rows = await db.tracker_devices.find(
        {"tenant_id": context.tenant_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return rows


@api_router.patch("/tracker/devices/{device_id}")
async def update_tracker_device(
    device_id: str,
    payload: TrackerDeviceUpdate,
    context: TenantContext = Depends(require_admin),
):
    """Assign/reassign a car, edit label/SIM/APN, or deactivate a tracker."""
    row = await db.tracker_devices.find_one(
        {"id": device_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Tracker not found")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.car_id is not None:
        car_id = (payload.car_id or "").strip() or None
        if car_id:
            car = await db.vehicles.find_one(
                {"id": car_id, "tenant_id": context.tenant_id}, {"_id": 0}
            )
            if not car:
                raise HTTPException(status_code=404, detail="Vehicle not found for this tenant")
            conflict = await db.tracker_devices.find_one({
                "tenant_id": context.tenant_id,
                "car_id": car_id,
                "is_active": True,
                "id": {"$ne": device_id},
            })
            if conflict:
                raise HTTPException(status_code=409, detail="Another active tracker is already assigned to this vehicle")
        update["car_id"] = car_id
    for field in ("label", "sim_number", "apn"):
        val = getattr(payload, field)
        if val is not None:
            update[field] = str(val).strip()
    if payload.is_active is not None:
        update["is_active"] = bool(payload.is_active)

    await db.tracker_devices.update_one(
        {"id": device_id, "tenant_id": context.tenant_id},
        {"$set": update},
    )
    updated = await db.tracker_devices.find_one(
        {"id": device_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    return updated


@api_router.delete("/tracker/devices/{device_id}")
async def delete_tracker_device(
    device_id: str,
    context: TenantContext = Depends(require_admin),
):
    """Hard-delete a tracker registration (positions/history retained)."""
    res = await db.tracker_devices.delete_one(
        {"id": device_id, "tenant_id": context.tenant_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tracker not found")
    return {"ok": True}


@api_router.get("/tracker/positions")
async def list_tracker_positions(
    context: TenantContext = Depends(get_tenant_context),
):
    """Latest position per tracker for the current tenant."""
    rows = await db.tracker_positions.find(
        {"tenant_id": context.tenant_id}, {"_id": 0}
    ).to_list(500)
    return rows


@api_router.get("/tracker/car/{car_id}")
async def get_car_tracker_position(
    car_id: str,
    context: TenantContext = Depends(get_tenant_context),
):
    """Latest position for a single car (or 404 if none)."""
    row = await db.tracker_positions.find_one(
        {"tenant_id": context.tenant_id, "car_id": car_id}, {"_id": 0}
    )
    if not row:
        raise HTTPException(status_code=404, detail="No tracker position yet")
    return row


@api_router.get("/tracker/history/{car_id}")
async def get_car_history(
    car_id: str,
    date: str = Query(..., description="YYYY-MM-DD (UTC)"),
    context: TenantContext = Depends(get_tenant_context),
):
    """Journey playback: return grouped trips for a car on a specific day.

    - Trip detection: gap > 3 min between points = new trip
    - Filters out trips where max_speed == 0 (pure stationary noise)
    - Strictly tenant-scoped
    """
    # Ownership check so an admin can't read another tenant's car history
    car = await db.vehicles.find_one(
        {"id": car_id, "tenant_id": context.tenant_id}, {"_id": 0, "id": 1, "name": 1, "registration": 1}
    )
    if not car:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    from services.gps_history_service import get_car_journeys
    trips = await get_car_journeys(db, context.tenant_id, car_id, date)
    return {
        "car_id": car_id,
        "car_name": car.get("name"),
        "registration": car.get("registration"),
        "date": date,
        "trip_count": len(trips),
        "trips": trips,
    }


@api_router.post("/tracker/history/{car_id}/seed-demo")
async def seed_car_demo_history(
    car_id: str,
    days: int = Query(3, ge=1, le=14),
    context: TenantContext = Depends(require_admin),
):
    """Backfill realistic demo trips for a demo-tracked car (idempotent).
    Only works for tenants with GPS enabled and where the car has an
    active `is_demo=True` tracker."""
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0})
    if not tenant or not tenant.get("gps_enabled"):
        raise HTTPException(status_code=400, detail="Enable GPS Fleet Tracking first")

    device = await db.tracker_devices.find_one(
        {
            "tenant_id": context.tenant_id,
            "car_id": car_id,
            "is_active": True,
            "is_demo": True,
        },
        {"_id": 0},
    )
    if not device:
        raise HTTPException(status_code=404, detail="No active demo tracker on this vehicle")

    from services.gps_history_service import seed_demo_journeys
    inserted = await seed_demo_journeys(db, context.tenant_id, device, days=days)
    return {"ok": True, "inserted": inserted, "days": days}


# ==================== TRACKER ALERTS (Phase 5) ====================
# Speeding, unplug, offline, and geofence-exit alerts are written by the
# GPS poller (see services/gps_poller.py). These endpoints let tenant
# admins list them, acknowledge them, and see a live badge count.

class AlertAckPayload(BaseModel):
    """Optional bulk-ack payload: pass `type` to ack every unacknowledged
    alert of a specific type for the current tenant."""
    type: Optional[str] = None  # 'speeding' | 'unplug' | 'offline' | 'geofence_exit'


@api_router.get("/tracker/alerts")
async def list_tracker_alerts(
    acknowledged: bool = Query(False, description="Include acknowledged alerts"),
    limit: int = Query(200, ge=1, le=1000),
    context: TenantContext = Depends(get_tenant_context),
):
    """List tenant alerts, sorted by severity (critical first) then most
    recent. Defaults to only unacknowledged; pass ?acknowledged=true to
    include historical alerts."""
    query = {"tenant_id": context.tenant_id}
    if not acknowledged:
        query["acknowledged"] = False

    rows = await db.tracker_alerts.find(query, {"_id": 0}).sort(
        [("timestamp", -1)]
    ).to_list(limit)

    # Rank by severity (critical > warning > info), preserving newest-first
    # order within each severity group. Python's sort is stable so the
    # timestamp-desc order from Mongo is preserved.
    sev_rank = {"critical": 0, "warning": 1, "info": 2}
    rows.sort(key=lambda a: sev_rank.get(a.get("severity", "warning"), 99))

    # Counts (used by the badge without a second round-trip)
    counts = {"total": len(rows)}
    for a in rows:
        t = a.get("type", "other")
        counts[t] = counts.get(t, 0) + 1

    return {"alerts": rows, "counts": counts}


@api_router.get("/tracker/alerts/count")
async def get_tracker_alerts_count(
    context: TenantContext = Depends(get_tenant_context),
):
    """Cheap count endpoint for the nav badge."""
    total = await db.tracker_alerts.count_documents(
        {"tenant_id": context.tenant_id, "acknowledged": False}
    )
    critical = await db.tracker_alerts.count_documents(
        {"tenant_id": context.tenant_id, "acknowledged": False, "severity": "critical"}
    )
    return {"total": total, "critical": critical}


@api_router.post("/tracker/alerts/{alert_id}/ack")
async def acknowledge_tracker_alert(
    alert_id: str,
    context: TenantContext = Depends(require_admin),
):
    """Acknowledge a single alert (only for the current tenant)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.tracker_alerts.update_one(
        {"id": alert_id, "tenant_id": context.tenant_id, "acknowledged": False},
        {"$set": {"acknowledged": True, "acknowledged_at": now_iso, "acknowledged_by": context.user_id}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found or already acknowledged")
    return {"ok": True}


@api_router.post("/tracker/alerts/ack-bulk")
async def bulk_acknowledge_alerts(
    payload: AlertAckPayload,
    context: TenantContext = Depends(require_admin),
):
    """Bulk-acknowledge every unacknowledged alert for the current tenant.
    If `type` is provided, only alerts of that type are acknowledged."""
    now_iso = datetime.now(timezone.utc).isoformat()
    query = {"tenant_id": context.tenant_id, "acknowledged": False}
    if payload.type:
        allowed = {"speeding", "unplug", "offline", "geofence_exit"}
        if payload.type not in allowed:
            raise HTTPException(status_code=400, detail="Unknown alert type")
        query["type"] = payload.type

    res = await db.tracker_alerts.update_many(
        query,
        {"$set": {"acknowledged": True, "acknowledged_at": now_iso, "acknowledged_by": context.user_id}},
    )
    return {"ok": True, "acknowledged": res.modified_count}


# ==================== VEHICLE GEOFENCE (Phase 5) ====================
# Base-location + radius per car. The poller reads these fields off the
# vehicle document on every tick and emits a `geofence_exit` alert when
# the car is fixed outside the circle.

@api_router.put("/vehicles/{car_id}/geofence")
async def set_vehicle_geofence(
    car_id: str,
    payload: GeofenceUpdate,
    context: TenantContext = Depends(require_admin),
):
    """Set or clear the geofence for a single vehicle. Pass nulls for lat,
    lon, radius to clear."""
    car = await db.vehicles.find_one(
        {"id": car_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not car:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    lat = payload.geofence_center_lat
    lon = payload.geofence_center_lon
    radius = payload.geofence_radius_km

    # Validate: all three or none
    if any(v is not None for v in (lat, lon, radius)) and not all(v is not None for v in (lat, lon, radius)):
        raise HTTPException(status_code=400, detail="Provide lat, lon and radius together (or all null to clear)")

    if radius is not None and (radius < 1 or radius > 5000):
        raise HTTPException(status_code=400, detail="Radius must be between 1 and 5000 km")

    update = {
        "geofence_center_lat": lat,
        "geofence_center_lon": lon,
        "geofence_radius_km": radius,
        "geofence_label": (payload.geofence_label or "").strip() or None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.vehicles.update_one(
        {"id": car_id, "tenant_id": context.tenant_id},
        {"$set": update},
    )
    return {"ok": True, **update}


# ==================== FLEET TELEMETRY (Phase 6) ====================
# Aggregated live telemetry for every tracked car in the current tenant.
# Frontend re-polls this every 30 s to power the fleet cards.

@api_router.get("/tracker/telemetry")
async def get_fleet_telemetry(
    context: TenantContext = Depends(get_tenant_context),
):
    from services.fleet_telemetry_service import build_telemetry
    rows = await build_telemetry(db, context.tenant_id)
    return {"telemetry": rows, "count": len(rows)}


@api_router.get("/tracker/geocode")
async def reverse_geocode(
    lat: float = Query(...),
    lon: float = Query(...),
    context: TenantContext = Depends(get_tenant_context),
):
    """Reverse-geocode a single lat/lon via cached OpenStreetMap Nominatim.
    Called lazily by the FleetBoard card once per car when the telemetry
    payload has no cached address."""
    from services.fleet_telemetry_service import resolve_address
    address = await resolve_address(db, lat, lon)
    return {"address": address}


# ==================== DRIVER BEHAVIOUR EVENTS (Phase 6) ====================
# Feed of flagged driving events for admin review. NOT a scoring system —
# just raw events with booking + staff linkage. Filters: type, car,
# staff, date range.

@api_router.get("/behaviour/events")
async def list_behaviour_events(
    event_type: Optional[str] = Query(None, alias="type"),
    car_id: Optional[str] = Query(None),
    staff_id: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, description="ISO date/datetime, inclusive lower bound"),
    to_date: Optional[str] = Query(None, description="ISO date/datetime, inclusive upper bound"),
    limit: int = Query(200, ge=1, le=1000),
    context: TenantContext = Depends(get_tenant_context),
):
    query: dict = {"tenant_id": context.tenant_id}
    if event_type:
        if event_type not in {"speeding", "harsh_braking", "harsh_acceleration", "disconnection"}:
            raise HTTPException(status_code=400, detail="Unknown event type")
        query["type"] = event_type
    if car_id:
        query["car_id"] = car_id
    if staff_id:
        query["staff_id"] = staff_id
    if from_date or to_date:
        ts_q: dict = {}
        if from_date:
            ts_q["$gte"] = from_date
        if to_date:
            ts_q["$lte"] = to_date
        query["timestamp"] = ts_q

    events = await db.driver_behaviour_events.find(query, {"_id": 0}).sort(
        "timestamp", -1
    ).to_list(limit)
    return {"events": events, "count": len(events)}


@api_router.get("/behaviour/summary")
async def behaviour_summary(
    window_days: int = Query(7, ge=1, le=90),
    context: TenantContext = Depends(get_tenant_context),
):
    """Summary stats for the /behaviour dashboard: totals by type + worst
    offenders (staff members with the most events) inside the window."""
    from_iso = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()
    pipeline_type = [
        {"$match": {"tenant_id": context.tenant_id, "timestamp": {"$gte": from_iso}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
    ]
    pipeline_staff = [
        {"$match": {"tenant_id": context.tenant_id, "timestamp": {"$gte": from_iso}, "staff_id": {"$ne": None}}},
        {"$group": {
            "_id": "$staff_id",
            "count": {"$sum": 1},
            "staff_name": {"$first": "$staff_name"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    by_type = {row["_id"]: row["count"] async for row in db.driver_behaviour_events.aggregate(pipeline_type)}
    top_staff = [
        {"staff_id": row["_id"], "staff_name": row.get("staff_name") or "Unknown", "count": row["count"]}
        async for row in db.driver_behaviour_events.aggregate(pipeline_staff)
    ]
    total = sum(by_type.values())
    return {
        "window_days": window_days,
        "total": total,
        "by_type": by_type,
        "top_staff": top_staff,
    }


# ==================== PUBLIC CONTACT / PRICING LEADS ====================
# Landing page contact + pricing modal. Stores lead in Mongo and best-effort
# emails Lee (uses same Resend key; will silently fail-safe if delivery is
# rejected — lead is still recorded).

class PublicContactPayload(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    phone: Optional[str] = None
    fleet_size: Optional[str] = None
    message: Optional[str] = None
    type: str = "general"  # 'general' | 'pricing'


@api_router.post("/public/contact")
async def submit_public_contact(payload: PublicContactPayload):
    if not payload.name.strip() or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Name and email are required")

    now_iso = datetime.now(timezone.utc).isoformat()
    lead = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": payload.email.strip().lower(),
        "company": (payload.company or "").strip() or None,
        "phone": (payload.phone or "").strip() or None,
        "fleet_size": (payload.fleet_size or "").strip() or None,
        "message": (payload.message or "").strip() or None,
        "type": payload.type,
        "created_at": now_iso,
        "status": "new",
    }
    await db.contact_requests.insert_one(lead)
    # Fire off the notification email to Lee. Never let email failure break
    # the form submission — the lead is safely stored regardless.
    try:
        from services.email_service import send_contact_lead_email
        email_result = await send_contact_lead_email(lead)
        await db.contact_requests.update_one(
            {"id": lead["id"]},
            {"$set": {
                "email_sent": bool(email_result.get("success")),
                "email_delivered_to": email_result.get("delivered_to"),
                "email_error": email_result.get("error"),
            }},
        )
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).error("Contact lead email dispatch crashed: %s", exc)
    return {"ok": True, "id": lead["id"]}


# ==================== COMPLIANCE ACKNOWLEDGMENTS ====================
# as "actioned" or "dismissed" so it disappears from the dashboard. The
# acknowledgment is keyed to the underlying due-date/mileage value, so when
# the vehicle is renewed (a new date entered) the ack becomes stale and the
# alert re-emerges automatically — no manual reset needed.

class ComplianceAckCreate(BaseModel):
    vehicle_id: str
    type: str  # 'tax' | 'nct' | 'insurance' | 'service' | 'driver_licence'
    action: str  # 'actioned' | 'dismissed'
    ref: str  # date string (YYYY-MM-DD) or mileage value at time of action
    note: Optional[str] = None


@api_router.get("/compliance/acknowledgments")
async def list_compliance_acks(context: TenantContext = Depends(require_tenant_context)):
    """Return all active compliance acknowledgments for the tenant.

    Frontend uses these to hide alert cards the admin has already cleared.
    Returns a list, no _id.
    """
    acks = await db.compliance_acks.find(
        {"tenant_id": context.tenant_id}, {"_id": 0}
    ).to_list(length=2000)
    return {"acknowledgments": acks}


@api_router.post("/compliance/acknowledgments")
async def create_compliance_ack(
    payload: ComplianceAckCreate,
    context: TenantContext = Depends(require_admin),
):
    """Create or replace an acknowledgment for a compliance issue.

    Idempotent: a unique (tenant_id, vehicle_id, type, ref) tuple is upserted,
    so re-acknowledging the same issue just updates the action/note/actor.
    """
    if payload.action not in ("actioned", "dismissed"):
        raise HTTPException(status_code=400, detail="action must be 'actioned' or 'dismissed'")
    if payload.type not in ("tax", "nct", "insurance", "service", "driver_licence"):
        raise HTTPException(status_code=400, detail="invalid compliance type")

    # Confirm the vehicle exists for this tenant
    vehicle = await db.vehicles.find_one(
        {"id": payload.vehicle_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not vehicle and payload.type != "driver_licence":
        raise HTTPException(status_code=404, detail="Vehicle not found in tenant")

    now_iso = datetime.now(timezone.utc).isoformat()
    key = {
        "tenant_id": context.tenant_id,
        "vehicle_id": payload.vehicle_id,
        "type": payload.type,
        "ref": payload.ref,
    }
    actor_doc = await db.users.find_one({"id": context.user_id}, {"_id": 0, "name": 1, "id": 1})
    actor_name = (actor_doc or {}).get("name")
    actor_id = context.user_id
    set_doc = {
        **key,
        "action": payload.action,
        "note": payload.note,
        "actioned_by_user_id": actor_id,
        "actioned_by_name": actor_name,
        "actioned_at": now_iso,
        "updated_at": now_iso,
    }
    existing = await db.compliance_acks.find_one(key, {"_id": 0})
    if existing:
        await db.compliance_acks.update_one(key, {"$set": set_doc})
        ack_id = existing.get("id")
    else:
        ack_id = str(uuid.uuid4())
        set_doc["id"] = ack_id
        set_doc["created_at"] = now_iso
        await db.compliance_acks.insert_one(dict(set_doc))

    return {
        "message": "Acknowledgment saved",
        "acknowledgment": {**set_doc, "id": ack_id},
    }


@api_router.delete("/compliance/acknowledgments/{ack_id}")
async def delete_compliance_ack(
    ack_id: str,
    context: TenantContext = Depends(require_admin),
):
    """Restore (un-acknowledge) a compliance issue so it appears again."""
    result = await db.compliance_acks.delete_one(
        {"id": ack_id, "tenant_id": context.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Acknowledgment not found")
    return {"message": "Acknowledgment removed"}




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
    
    # Store a *relative* URL — the frontend prefixes it with REACT_APP_BACKEND_URL
    # so the same DB record works in preview, production, or any other host. The
    # earlier implementation baked in os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    # at upload time, which broke as soon as the request came from a different host
    # (e.g. a preview URL or the production domain).
    logo_url = f"/api/uploads/logos/{filename}"
    
    # Update tenant settings
    await db.tenants.update_one(
        {"id": context.tenant_id},
        {"$set": {
            "settings.logo_url": logo_url,
            "settings.logo_filename": filename,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    await ttl_cache.invalidate(tenant_settings_key(context.tenant_id))
    
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


class ReplaceMasterAdminRequest(BaseModel):
    """Atomically replace the master_admin of a tenant.

    Strips ALL existing master_admin memberships (so an old owner like Eddie
    is fully detached), then sets the supplied user as the sole master_admin.
    If the new user doesn't exist yet, we create one.  Designed for the
    'hand-over to a real client' onboarding step.
    """
    email: EmailStr
    name: Optional[str] = None
    display_name: Optional[str] = None  # short greeting nickname (e.g. "K")
    password: Optional[str] = None  # if absent, a default is generated
    delete_old_owner_user: bool = True  # also delete Eddie's user record if orphaned
    send_welcome_email: bool = True  # email new owner their credentials via Resend
    force_password_change: bool = True  # require new owner to change pw on first login
    admin_password: str  # super admin's own password for confirmation


@api_router.post("/platform/tenants/{tenant_id}/replace-master-admin")
async def replace_master_admin(
    tenant_id: str,
    payload: ReplaceMasterAdminRequest,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None,
):
    """Replace the master admin of a tenant in one atomic flow."""
    # Verify acting super admin's password
    acting = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not acting or not verify_password(payload.admin_password, acting["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid super-admin password")

    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    new_email = payload.email.strip().lower()
    new_name = (payload.name or new_email.split("@")[0]).strip()
    new_display_name = (payload.display_name or "").strip() or None
    new_password = payload.password or "QuickWing123!"
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # === 1) Detach existing master_admin memberships ===
    old_memberships = await db.memberships.find(
        {"tenant_id": tenant_id, "role": "master_admin"},
        {"_id": 0},
    ).to_list(50)

    SAFE_EMAILS = {SUPPORT_ADMIN_EMAIL.lower(), "superadmin@quickwing.com"}
    old_owner_ids: list[str] = []
    for m in old_memberships:
        u = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "email": 1, "role": 1})
        if not u:
            continue
        email_lower = (u.get("email") or "").lower()
        # Skip our own helper accounts so support keeps cross-tenant master_admin
        if email_lower in SAFE_EMAILS:
            continue
        # Skip the new email — if Karen already has master_admin we'll leave her be
        if email_lower == new_email:
            continue
        old_owner_ids.append(m["user_id"])
        await db.memberships.delete_one(
            {"user_id": m["user_id"], "tenant_id": tenant_id}
        )

    # === 2) Optionally delete orphan old-owner user records ===
    deleted_user_emails: list[str] = []
    if payload.delete_old_owner_user:
        for uid in old_owner_ids:
            other = await db.memberships.count_documents({"user_id": uid})
            if other == 0:
                u = await db.users.find_one({"id": uid}, {"_id": 0, "email": 1, "role": 1})
                if not u:
                    continue
                if u.get("role") in {"super_admin", "master_admin"}:
                    continue  # platform-level account — leave alone
                if (u.get("email") or "").lower() in SAFE_EMAILS:
                    continue
                await db.users.delete_one({"id": uid})
                deleted_user_emails.append(u.get("email"))

    # === 3) Create or update the new master admin user ===
    new_user = await db.users.find_one({"email": new_email}, {"_id": 0})
    if new_user:
        # Reuse the existing account but reset password + ensure active
        update_doc = {
            "password_hash": get_password_hash(new_password),
            "name": new_name or new_user.get("name") or new_email,
            "is_active": True,
            "require_password_change": bool(payload.force_password_change),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if new_display_name is not None:
            update_doc["display_name"] = new_display_name
        await db.users.update_one(
            {"id": new_user["id"]},
            {"$set": update_doc},
        )
        new_user_id = new_user["id"]
        created_new_user = False
    else:
        new_user_id = str(uuid.uuid4())
        insert_doc = {
            "id": new_user_id,
            "email": new_email,
            "name": new_name,
            "password_hash": get_password_hash(new_password),
            "is_active": True,
            "require_password_change": bool(payload.force_password_change),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if new_display_name:
            insert_doc["display_name"] = new_display_name
        await db.users.insert_one(insert_doc)
        created_new_user = True

    # === 4) Ensure exactly one master_admin membership for the new user ===
    existing = await db.memberships.find_one(
        {"user_id": new_user_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if existing:
        if existing.get("role") != "master_admin":
            await db.memberships.update_one(
                {"user_id": new_user_id, "tenant_id": tenant_id},
                {"$set": {"role": "master_admin"}},
            )
    else:
        await db.memberships.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": new_user_id,
            "tenant_id": tenant_id,
            "role": "master_admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # === 5) Mirror new owner on the tenant doc (used by some UI flows) ===
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {
            "master_admin_email": new_email,
            "master_admin_name": new_name,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # === 6) Audit ===
    try:
        await audit_service.log_tenant_action(
            actor_user_id=context.user_id,
            actor_email=context.user_email,
            action=AuditAction.TENANT_UPDATED,
            tenant_id=tenant_id,
            meta={
                "action": "replace_master_admin",
                "old_owner_user_ids": old_owner_ids,
                "deleted_user_emails": deleted_user_emails,
                "new_owner_email": new_email,
                "created_new_user": created_new_user,
            },
            ip_address=request.client.host if request and request.client else None,
        )
    except Exception:
        pass

    base_url = get_public_url()
    login_url = f"{base_url}/{tenant.get('slug')}/login"

    # === 7) Optionally email the new owner their credentials ===
    email_status = {"sent": False, "skipped": True, "error": None}
    if payload.send_welcome_email:
        email_result = await send_owner_welcome_email(
            recipient_email=new_email,
            owner_name=new_name,
            tenant_name=tenant.get("name", "your fleet"),
            login_url=login_url,
            temporary_password=new_password,
        )
        email_status = {
            "sent": email_result.get("success", False),
            "skipped": False,
            "error": email_result.get("error"),
        }

    return {
        "message": f"Master admin replaced for '{tenant.get('name')}'",
        "tenant_id": tenant_id,
        "new_owner": {
            "user_id": new_user_id,
            "email": new_email,
            "name": new_name,
            "password": new_password,
            "is_new_user": created_new_user,
            "login_url": login_url,
        },
        "removed": {
            "old_owner_memberships": len(old_owner_ids),
            "deleted_user_emails": deleted_user_emails,
        },
        "email": email_status,
    }


@api_router.post("/platform/tenants/{tenant_id}/reset-master-admin-password")
async def reset_master_admin_password(
    tenant_id: str,
    payload: dict,
    context: TenantContext = Depends(require_platform_admin),    request: Request = None,
):
    """
    Super/Master admin: reset the password of the tenant's master admin.

    Body: {"new_password": "..."}
    Used from the Platform Admin dashboard so super admins can hand the
    customer fresh credentials when they lose them.
    """
    new_password = (payload or {}).get("new_password", "").strip()
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    master_email = tenant.get("master_admin_email")
    if not master_email:
        raise HTTPException(status_code=400, detail="Tenant has no master admin configured")

    user = await db.users.find_one({"email": master_email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Master admin user account not found")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": get_password_hash(new_password),
            "require_password_change": False,
        }},
    )

    try:
        await audit_service.log(
            actor_user_id=context.user_id,
            actor_email=context.user_email,
            action=AuditAction.USER_PASSWORD_RESET,
            tenant_id=tenant_id,
            resource_type="master_admin",
            resource_id=user["id"],
            ip_address=request.client.host if request and request.client else None,
            meta={"tenant_name": tenant.get("name"), "master_email": master_email},
        )
    except Exception:
        pass

    return {
        "success": True,
        "master_admin_email": master_email,
        "message": "Master admin password updated",
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


class ResetTenantDataRequest(BaseModel):
    """Body for the per-tenant "reset to blank slate" endpoint."""
    password: str
    confirm: bool = False


# Names of every operational collection that stores per-tenant data and should
# be wiped on a "reset client" action. Anything NOT in this list is preserved
# (tenant doc itself, plan config, branding settings, master admin, etc.).
TENANT_DATA_COLLECTIONS = [
    "vehicles",
    "bookings",
    "car_statuses",
    "incidents",
    "incident_form_configs",
    "mileage_logs",
    "lift_requests",
    "todos",
    "messages",
    "providers",
    "locations",
    "document_templates",
    "document_submissions",
    "activation_tokens",
    "announcements",
    "notifications",
    "audit_logs",
]


@api_router.post("/platform/tenants/{tenant_id}/reset-data")
async def reset_tenant_data(
    tenant_id: str,
    reset_request: ResetTenantDataRequest,
    context: TenantContext = Depends(require_super_admin),
    request: Request = None,
):
    """
    Reset a tenant to a blank slate WITHOUT deleting the tenant itself.

    Wipes all operational data (vehicles, bookings, incidents, custom docs,
    etc.) plus every staff / admin membership. Preserves:
      - the tenant record (name, slug, plan, branding)
      - the master_admin membership(s) so the client can still log in
      - global super_admin / support_admin memberships for remote help

    Use this when handing a tenant over after a trial.
    """
    user = await db.users.find_one({"id": context.user_id}, {"_id": 0})
    if not user or not verify_password(reset_request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid password")

    if not reset_request.confirm:
        raise HTTPException(status_code=400, detail="Please confirm reset (confirm=true)")

    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # 1) Wipe operational data
    counts: dict = {}
    for coll in TENANT_DATA_COLLECTIONS:
        res = await db[coll].delete_many({"tenant_id": tenant_id})
        counts[coll] = res.deleted_count

    # 2) Decide which memberships to keep
    SAFE_EMAILS = {SUPPORT_ADMIN_EMAIL.lower(), "superadmin@quickwing.com"}
    memberships = await db.memberships.find(
        {"tenant_id": tenant_id}, {"_id": 0}
    ).to_list(2000)

    members_to_remove = []
    users_to_check_orphan = []
    for m in memberships:
        if m.get("role") == "master_admin":
            continue
        u = await db.users.find_one(
            {"id": m["user_id"]}, {"_id": 0, "email": 1, "role": 1}
        )
        if u and (u.get("email") or "").lower() in SAFE_EMAILS:
            continue
        if u and u.get("role") in {"super_admin", "master_admin"}:
            continue
        members_to_remove.append(m)
        users_to_check_orphan.append(m["user_id"])

    removed_membership_count = 0
    for m in members_to_remove:
        await db.memberships.delete_one(
            {"user_id": m["user_id"], "tenant_id": tenant_id}
        )
        removed_membership_count += 1

    # 3) Delete user records that no longer belong to ANY tenant
    deleted_user_count = 0
    for uid in users_to_check_orphan:
        other = await db.memberships.count_documents({"user_id": uid})
        u = await db.users.find_one({"id": uid}, {"_id": 0, "role": 1, "email": 1})
        if not u:
            continue
        if u.get("role") in {"super_admin", "master_admin"}:
            continue
        if (u.get("email") or "").lower() in SAFE_EMAILS:
            continue
        if other == 0:
            await db.users.delete_one({"id": uid})
            deleted_user_count += 1

    # 4) Audit
    try:
        await audit_service.log_tenant_action(
            actor_user_id=context.user_id,
            actor_email=context.user_email,
            action=AuditAction.TENANT_UPDATED,
            tenant_id=tenant_id,
            meta={
                "action": "reset_tenant_data",
                "tenant_name": tenant.get("name"),
                "data_counts": counts,
                "memberships_removed": removed_membership_count,
                "users_deleted": deleted_user_count,
            },
            ip_address=request.client.host if request and request.client else None,
        )
    except Exception:
        pass

    return {
        "message": (
            f"Tenant '{tenant.get('name')}' reset to a blank slate. "
            "Master admin and super-admin support access preserved."
        ),
        "data_counts": counts,
        "memberships_removed": removed_membership_count,
        "users_deleted": deleted_user_count,
    }


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
        "id": str(uuid.uuid4()),
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


# ==================== BACKUP & DISASTER RECOVERY ====================

@api_router.get("/platform/backup/stats")
async def get_backup_stats(context: TenantContext = Depends(require_platform_admin)):
    """Get database statistics for backup planning."""
    backup_service = BackupService(db)
    return await backup_service.get_backup_stats()


@api_router.get("/platform/backup/full")
async def create_full_backup(context: TenantContext = Depends(require_platform_admin)):
    """
    Create a full platform backup.
    Downloads all data as a JSON file.
    WARNING: This may take time for large databases.
    """
    backup_service = BackupService(db)
    backup_data = await backup_service.create_full_backup()
    
    # Log backup action
    await audit_service.log(
        tenant_id="platform",
        user_id=context.user_id,
        action=AuditAction.SETTINGS_UPDATE,
        resource_type="backup",
        resource_id="full",
        status="success",
        user_email=context.user_email,
        meta={"backup_type": "full", "documents": backup_data["backup_info"]["total_documents"]}
    )
    
    # Return as downloadable JSON file
    json_content = serialize_backup(backup_data)
    filename = f"quickwing-full-backup-{datetime.now().strftime('%Y-%m-%d-%H%M%S')}.json"
    
    return StreamingResponse(
        iter([json_content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.get("/platform/backup/tenant/{tenant_id}")
async def create_tenant_backup(
    tenant_id: str,
    context: TenantContext = Depends(require_platform_admin)
):
    """
    Create a backup for a specific franchise/tenant.
    Downloads all tenant data as a JSON file.
    """
    backup_service = BackupService(db)
    
    try:
        backup_data = await backup_service.create_tenant_backup(tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    tenant_name = backup_data.get("tenant_info", {}).get("name", tenant_id)
    
    # Log backup action
    await audit_service.log(
        tenant_id=tenant_id,
        user_id=context.user_id,
        action=AuditAction.SETTINGS_UPDATE,
        resource_type="backup",
        resource_id=tenant_id,
        status="success",
        user_email=context.user_email,
        meta={"backup_type": "tenant", "tenant_name": tenant_name, "documents": backup_data["backup_info"]["total_documents"]}
    )
    
    # Return as downloadable JSON file
    json_content = serialize_backup(backup_data)
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in tenant_name)
    filename = f"quickwing-{safe_name}-backup-{datetime.now().strftime('%Y-%m-%d-%H%M%S')}.json"
    
    return StreamingResponse(
        iter([json_content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.post("/platform/backup/restore/tenant")
async def restore_tenant_backup(
    backup_file: UploadFile = File(...),
    overwrite: bool = False,
    context: TenantContext = Depends(require_platform_admin)
):
    """
    Restore a tenant from a backup file.
    
    - Upload a tenant backup JSON file
    - Set overwrite=True to replace existing data (DANGEROUS)
    """
    try:
        content = await backup_file.read()
        backup_data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON backup file")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading backup file: {str(e)}")
    
    backup_service = BackupService(db)
    
    try:
        result = await backup_service.restore_tenant_backup(backup_data, overwrite=overwrite)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Log restore action
    await audit_service.log(
        tenant_id=result.get("tenant_id", "unknown"),
        user_id=context.user_id,
        action=AuditAction.SETTINGS_UPDATE,
        resource_type="restore",
        resource_id=result.get("tenant_id"),
        status="success" if not result.get("errors") else "partial",
        user_email=context.user_email,
        meta={"restored_collections": result.get("collections_restored"), "errors": result.get("errors")}
    )
    
    return result


@api_router.get("/admin/backup/my-franchise")
async def backup_my_franchise(context: TenantContext = Depends(require_admin)):
    """
    Franchise admin can backup their own franchise data.
    """
    if not context.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant context")
    
    backup_service = BackupService(db)
    backup_data = await backup_service.create_tenant_backup(context.tenant_id)
    
    tenant_name = backup_data.get("tenant_info", {}).get("name", "franchise")
    
    # Log backup action
    await audit_service.log(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        action=AuditAction.SETTINGS_UPDATE,
        resource_type="backup",
        resource_id=context.tenant_id,
        status="success",
        user_email=context.user_email,
        meta={"backup_type": "franchise_admin", "documents": backup_data["backup_info"]["total_documents"]}
    )
    
    json_content = serialize_backup(backup_data)
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in tenant_name)
    filename = f"quickwing-{safe_name}-backup-{datetime.now().strftime('%Y-%m-%d-%H%M%S')}.json"
    
    return StreamingResponse(
        iter([json_content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


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
    frontend_url = get_public_url()
    staff_login_url = f"{frontend_url}/{tenant['slug']}/login" if tenant else None

    # Send invitation email with activation link (failures don't block).
    invite_result = await _issue_staff_invitation(
        user_id=user_id,
        user_email=user_data.email,
        user_name=user_data.name,
        tenant_id=context.tenant_id,
        temporary_password=temp_password,
    )

    return {
        "message": "User created successfully", 
        "user_id": user_id,
        "temporary_password": temp_password,
        "login_url": staff_login_url,
        "require_password_change": True,
        "email_sent": invite_result.get("sent", False),
        "email_error": invite_result.get("error"),
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


class TenantUserProfileUpdate(BaseModel):
    """Admin-side updates to a tenant user's profile.

    Lets a master_admin / admin edit a colleague's name, greeting nickname
    and driver's-licence expiry so the dashboard reads correctly and
    compliance alerts fire on time. Email is intentionally locked here —
    changing email is a sensitive account action and stays at platform-admin
    level.
    """
    name: Optional[str] = None
    display_name: Optional[str] = None
    driver_licence_expiry: Optional[str] = None  # YYYY-MM-DD, "" to clear
    driver_licence_number: Optional[str] = None  # free-form


@api_router.patch("/tenant/users/{user_id}")
async def update_tenant_user_profile(
    user_id: str,
    payload: TenantUserProfileUpdate,
    context: TenantContext = Depends(require_admin),
    request: Request = None,
):
    """Update a tenant user's display fields (name + greeting nickname)."""
    membership = await db.memberships.find_one(
        {"user_id": user_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in tenant")

    update_fields: dict = {}
    if payload.name is not None:
        cleaned = payload.name.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        if len(cleaned) > 100:
            raise HTTPException(status_code=400, detail="Name is too long")
        update_fields["name"] = cleaned
    if payload.display_name is not None:
        nick = payload.display_name.strip()
        if len(nick) > 30:
            raise HTTPException(status_code=400, detail="Greeting nickname must be 30 characters or fewer")
        update_fields["display_name"] = nick or None
    if payload.driver_licence_expiry is not None:
        update_fields["driver_licence_expiry"] = _validate_iso_date_or_none(
            payload.driver_licence_expiry
        )
    if payload.driver_licence_number is not None:
        update_fields["driver_licence_number"] = (
            payload.driver_licence_number.strip() or None
        )

    if not update_fields:
        raise HTTPException(status_code=400, detail="No profile fields supplied")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": user_id}, {"$set": update_fields})

    try:
        await audit_service.log_user_action(
            actor_user_id=context.user_id,
            actor_email=context.user_email,
            action=AuditAction.USER_UPDATED,
            target_user_id=user_id,
            tenant_id=context.tenant_id,
            meta={"fields": list(update_fields.keys())},
            ip_address=request.client.host if request and request.client else None,
        )
    except Exception:
        pass

    updated = await db.users.find_one(
        {"id": user_id}, {"_id": 0, "password_hash": 0}
    )
    return {"message": "User profile updated", "user": updated}


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


class TenantUserActiveToggle(BaseModel):
    is_active: bool


@api_router.post("/tenant/users/{user_id}/set-active")
async def set_tenant_user_active(
    user_id: str,
    payload: TenantUserActiveToggle,
    context: TenantContext = Depends(require_admin),
    request: Request = None,
):
    """Activate or deactivate a tenant user. Deactivating flips
    `users.is_active` to false so the account can no longer log in,
    but keeps the membership + audit trail intact.

    Admins cannot deactivate themselves — that would immediately lock
    them out of the tenant they're managing.
    """
    if user_id == context.user_id:
        raise HTTPException(
            status_code=400, detail="You cannot deactivate your own account"
        )

    membership = await db.memberships.find_one(
        {"user_id": user_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in tenant")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_active": bool(payload.is_active),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    try:
        await audit_service.log_user_action(
            actor_user_id=context.user_id,
            actor_email=context.user_email,
            action=AuditAction.USER_UPDATED,
            target_user_id=user_id,
            tenant_id=context.tenant_id,
            meta={"is_active": bool(payload.is_active)},
            ip_address=request.client.host if request and request.client else None,
        )
    except Exception:
        pass

    updated = await db.users.find_one(
        {"id": user_id}, {"_id": 0, "password_hash": 0}
    )
    return {"message": "User status updated", "user": updated}


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
    await ttl_cache.invalidate_prefix(tenant_prefix(context.tenant_id))
    
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


@api_router.post("/vehicles/bulk-import")
async def bulk_import_vehicles(
    file: UploadFile = File(...),
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """
    Bulk import vehicles from a CSV or Excel file into the current tenant.

    Accepts: .csv, .xlsx, .xls (first sheet only).

    Expected columns (header row required):
      name, registration, current_status, tax_due_date, nct_due_date,
      insurance_due_date, current_mileage, service_due_mileage,
      service_due_date, base_location

    Required: name, registration
    Service due: provide EITHER service_due_mileage (km) OR service_due_date
    (YYYY-MM-DD). Both are optional; only one is needed.

    Returns a per-row summary so the client can show which rows succeeded/failed.
    """
    import csv as _csv
    from io import StringIO as _StringIO, BytesIO as _BytesIO

    filename = (file.filename or "").lower()
    is_excel = filename.endswith(".xlsx") or filename.endswith(".xls")
    is_csv = filename.endswith(".csv")
    if not (is_excel or is_csv):
        raise HTTPException(status_code=400, detail="File must be .csv, .xlsx or .xls")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(raw) > 5 * 1024 * 1024:  # 5 MB hard cap
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    # === Parse rows into a uniform list[dict] regardless of format ===
    rows_iter: list = []
    if is_excel:
        try:
            from openpyxl import load_workbook
            wb = load_workbook(_BytesIO(raw), data_only=True, read_only=True)
            ws = wb.worksheets[0]
            it = ws.iter_rows(values_only=True)
            try:
                header = next(it)
            except StopIteration:
                raise HTTPException(status_code=400, detail="Excel file has no rows")
            headers = [(str(h).strip().lower() if h is not None else "") for h in header]
            for raw_row in it:
                # Skip fully-empty rows (openpyxl pads short rows with None)
                if not any(c is not None and str(c).strip() != "" for c in raw_row):
                    continue
                row = {}
                for idx, val in enumerate(raw_row):
                    if idx >= len(headers):
                        break
                    key = headers[idx]
                    if not key:
                        continue
                    if isinstance(val, datetime):
                        row[key] = val.date().isoformat()
                    elif val is None:
                        row[key] = ""
                    else:
                        row[key] = str(val).strip()
                rows_iter.append(row)
            fieldnames = headers
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("Excel parse failed: %s", exc)
            raise HTTPException(status_code=400, detail=f"Could not read Excel file: {exc}")
    else:
        # CSV path — try utf-8 then latin-1
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("latin-1", errors="replace")
        reader = _csv.DictReader(_StringIO(text))
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV has no header row")
        fieldnames = [(fn or "").strip().lower() for fn in reader.fieldnames]
        for raw_row in reader:
            rows_iter.append(
                {(k or "").strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in raw_row.items()}
            )

    norm_fieldnames = [f for f in fieldnames if f]

    required = {"name", "registration"}
    missing_required = required - set(norm_fieldnames)
    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"File missing required columns: {', '.join(sorted(missing_required))}"
        )

    # Plan limit check
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0}) or {}
    max_vehicles = int(tenant.get("max_vehicles", 10))
    current_count = await db.vehicles.count_documents({"tenant_id": context.tenant_id})

    # Pre-load existing registrations to detect duplicates fast
    existing = await db.vehicles.find(
        {"tenant_id": context.tenant_id},
        {"_id": 0, "registration": 1}
    ).to_list(10000)
    existing_regs = {(v.get("registration") or "").strip().upper() for v in existing}

    succeeded = []
    errors = []
    created_in_batch_regs = set()

    def _parse_date(s):
        """Validate YYYY-MM-DD; return string or raise."""
        if not s:
            return None
        try:
            datetime.strptime(s, "%Y-%m-%d")
            return s
        except ValueError:
            raise ValueError(f"Invalid date '{s}' (expected YYYY-MM-DD)")

    def _parse_int(s):
        if s is None or s == "":
            return None
        try:
            return int(float(s))
        except (TypeError, ValueError):
            raise ValueError(f"Invalid integer '{s}'")

    row_num = 1  # header is row 1; first data row is 2
    for raw_row in rows_iter:
        row_num += 1
        try:
            # rows_iter already has lowercase keys / stripped values
            row = raw_row
            name = (row.get("name") or "").strip()
            reg = (row.get("registration") or "").strip()

            if not name:
                raise ValueError("Missing required field 'name'")
            if not reg:
                raise ValueError("Missing required field 'registration'")

            reg_upper = reg.upper()
            if reg_upper in existing_regs:
                raise ValueError(f"Duplicate registration '{reg}' (already exists in tenant)")
            if reg_upper in created_in_batch_regs:
                raise ValueError(f"Duplicate registration '{reg}' appears twice in file")

            # Plan limit
            if (current_count + len(succeeded)) >= max_vehicles:
                raise ValueError(f"Vehicle limit reached ({max_vehicles}). Upgrade plan to add more.")

            vehicle = {
                "id": str(uuid.uuid4()),
                "tenant_id": context.tenant_id,
                "name": name,
                "registration": reg,
                "current_status": (row.get("current_status") or "Free").strip() or "Free",
                "tax_due_date": _parse_date(row.get("tax_due_date") or ""),
                "nct_due_date": _parse_date(row.get("nct_due_date") or ""),
                "insurance_due_date": _parse_date(row.get("insurance_due_date") or ""),
                "current_mileage": _parse_int(row.get("current_mileage") or ""),
                # Service-due — admins can set either a target mileage OR a
                # target date. Both columns are accepted; both may be empty.
                "service_due_mileage": _parse_int(row.get("service_due_mileage") or ""),
                "service_due_date": _parse_date(row.get("service_due_date") or ""),
                "base_location": (row.get("base_location") or "").strip() or None,
                "is_blocked": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            await db.vehicles.insert_one(vehicle)
            created_in_batch_regs.add(reg_upper)
            succeeded.append({
                "row": row_num,
                "id": vehicle["id"],
                "name": name,
                "registration": reg,
            })
        except Exception as e:
            errors.append({
                "row": row_num,
                "registration": (raw_row.get("registration") or "").strip(),
                "name": (raw_row.get("name") or "").strip(),
                "error": str(e),
            })

    # Audit log (one entry per import)
    try:
        await audit_service.log(
            actor_user_id=context.user_id,
            actor_email=context.user_email,
            action=AuditAction.VEHICLE_CREATED,
            tenant_id=context.tenant_id,
            resource_type="vehicle_bulk_import",
            resource_id=f"bulk_{datetime.now(timezone.utc).isoformat()}",
            ip_address=request.client.host if request and request.client else None,
            meta={"succeeded": len(succeeded), "failed": len(errors)},
        )
    except Exception:
        # Audit log failure should not fail the import
        pass

    if succeeded:
        await ttl_cache.invalidate_prefix(tenant_prefix(context.tenant_id))

    return {
        "message": f"Imported {len(succeeded)} of {len(succeeded) + len(errors)} vehicles",
        "total_rows": len(succeeded) + len(errors),
        "succeeded": len(succeeded),
        "failed": len(errors),
        "created_vehicles": succeeded,
        "errors": errors,
    }



# Default password for bulk-imported staff accounts.
# Users will be forced to change this on their first login.
BULK_IMPORT_DEFAULT_PASSWORD = "QuickWing123!"


@api_router.post("/users/bulk-import")
async def bulk_import_users(
    file: UploadFile = File(...),
    context: TenantContext = Depends(require_admin),
    request: Request = None
):
    """
    Bulk import staff/driver accounts from a CSV file into the current tenant.
    
    Expected CSV columns (header row required):
      name, email, role
    
    Required: name, email
    Optional: role (defaults to 'staff'; allowed: staff, admin, master_admin)
    
    All imported users are created with the default one-time password
    (BULK_IMPORT_DEFAULT_PASSWORD) and `require_password_change=True`,
    so they must reset it on first login.
    
    Returns a per-row summary including the temporary password for each
    successful row, so the platform admin can share credentials.
    """
    import csv as _csv
    from io import StringIO as _StringIO
    import re as _re

    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv file")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")

    reader = _csv.DictReader(_StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no header row")

    norm_fieldnames = [(fn or "").strip().lower() for fn in reader.fieldnames]
    required = {"name", "email"}
    missing_required = required - set(norm_fieldnames)
    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {', '.join(sorted(missing_required))}"
        )

    # Plan limit
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0}) or {}
    max_users = int(tenant.get("max_users", 20))
    current_count = await db.memberships.count_documents({"tenant_id": context.tenant_id})

    # Pre-load existing tenant members (by email) for fast duplicate detection
    member_rows = await db.memberships.find(
        {"tenant_id": context.tenant_id}, {"_id": 0, "user_id": 1}
    ).to_list(10000)
    member_user_ids = [m["user_id"] for m in member_rows]
    if member_user_ids:
        member_users = await db.users.find(
            {"id": {"$in": member_user_ids}}, {"_id": 0, "email": 1}
        ).to_list(10000)
        existing_member_emails = {(u.get("email") or "").strip().lower() for u in member_users}
    else:
        existing_member_emails = set()

    EMAIL_RE = _re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    ALLOWED_ROLES = {"staff", "admin", "master_admin"}
    DEFAULT_PASSWORD_HASH = get_password_hash(BULK_IMPORT_DEFAULT_PASSWORD)

    succeeded = []
    errors = []
    seen_in_batch = set()

    def _norm_row(raw_row):
        return {(k or "").strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in raw_row.items()}

    row_num = 1
    for raw_row in reader:
        row_num += 1
        try:
            row = _norm_row(raw_row)
            name = (row.get("name") or "").strip()
            email = (row.get("email") or "").strip().lower()
            role_str = (row.get("role") or "staff").strip().lower() or "staff"

            if not name:
                raise ValueError("Missing required field 'name'")
            if not email:
                raise ValueError("Missing required field 'email'")
            if not EMAIL_RE.match(email):
                raise ValueError(f"Invalid email '{email}'")
            if role_str not in ALLOWED_ROLES:
                raise ValueError(f"Invalid role '{role_str}' (allowed: staff, admin, master_admin)")

            if email in existing_member_emails:
                raise ValueError(f"User '{email}' is already in this tenant")
            if email in seen_in_batch:
                raise ValueError(f"Duplicate email '{email}' appears twice in CSV")

            if (current_count + len(succeeded)) >= max_users:
                raise ValueError(f"User limit reached ({max_users}). Upgrade plan to add more.")

            # Re-use existing user account if email exists globally; otherwise create a new one.
            existing_user = await db.users.find_one({"email": email}, {"_id": 0})
            if existing_user:
                user_id = existing_user["id"]
                created_new_user = False
            else:
                user_id = str(uuid.uuid4())
                user_doc = {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "password_hash": DEFAULT_PASSWORD_HASH,
                    "is_active": True,
                    "require_password_change": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.users.insert_one(user_doc)
                created_new_user = True

            membership = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "tenant_id": context.tenant_id,
                "role": role_str,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.memberships.insert_one(membership)
            seen_in_batch.add(email)

            succeeded.append({
                "row": row_num,
                "user_id": user_id,
                "name": name,
                "email": email,
                "role": role_str,
                "temporary_password": BULK_IMPORT_DEFAULT_PASSWORD if created_new_user else None,
                "is_new_account": created_new_user,
            })
        except Exception as e:
            errors.append({
                "row": row_num,
                "email": (raw_row.get("email") or raw_row.get("Email") or "").strip(),
                "name": (raw_row.get("name") or raw_row.get("Name") or "").strip(),
                "error": str(e),
            })

    try:
        await audit_service.log(
            actor_user_id=context.user_id,
            actor_email=context.user_email,
            action=AuditAction.USER_CREATED,
            tenant_id=context.tenant_id,
            resource_type="user_bulk_import",
            resource_id=f"bulk_{datetime.now(timezone.utc).isoformat()}",
            ip_address=request.client.host if request and request.client else None,
            meta={"succeeded": len(succeeded), "failed": len(errors)},
        )
    except Exception:
        pass

    # Send invitation emails for newly created accounts (existing accounts
    # don't get a temp password and don't need an invite). Failures here are
    # non-fatal — admins can fall back to sharing creds manually.
    emails_sent = 0
    emails_failed = 0
    for entry in succeeded:
        if not entry.get("is_new_account"):
            continue
        try:
            invite_result = await _issue_staff_invitation(
                user_id=entry["user_id"],
                user_email=entry["email"],
                user_name=entry.get("name"),
                tenant_id=context.tenant_id,
                temporary_password=BULK_IMPORT_DEFAULT_PASSWORD,
            )
            entry["email_sent"] = invite_result.get("sent", False)
            entry["email_error"] = invite_result.get("error")
            if invite_result.get("sent"):
                emails_sent += 1
            else:
                emails_failed += 1
        except Exception as exc:  # noqa: BLE001
            entry["email_sent"] = False
            entry["email_error"] = str(exc)
            emails_failed += 1

    return {
        "message": f"Imported {len(succeeded)} of {len(succeeded) + len(errors)} users",
        "total_rows": len(succeeded) + len(errors),
        "succeeded": len(succeeded),
        "failed": len(errors),
        "default_password": BULK_IMPORT_DEFAULT_PASSWORD,
        "created_users": succeeded,
        "errors": errors,
        "emails_sent": emails_sent,
        "emails_failed": emails_failed,
    }


# ==================== INCIDENT REPORTS ====================
# Each tenant can configure which fields appear on the staff-facing incident form.
# Staff submit reports from their app; admins review, edit, resolve and export.

INCIDENT_TYPES = ["Damage", "Accident", "Breakdown", "Theft", "Fuel", "Near-miss", "Other"]
INCIDENT_SEVERITIES = ["minor", "moderate", "severe"]
INCIDENT_STATUSES = ["open", "resolved"]

DEFAULT_FORM_CONFIG = {
    "show_location": True,
    "show_estimated_cost": True,
    "show_police_report": True,
    "show_insurance_claim": True,
    "show_photos": True,
    "require_description": True,
    "require_location": False,
    "require_photos": False,
}


@api_router.get("/incidents/form-config")
async def get_incident_form_config(context: TenantContext = Depends(get_tenant_context)):
    """Return the staff-facing incident form config for this tenant."""
    doc = await db.incident_form_configs.find_one(
        {"tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not doc:
        return {"tenant_id": context.tenant_id, **DEFAULT_FORM_CONFIG}
    return doc


@api_router.put("/incidents/form-config")
async def update_incident_form_config(
    config: dict,
    context: TenantContext = Depends(require_admin),
):
    """Admin: update which fields appear on the staff incident form."""
    allowed_keys = set(DEFAULT_FORM_CONFIG.keys())
    cleaned = {k: bool(v) for k, v in config.items() if k in allowed_keys}
    merged = {**DEFAULT_FORM_CONFIG, **cleaned}
    merged["tenant_id"] = context.tenant_id
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.incident_form_configs.update_one(
        {"tenant_id": context.tenant_id},
        {"$set": merged},
        upsert=True,
    )
    return {**merged, "message": "Form configuration saved"}


@api_router.get("/incidents")
async def list_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    limit: int = 200,
    context: TenantContext = Depends(get_tenant_context),
):
    """List incidents for the current tenant (admins see all, staff see their own)."""
    query = {"tenant_id": context.tenant_id}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    if vehicle_id:
        query["car_id"] = vehicle_id
    # Staff: only see their own submissions
    if context.role not in ("admin", "master_admin", "super_admin"):
        query["reporter_user_id"] = context.user_id

    cursor = db.incidents.find(query, {"_id": 0}).sort("incident_date", -1).limit(limit)
    items = await cursor.to_list(limit)

    # Enrich with car + staff names
    car_ids = list({i.get("car_id") for i in items if i.get("car_id")})
    user_ids = list({i.get("staff_user_id") or i.get("reporter_user_id") for i in items
                     if i.get("staff_user_id") or i.get("reporter_user_id")})
    cars = {
        c["id"]: c
        for c in await db.vehicles.find(
            {"id": {"$in": car_ids}}, {"_id": 0, "id": 1, "name": 1, "registration": 1}
        ).to_list(1000)
    }
    users = {
        u["id"]: u
        for u in await db.users.find(
            {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}
        ).to_list(1000)
    }
    for i in items:
        c = cars.get(i.get("car_id")) or {}
        i["car_name"] = c.get("name")
        i["car_registration"] = c.get("registration")
        staff_id = i.get("staff_user_id") or i.get("reporter_user_id")
        u = users.get(staff_id) or {}
        i["staff_name"] = u.get("name")
        i["staff_email"] = u.get("email")

    return {"incidents": items, "total": len(items)}


@api_router.get("/incidents/stats")
async def incident_stats(context: TenantContext = Depends(require_admin)):
    """Aggregated counts for the admin incident dashboard."""
    tenant_id = context.tenant_id
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    year_ago = (now - timedelta(days=365)).isoformat()

    total = await db.incidents.count_documents({"tenant_id": tenant_id})
    week = await db.incidents.count_documents({"tenant_id": tenant_id, "incident_date": {"$gte": week_ago}})
    month = await db.incidents.count_documents({"tenant_id": tenant_id, "incident_date": {"$gte": month_ago}})
    year = await db.incidents.count_documents({"tenant_id": tenant_id, "incident_date": {"$gte": year_ago}})
    unresolved = await db.incidents.count_documents({"tenant_id": tenant_id, "status": "open"})

    # Breakdown by severity, type, car, staff
    all_items = await db.incidents.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "severity": 1, "type": 1, "car_id": 1, "staff_user_id": 1, "reporter_user_id": 1},
    ).to_list(10000)

    def _count_by(key, rows, transform=None):
        out = {}
        for r in rows:
            v = r.get(key)
            if transform:
                v = transform(v)
            if v is None:
                continue
            out[v] = out.get(v, 0) + 1
        return out

    by_severity = _count_by("severity", all_items)
    by_type = _count_by("type", all_items)

    # Per car (resolve names)
    by_car_raw = _count_by("car_id", all_items)
    car_ids = list(by_car_raw.keys())
    cars = {
        c["id"]: c for c in await db.vehicles.find(
            {"id": {"$in": car_ids}}, {"_id": 0, "id": 1, "name": 1, "registration": 1}
        ).to_list(1000)
    }
    by_car = [
        {"car_id": cid, "name": cars.get(cid, {}).get("name", "Unknown"),
         "registration": cars.get(cid, {}).get("registration"), "count": cnt}
        for cid, cnt in sorted(by_car_raw.items(), key=lambda x: -x[1])
    ]

    # Per staff (use staff_user_id if set, else reporter_user_id)
    staff_counts = {}
    for r in all_items:
        sid = r.get("staff_user_id") or r.get("reporter_user_id")
        if sid:
            staff_counts[sid] = staff_counts.get(sid, 0) + 1
    users = {
        u["id"]: u for u in await db.users.find(
            {"id": {"$in": list(staff_counts.keys())}}, {"_id": 0, "id": 1, "name": 1}
        ).to_list(1000)
    }
    by_staff = [
        {"user_id": uid, "name": users.get(uid, {}).get("name", "Unknown"), "count": cnt}
        for uid, cnt in sorted(staff_counts.items(), key=lambda x: -x[1])
    ]

    return {
        "this_week": week,
        "this_month": month,
        "this_year": year,
        "total": total,
        "unresolved": unresolved,
        "by_severity": by_severity,
        "by_type": by_type,
        "by_car": by_car,
        "by_staff": by_staff,
    }


@api_router.post("/incidents")
async def create_incident(
    payload: dict,
    context: TenantContext = Depends(get_tenant_context),
    request: Request = None,
):
    """Log a new incident. Accepts submissions from both staff and admins."""
    # Required fields
    car_id = payload.get("car_id")
    incident_date = payload.get("incident_date") or datetime.now(timezone.utc).date().isoformat()
    incident_type = (payload.get("type") or "Damage").strip()
    severity = (payload.get("severity") or "minor").strip().lower()
    description = (payload.get("description") or "").strip()

    if not car_id:
        raise HTTPException(status_code=400, detail="Car is required")
    if incident_type not in INCIDENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Type must be one of {INCIDENT_TYPES}")
    if severity not in INCIDENT_SEVERITIES:
        raise HTTPException(status_code=400, detail=f"Severity must be one of {INCIDENT_SEVERITIES}")

    car = await db.vehicles.find_one({"id": car_id, "tenant_id": context.tenant_id}, {"_id": 0, "id": 1})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found for this tenant")

    # Photos — list of base64 data-url strings, cap at 5
    photos = payload.get("photos") or []
    if not isinstance(photos, list):
        photos = []
    photos = photos[:5]

    # staff_user_id: who was involved (admin may log on behalf of staff)
    staff_user_id = payload.get("staff_user_id") or context.user_id

    incident = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,
        "car_id": car_id,
        "staff_user_id": staff_user_id,
        "reporter_user_id": context.user_id,
        "incident_date": incident_date,
        "type": incident_type,
        "severity": severity,
        "location": (payload.get("location") or "").strip() or None,
        "estimated_cost": payload.get("estimated_cost") or None,
        "police_report_number": (payload.get("police_report_number") or "").strip() or None,
        "insurance_claim_number": (payload.get("insurance_claim_number") or "").strip() or None,
        "description": description,
        "photos": photos,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.incidents.insert_one(incident)
    # Remove Mongo's injected _id from the dict before returning as JSON
    incident.pop("_id", None)

    # Fire dashboard notification to all tenant admins (best-effort)
    try:
        admin_memberships = await db.memberships.find(
            {"tenant_id": context.tenant_id, "role": {"$in": ["admin", "master_admin"]}},
            {"_id": 0, "user_id": 1},
        ).to_list(500)
        reporter = await db.users.find_one({"id": context.user_id}, {"_id": 0, "name": 1}) or {}
        reporter_name = reporter.get("name", "A staff member")
        for m in admin_memberships:
            if m["user_id"] == context.user_id:
                continue  # don't notify the person who submitted it
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "tenant_id": context.tenant_id,
                "user_id": m["user_id"],
                "type": "incident_reported",
                "title": f"New {severity} incident reported",
                "message": f"{reporter_name} reported a {incident_type.lower()} involving a vehicle.",
                "link": "/reports/incidents",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    except Exception:
        pass

    try:
        await audit_service.log(
            actor_user_id=context.user_id, actor_email=context.user_email,
            action=AuditAction.VEHICLE_UPDATED, tenant_id=context.tenant_id,
            resource_type="incident", resource_id=incident["id"],
            ip_address=request.client.host if request and request.client else None,
            meta={"severity": severity, "type": incident_type, "car_id": car_id},
        )
    except Exception:
        pass

    return {"incident": incident, "message": "Incident logged"}


@api_router.patch("/incidents/{incident_id}")
async def update_incident(
    incident_id: str,
    payload: dict,
    context: TenantContext = Depends(require_admin),
):
    """Admin: edit or resolve an incident."""
    existing = await db.incidents.find_one(
        {"id": incident_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")

    allowed = {
        "type", "severity", "location", "estimated_cost",
        "police_report_number", "insurance_claim_number",
        "description", "status", "staff_user_id",
    }
    updates = {k: v for k, v in payload.items() if k in allowed}
    if "severity" in updates and updates["severity"] not in INCIDENT_SEVERITIES:
        raise HTTPException(status_code=400, detail="Invalid severity")
    if "status" in updates and updates["status"] not in INCIDENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if "type" in updates and updates["type"] not in INCIDENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if updates.get("status") == "resolved" and existing.get("status") != "resolved":
        updates["resolved_at"] = updates["updated_at"]
        updates["resolved_by"] = context.user_id

    await db.incidents.update_one(
        {"id": incident_id, "tenant_id": context.tenant_id},
        {"$set": updates},
    )
    return {"message": "Incident updated", "incident_id": incident_id}


@api_router.delete("/incidents/{incident_id}")
async def delete_incident(
    incident_id: str,
    context: TenantContext = Depends(require_admin),
):
    """Admin: delete an incident."""
    res = await db.incidents.delete_one(
        {"id": incident_id, "tenant_id": context.tenant_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"message": "Incident deleted"}


@api_router.get("/incidents/export")
async def export_incidents_csv(context: TenantContext = Depends(require_admin)):
    """Admin: export all incidents as CSV."""
    from io import StringIO as _StringIO
    import csv as _csv

    items = await db.incidents.find(
        {"tenant_id": context.tenant_id}, {"_id": 0}
    ).sort("incident_date", -1).to_list(10000)

    car_ids = list({i.get("car_id") for i in items if i.get("car_id")})
    user_ids = list({i.get("staff_user_id") or i.get("reporter_user_id") for i in items})
    cars = {c["id"]: c for c in await db.vehicles.find(
        {"id": {"$in": car_ids}}, {"_id": 0, "id": 1, "name": 1, "registration": 1}
    ).to_list(5000)}
    users = {u["id"]: u for u in await db.users.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(5000)}

    out = _StringIO()
    w = _csv.writer(out)
    w.writerow([
        "date", "type", "severity", "status", "car_name", "car_registration",
        "staff", "location", "estimated_cost", "police_report", "insurance_claim",
        "description", "created_at", "resolved_at",
    ])
    for i in items:
        c = cars.get(i.get("car_id"), {})
        u = users.get(i.get("staff_user_id") or i.get("reporter_user_id"), {})
        w.writerow([
            i.get("incident_date"), i.get("type"), i.get("severity"), i.get("status"),
            c.get("name", ""), c.get("registration", ""), u.get("name", ""),
            i.get("location") or "", i.get("estimated_cost") or "",
            i.get("police_report_number") or "", i.get("insurance_claim_number") or "",
            (i.get("description") or "").replace("\n", " ")[:500],
            i.get("created_at", ""), i.get("resolved_at", ""),
        ])
    return Response(
        content=out.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=incidents-{context.tenant_slug}.csv"},
    )


@api_router.get("/incidents/export-pdf")
async def export_incidents_pdf(
    incident_id: Optional[str] = None,
    context: TenantContext = Depends(require_admin),
):
    """Admin: export incidents as a PDF (optionally a single incident with photos).
    
    If `incident_id` is provided, exports a detailed single-incident report with photos.
    Otherwise, exports a summary PDF of all incidents for the tenant (no photos — table only).
    """
    from io import BytesIO
    import base64 as _b64
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm, cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage,
        PageBreak,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title", parent=styles["Heading1"], fontSize=18, textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )
    h2 = ParagraphStyle(
        "h2", parent=styles["Heading2"], fontSize=11, textColor=colors.HexColor("#dc2626"),
        spaceAfter=4, spaceBefore=10,
    )
    label = ParagraphStyle(
        "label", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748b"),
    )
    body = ParagraphStyle(
        "body", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e293b"),
    )
    small = ParagraphStyle(
        "small", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748b"),
    )

    # Fetch incidents
    if incident_id:
        items = await db.incidents.find(
            {"id": incident_id, "tenant_id": context.tenant_id}, {"_id": 0}
        ).to_list(1)
        if not items:
            raise HTTPException(status_code=404, detail="Incident not found")
    else:
        items = await db.incidents.find(
            {"tenant_id": context.tenant_id}, {"_id": 0}
        ).sort("incident_date", -1).to_list(500)

    # Enrich with car + staff names (same as CSV export)
    car_ids = list({i.get("car_id") for i in items if i.get("car_id")})
    user_ids = list({i.get("staff_user_id") or i.get("reporter_user_id") for i in items})
    cars = {c["id"]: c for c in await db.vehicles.find(
        {"id": {"$in": car_ids}}, {"_id": 0, "id": 1, "name": 1, "registration": 1}
    ).to_list(5000)}
    users = {u["id"]: u for u in await db.users.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}
    ).to_list(5000)}

    # Tenant name for header
    tenant = await db.tenants.find_one({"id": context.tenant_id}, {"_id": 0, "name": 1}) or {}
    tenant_name = tenant.get("name", "Tenant")

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        title=f"Incident Report — {tenant_name}",
    )
    story = []

    # Header
    story.append(Paragraph(f"Quick Wing — Incident Report", title_style))
    story.append(Paragraph(
        f"<b>{tenant_name}</b> &nbsp;·&nbsp; Generated {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}",
        small,
    ))
    story.append(Spacer(1, 8))

    def _fmt(v, default="—"):
        return v if (v is not None and str(v).strip() != "") else default

    def _decode_photo(data_url):
        """Turn a data: URL into a PIL-ready byte buffer for reportlab."""
        if not isinstance(data_url, str) or not data_url.startswith("data:"):
            return None
        try:
            header, b64part = data_url.split(",", 1)
            raw = _b64.b64decode(b64part)
            return BytesIO(raw)
        except Exception:
            return None

    # --- Detailed: single incident w/ photos ---
    if incident_id and items:
        inc = items[0]
        car = cars.get(inc.get("car_id"), {})
        usr = users.get(inc.get("staff_user_id") or inc.get("reporter_user_id"), {})

        severity_hex = {
            "minor": "#d97706",
            "moderate": "#ea580c",
            "severe": "#dc2626",
        }
        sev = (inc.get("severity") or "minor").lower()

        story.append(Paragraph("Incident Details", h2))
        facts = [
            ["Date", _fmt(inc.get("incident_date"))],
            ["Type", _fmt(inc.get("type"))],
            ["Severity",
                f"<font color='{severity_hex.get(sev, '#000000')}'><b>{sev.upper()}</b></font>"],
            ["Status", _fmt((inc.get("status") or "open")).upper()],
            ["Vehicle", f"{_fmt(car.get('name'))}  <font color='#94a3b8'>({_fmt(car.get('registration'))})</font>"],
            ["Staff involved", _fmt(usr.get("name") or usr.get("email"))],
            ["Location", _fmt(inc.get("location"))],
            ["Estimated cost", f"€{inc.get('estimated_cost'):.2f}" if inc.get("estimated_cost") is not None else "—"],
            ["Police report #", _fmt(inc.get("police_report_number"))],
            ["Insurance claim #", _fmt(inc.get("insurance_claim_number"))],
        ]
        facts_data = [[Paragraph(k, label), Paragraph(str(v), body)] for k, v in facts]
        t = Table(facts_data, colWidths=[45*mm, None])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#e2e8f0")),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

        # Description
        if inc.get("description"):
            story.append(Paragraph("Description", h2))
            story.append(Paragraph(
                (inc["description"] or "").replace("\n", "<br/>"), body,
            ))
            story.append(Spacer(1, 8))

        # Photos
        photos = inc.get("photos") or []
        if photos:
            story.append(Paragraph(f"Photos ({len(photos)})", h2))
            img_rows = []
            row = []
            max_w = 80*mm
            max_h = 60*mm
            for i, p in enumerate(photos):
                bio = _decode_photo(p)
                if not bio:
                    continue
                try:
                    img = RLImage(bio, width=max_w, height=max_h, kind="proportional")
                except Exception:
                    continue
                row.append(img)
                if len(row) == 2:
                    img_rows.append(row)
                    row = []
            if row:
                row.append("")
                img_rows.append(row)
            if img_rows:
                pt = Table(img_rows, colWidths=[90*mm, 90*mm])
                pt.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                ]))
                story.append(pt)

        filename = f"incident-{incident_id[:8]}.pdf"

    else:
        # --- Summary: all incidents as a table ---
        story.append(Paragraph(f"All Incidents ({len(items)})", h2))
        if not items:
            story.append(Paragraph("No incidents recorded.", body))
        else:
            header_row = [
                Paragraph("<b>Date</b>", small),
                Paragraph("<b>Type</b>", small),
                Paragraph("<b>Car</b>", small),
                Paragraph("<b>Staff</b>", small),
                Paragraph("<b>Sev.</b>", small),
                Paragraph("<b>Status</b>", small),
                Paragraph("<b>Cost</b>", small),
            ]
            table_data = [header_row]
            for inc in items:
                car = cars.get(inc.get("car_id"), {})
                usr = users.get(inc.get("staff_user_id") or inc.get("reporter_user_id"), {})
                table_data.append([
                    Paragraph(str(inc.get("incident_date") or "—"), small),
                    Paragraph(str(inc.get("type") or "—"), small),
                    Paragraph(f"{_fmt(car.get('name'))}<br/><font color='#94a3b8' size='7'>{_fmt(car.get('registration'))}</font>", small),
                    Paragraph(str(usr.get("name") or "—"), small),
                    Paragraph(str(inc.get("severity") or "—").capitalize(), small),
                    Paragraph(str(inc.get("status") or "—").capitalize(), small),
                    Paragraph(f"€{inc['estimated_cost']:.0f}" if inc.get("estimated_cost") is not None else "—", small),
                ])
            tt = Table(
                table_data,
                colWidths=[22*mm, 22*mm, 42*mm, 34*mm, 18*mm, 18*mm, 18*mm],
                repeatRows=1,
            )
            tt.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ]))
            story.append(tt)

        filename = f"incidents-{context.tenant_slug}.pdf"

    # Footer
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        f"<font color='#94a3b8'>Quick Wing Fleet Management · quick-wing.com · Confidential</font>",
        small,
    ))

    doc.build(story)
    buf.seek(0)

    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )











@api_router.get("/vehicles")
async def list_vehicles(
    skip: int = 0,
    limit: int = 100,
    context: TenantContext = Depends(require_tenant_context)
):
    """List vehicles in the current tenant with real-time booking status.

    Cached for 15s per (tenant, skip, limit) tuple. The active-booking
    overlay means we keep TTL short so a freshly-started/ended booking
    becomes visible within ~15s without manual invalidation. Mutations
    (create/update/delete/block/unblock vehicles) explicitly invalidate
    the tenant prefix so admin changes are reflected instantly.
    """
    cache_key = vehicles_key(context.tenant_id, skip, limit)
    cached = await ttl_cache.get(cache_key)
    if cached is not None:
        return cached

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
    
    await ttl_cache.set(cache_key, vehicles, ttl=15)
    return vehicles


# ==================== INSPECTION REMINDERS ====================
# Admins configure `inspection_frequency_days` per vehicle. This endpoint
# returns each configured vehicle's inspection status (last submitted,
# days_since, is_overdue) so the dashboard can surface overdue cars.


@api_router.get("/vehicles/inspection-status")
async def get_inspection_status(
    context: TenantContext = Depends(require_tenant_context),
):
    """Return inspection status for every vehicle with a configured
    `inspection_frequency_days`. Requires an active Car Inspection Sheet
    template (auto-seeded on first Documents visit).

    Response shape:
      {
        "template_id": "...",  # None if no Car Inspection template yet
        "vehicles": [
          {
            "vehicle_id": "...",
            "name": "Ford Focus",
            "registration": "FF12AB",
            "frequency_days": 7,
            "last_inspection_at": "2026-02-01T09:30:00+00:00",  # or None
            "days_since": 5,           # None if never inspected
            "is_overdue": false,
            "next_due": "2026-02-08"
          }
        ],
        "overdue_count": 2,
        "due_soon_count": 1,   # due within 24 hours
      }
    """
    await _seed_builtin_templates_if_missing(context.tenant_id)

    template = await db.document_templates.find_one(
        {"tenant_id": context.tenant_id, "name": "Car Inspection Sheet"},
        {"_id": 0, "id": 1},
    )
    template_id = template.get("id") if template else None

    vehicles_cursor = db.vehicles.find(
        {
            "tenant_id": context.tenant_id,
            "inspection_frequency_days": {"$gt": 0},
        },
        {"_id": 0, "id": 1, "name": 1, "registration": 1,
         "inspection_frequency_days": 1},
    )
    vehicles = await vehicles_cursor.to_list(length=500)

    now = datetime.now(timezone.utc)
    out = []
    overdue_count = 0
    due_soon_count = 0

    for v in vehicles:
        frequency = int(v.get("inspection_frequency_days") or 0)
        if frequency <= 0:
            continue

        last_submission = None
        if template_id:
            last_submission = await db.document_submissions.find_one(
                {
                    "tenant_id": context.tenant_id,
                    "template_id": template_id,
                    "vehicle_id": v["id"],
                },
                {"_id": 0, "created_at": 1},
                sort=[("created_at", -1)],
            )

        last_at = last_submission.get("created_at") if last_submission else None
        days_since = None
        is_overdue = True  # never inspected = overdue
        next_due_iso = None
        hours_to_due = None

        if last_at:
            try:
                last_dt = last_at if isinstance(last_at, datetime) else datetime.fromisoformat(
                    str(last_at).replace("Z", "+00:00")
                )
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                delta = now - last_dt
                days_since = delta.days
                next_due_dt = last_dt + timedelta(days=frequency)
                next_due_iso = next_due_dt.date().isoformat()
                is_overdue = now >= next_due_dt
                hours_to_due = (next_due_dt - now).total_seconds() / 3600.0
            except Exception:
                is_overdue = True
        else:
            next_due_iso = now.date().isoformat()

        if is_overdue:
            overdue_count += 1
        elif hours_to_due is not None and 0 <= hours_to_due <= 24:
            due_soon_count += 1

        out.append({
            "vehicle_id": v["id"],
            "name": v.get("name"),
            "registration": v.get("registration"),
            "frequency_days": frequency,
            "last_inspection_at": (
                last_at.isoformat() if isinstance(last_at, datetime) else last_at
            ),
            "days_since": days_since,
            "is_overdue": is_overdue,
            "next_due": next_due_iso,
        })

    def _sort_key(row):
        if row["is_overdue"]:
            days = row["days_since"]
            return (0, -(days if days is not None else 9999))
        return (1, row.get("next_due") or "")

    out.sort(key=_sort_key)

    return {
        "template_id": template_id,
        "vehicles": out,
        "overdue_count": overdue_count,
        "due_soon_count": due_soon_count,
    }


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
        await ttl_cache.invalidate_prefix(tenant_prefix(context.tenant_id))
    
    updated = await db.vehicles.find_one(query, {"_id": 0})
    return updated


@api_router.post("/vehicles/{vehicle_id}/drop-off")
async def set_vehicle_drop_off(
    vehicle_id: str,
    data: DropOffLocation,
    context: TenantContext = Depends(require_admin)
):
    """Record where a vehicle was dropped off (Eircode + optional label)."""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    eircode = (data.eircode or "").strip().upper()
    label = (data.label or "").strip()

    await db.vehicles.update_one(query, {"$set": {
        "current_location_eircode": eircode or None,
        "current_location_label": label or None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    await ttl_cache.invalidate_prefix(tenant_prefix(context.tenant_id))

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
    await ttl_cache.invalidate_prefix(tenant_prefix(context.tenant_id))
    
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
    await ttl_cache.invalidate_prefix(tenant_prefix(context.tenant_id))
    
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
    await ttl_cache.invalidate_prefix(tenant_prefix(context.tenant_id))
    
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
    
    # Parse dates for recurring check
    start_time = datetime.fromisoformat(booking_data.start_time.replace('Z', '+00:00'))
    end_time = datetime.fromisoformat(booking_data.end_time.replace('Z', '+00:00'))

    # ============ VEHICLE COMPLIANCE CHECK ============
    # Block bookings for vehicles whose NCT or tax expires before the
    # booking ends. Keeps non-roadworthy cars off the road.
    booking_end_date = end_time.date()
    compliance_failures = []
    for field, label in [("nct_due_date", "NCT"), ("tax_due_date", "Tax")]:
        raw = vehicle.get(field)
        if not raw:
            continue
        try:
            # Accept either YYYY-MM-DD or full ISO timestamps.
            due_date = datetime.fromisoformat(str(raw).split("T")[0]).date()
        except (ValueError, TypeError):
            continue
        if due_date < booking_end_date:
            compliance_failures.append({
                "field": field,
                "label": label,
                "expired_on": due_date.isoformat(),
            })

    if compliance_failures:
        labels = ", ".join(f["label"] for f in compliance_failures)
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"Cannot book this vehicle — {labels} "
                    f"{'has' if len(compliance_failures) == 1 else 'have'} expired before the booking end date."
                ),
                "code": "compliance_expired",
                "compliance_failures": compliance_failures,
                "vehicle_registration": vehicle.get("registration"),
            }
        )
    # =================================================

    # ============ DRIVER DOUBLE-BOOKING CHECK ============
    # Prevent the same person from being booked into two vehicles at the
    # same time (whether as primary or secondary driver). They can't be
    # in two cars at once.
    driver_conflict_query = {
        "tenant_id": context.tenant_id,
        "start_time": {"$lt": booking_data.end_time},
        "end_time": {"$gt": booking_data.start_time},
        "status": {"$nin": ["rejected", "cancelled"]},
        "$or": [
            {"user_id": context.user_id},
            {"secondary_user_id": context.user_id},
        ],
    }
    existing_driver_booking = await db.bookings.find_one(driver_conflict_query, {"_id": 0})
    if existing_driver_booking:
        other_car_id = existing_driver_booking.get("car_id")
        other_vehicle = await db.vehicles.find_one(
            {"id": other_car_id, "tenant_id": context.tenant_id},
            {"_id": 0, "name": 1, "registration": 1},
        ) if other_car_id else None
        other_label = (
            f"{other_vehicle.get('name', 'another car')} ({other_vehicle.get('registration', '')})"
            if other_vehicle else "another car"
        )
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"You are already booked into {other_label} during that time slot. "
                    "A driver can only be in one vehicle at a time."
                ),
                "code": "driver_double_booking",
                "existing_booking": {
                    "car_id": other_car_id,
                    "start_time": existing_driver_booking.get("start_time"),
                    "end_time": existing_driver_booking.get("end_time"),
                },
            }
        )
    # =====================================================

    # ============ VEHICLE CONFLICT CHECK ============
    # Check if this vehicle is already booked during the requested time period
    vehicle_conflict_query = {
        "tenant_id": context.tenant_id,
        "car_id": booking_data.car_id,
        "start_time": {"$lt": booking_data.end_time},
        "end_time": {"$gt": booking_data.start_time},
        "status": {"$nin": ["rejected", "cancelled"]}
    }
    existing_vehicle_booking = await db.bookings.find_one(vehicle_conflict_query, {"_id": 0})
    if existing_vehicle_booking:
        existing_start = existing_vehicle_booking.get('start_time', '')
        existing_user = existing_vehicle_booking.get('user_name', 'Another user')
        
        # Find alternative cars that ARE available at this time
        # Get all tenant vehicles that are not blocked
        all_vehicles = await db.vehicles.find(
            {"tenant_id": context.tenant_id, "is_blocked": {"$ne": True}},
            {"_id": 0, "id": 1, "name": 1, "registration": 1}
        ).to_list(100)
        
        # Find which cars have conflicting bookings
        conflicting_bookings = await db.bookings.find({
            "tenant_id": context.tenant_id,
            "start_time": {"$lt": booking_data.end_time},
            "end_time": {"$gt": booking_data.start_time},
            "status": {"$nin": ["rejected", "cancelled"]}
        }, {"_id": 0, "car_id": 1}).to_list(100)
        
        booked_car_ids = set(b["car_id"] for b in conflicting_bookings)
        
        # Available cars are those not in the booked list
        available_cars = [
            {"id": v["id"], "name": v["name"], "registration": v.get("registration", "")}
            for v in all_vehicles 
            if v["id"] not in booked_car_ids
        ]
        
        # Return error with recommendations
        raise HTTPException(
            status_code=409,  # Conflict status code
            detail={
                "message": f"Vehicle is already booked at this time by {existing_user} (starts: {existing_start})",
                "conflict": {
                    "booked_by": existing_user,
                    "start_time": existing_start,
                    "end_time": existing_vehicle_booking.get('end_time', '')
                },
                "available_cars": available_cars[:5],  # Limit to 5 suggestions
                "total_available": len(available_cars)
            }
        )
    # ================================================
    
    # Check if recurring booking exceeds 4 weeks (requires admin approval)
    requires_approval = False
    if booking_data.is_recurring and booking_data.recurrence_end_date:
        recurrence_end = datetime.fromisoformat(booking_data.recurrence_end_date.replace('Z', '+00:00'))
        weeks_duration = (recurrence_end - start_time).days / 7
        if weeks_duration > 4:
            requires_approval = True
    
    # If double-up call with secondary user, check for conflicts
    if booking_data.is_double_up_call and booking_data.secondary_user_id:
        # Check if secondary user has any booking at the same time (for any car)
        conflict_query = {
            "tenant_id": context.tenant_id,
            "$or": [
                {"created_by_user_id": booking_data.secondary_user_id},
                {"secondary_user_id": booking_data.secondary_user_id},
                {"user_name": booking_data.secondary_user_name}
            ],
            "start_time": {"$lt": booking_data.end_time},
            "end_time": {"$gt": booking_data.start_time},
            "status": {"$nin": ["rejected", "cancelled"]}
        }
        existing_booking = await db.bookings.find_one(conflict_query, {"_id": 0})
        if existing_booking:
            raise HTTPException(
                status_code=400, 
                detail=f"Secondary user already has a booking at this time ({existing_booking.get('user_name')} - {existing_booking.get('car_id')})"
            )
    
    # Also check primary user for conflicts.
    # Skip this check if the admin is booking on behalf of someone else —
    # the admin's own calendar is irrelevant in that case (only the
    # assignee's calendar matters, which we check separately below).
    is_assigning_to_other = (
        booking_data.assigned_to_user_id
        and booking_data.assigned_to_user_id != context.user_id
    )
    if not is_assigning_to_other:
        primary_conflict_query = {
            "tenant_id": context.tenant_id,
            "$or": [
                {"created_by_user_id": context.user_id},
                {"secondary_user_id": context.user_id}
            ],
            "start_time": {"$lt": booking_data.end_time},
            "end_time": {"$gt": booking_data.start_time},
            "status": {"$nin": ["rejected", "cancelled"]}
        }
        primary_existing = await db.bookings.find_one(primary_conflict_query, {"_id": 0})
        if primary_existing:
            raise HTTPException(
                status_code=400,
                detail=f"You already have a booking at this time ({primary_existing.get('car_id')})"
            )

    # ============ ASSIGN TO (ADMIN-ONLY) ============
    # Admins can book a car on behalf of another staff member or admin.
    # The assignee will see this booking in their own "My Bookings" list.
    assigned_user_doc = None
    if booking_data.assigned_to_user_id and booking_data.assigned_to_user_id != context.user_id:
        # Only admins/master_admins are allowed to assign bookings to others.
        if context.role not in (UserRole.ADMIN, UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN):
            raise HTTPException(
                status_code=403,
                detail="Only admins can assign a booking to another user."
            )
        assigned_user_doc = await db.users.find_one(
            {"id": booking_data.assigned_to_user_id}, {"_id": 0}
        )
        if not assigned_user_doc:
            raise HTTPException(status_code=404, detail="Assigned user not found")
        # Verify the assignee is actually a member of this tenant (memberships
        # are stored in their own collection, not embedded on the user doc).
        membership = await db.memberships.find_one({
            "user_id": booking_data.assigned_to_user_id,
            "tenant_id": context.tenant_id,
        })
        if not membership or membership.get("is_active") is False:
            raise HTTPException(
                status_code=400,
                detail="Assigned user is not a member of this tenant."
            )
        # Check assignee for time conflicts (don't double-book the person).
        assignee_conflict_query = {
            "tenant_id": context.tenant_id,
            "$or": [
                {"created_by_user_id": booking_data.assigned_to_user_id},
                {"secondary_user_id": booking_data.assigned_to_user_id},
                {"assigned_to_user_id": booking_data.assigned_to_user_id},
            ],
            "start_time": {"$lt": booking_data.end_time},
            "end_time": {"$gt": booking_data.start_time},
            "status": {"$nin": ["rejected", "cancelled"]},
        }
        assignee_existing = await db.bookings.find_one(assignee_conflict_query, {"_id": 0})
        if assignee_existing:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{assigned_user_doc.get('name') or 'That user'} already has a "
                    f"booking at this time ({assignee_existing.get('user_name')} - "
                    f"{assignee_existing.get('car_id')})"
                ),
            )

    # Determine booking status
    booking_status = "pending" if requires_approval else "approved"

    payload = booking_data.model_dump()
    # When an admin assigns the booking, force user_name to the assignee's
    # actual stored name so the booking shows the right owner everywhere
    # (calendar pills, Live Sheet, /bookings list, staff app).
    if assigned_user_doc:
        payload["user_name"] = assigned_user_doc.get("name") or payload.get("user_name") or ""

    booking = {
        "id": str(uuid.uuid4()),
        "tenant_id": context.tenant_id,  # CRITICAL: Set tenant_id from context
        **payload,
        "status": booking_status,
        "requires_approval": requires_approval,
        "created_by_email": context.user_email,
        "created_by_user_id": context.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.bookings.insert_one(booking)

    return {k: v for k, v in booking.items() if k != "_id"}



@api_router.get("/bookings/check-availability")
async def check_booking_availability(
    car_id: str,
    start_time: str,
    end_time: str,
    context: TenantContext = Depends(require_tenant_context)
):
    """
    Check if a car is available at the requested time and get recommendations.
    Returns conflict info and available alternatives if the requested car is booked.
    """
    # Check if requested car has conflicts
    vehicle_conflict_query = {
        "tenant_id": context.tenant_id,
        "car_id": car_id,
        "start_time": {"$lt": end_time},
        "end_time": {"$gt": start_time},
        "status": {"$nin": ["rejected", "cancelled"]}
    }
    existing_booking = await db.bookings.find_one(vehicle_conflict_query, {"_id": 0})
    
    # Get requested car details
    requested_car = await db.vehicles.find_one(
        {"tenant_id": context.tenant_id, "id": car_id},
        {"_id": 0, "id": 1, "name": 1, "registration": 1}
    )
    
    if existing_booking:
        # Car is booked - find alternatives
        all_vehicles = await db.vehicles.find(
            {"tenant_id": context.tenant_id, "is_blocked": {"$ne": True}},
            {"_id": 0, "id": 1, "name": 1, "registration": 1}
        ).to_list(100)
        
        # Find which cars have conflicting bookings
        conflicting_bookings = await db.bookings.find({
            "tenant_id": context.tenant_id,
            "start_time": {"$lt": end_time},
            "end_time": {"$gt": start_time},
            "status": {"$nin": ["rejected", "cancelled"]}
        }, {"_id": 0, "car_id": 1}).to_list(100)
        
        booked_car_ids = set(b["car_id"] for b in conflicting_bookings)
        
        available_cars = [
            {"id": v["id"], "name": v["name"], "registration": v.get("registration", "")}
            for v in all_vehicles 
            if v["id"] not in booked_car_ids
        ]
        
        return {
            "available": False,
            "requested_car": requested_car,
            "conflict": {
                "booked_by": existing_booking.get("user_name", "Another user"),
                "start_time": existing_booking.get("start_time"),
                "end_time": existing_booking.get("end_time"),
                "booking_id": existing_booking.get("id")
            },
            "recommended_cars": available_cars[:5],
            "total_available": len(available_cars)
        }
    
    return {
        "available": True,
        "requested_car": requested_car,
        "conflict": None,
        "recommended_cars": [],
        "total_available": 0
    }



@api_router.get("/bookings")
async def list_bookings(
    status: Optional[str] = None,
    car_id: Optional[str] = None,
    user_id: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    include_secondary: bool = True,
    skip: int = 0,
    limit: int = 2000,
    context: TenantContext = Depends(require_tenant_context)
):
    """List bookings in the current tenant.

    Default limit raised to 2000 so multi-month calendar views and active
    recurring schedules render the same data set across the Bookings page,
    the Fleet > All Cars Calendar, and the Car Calendars grid. Clients can
    pass a smaller `limit` query param if needed.

    Date window: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (or full ISO) returns only
    bookings that overlap that window — i.e. `start_time < to AND end_time > from`.
    Useful for the calendar / Live Sheet so a month view only pulls a month
    of rows instead of the full 2000-row history.
    """
    query = {"tenant_id": context.tenant_id}

    if status:
        query["status"] = status
    if car_id:
        query["car_id"] = car_id

    # If user_id is specified, include bookings where they are primary,
    # secondary, OR the assignee (admin booked the car on their behalf).
    if user_id and include_secondary:
        query["$or"] = [
            {"created_by_user_id": user_id},
            {"secondary_user_id": user_id},
            {"assigned_to_user_id": user_id},
        ]
    elif user_id:
        query["$or"] = [
            {"created_by_user_id": user_id},
            {"assigned_to_user_id": user_id},
        ]

    # Overlap filter: a booking overlaps the window [from_date, to_date) iff
    # start_time < to AND end_time > from. Times are stored as ISO-8601
    # strings, which compare correctly lexicographically.
    if from_date:
        query["end_time"] = {"$gt": from_date}
    if to_date:
        query["start_time"] = {"$lt": to_date}

    bookings = await db.bookings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return bookings


@api_router.get("/bookings/pending-approval")
async def get_pending_approval_bookings(
    context: TenantContext = Depends(require_admin)
):
    """Get bookings that require admin approval (recurring > 4 weeks).
    Declared BEFORE /bookings/{booking_id} so the literal path is not
    captured by the parameterised route."""
    query = {
        "tenant_id": context.tenant_id,
        "requires_approval": True,
        "status": "pending"
    }
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(100)
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
    
    # Staff can edit a booking if they created it OR it was assigned to them
    # by an admin. (Admins/master_admins can edit anything.)
    if context.role == UserRole.STAFF and booking.get("created_by_user_id") != context.user_id \
            and booking.get("assigned_to_user_id") != context.user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own bookings")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    # If time or vehicle is being changed, check for conflicts
    if update_dict:
        new_start = update_dict.get('start_time', booking.get('start_time'))
        new_end = update_dict.get('end_time', booking.get('end_time'))
        new_car_id = update_dict.get('car_id', booking.get('car_id'))
        
        # Check vehicle conflict (exclude current booking)
        vehicle_conflict_query = {
            "tenant_id": context.tenant_id,
            "car_id": new_car_id,
            "id": {"$ne": booking_id},  # Exclude current booking
            "start_time": {"$lt": new_end},
            "end_time": {"$gt": new_start},
            "status": {"$nin": ["rejected", "cancelled"]}
        }
        existing_vehicle_booking = await db.bookings.find_one(vehicle_conflict_query, {"_id": 0})
        if existing_vehicle_booking:
            existing_user = existing_vehicle_booking.get('user_name', 'Another user')
            raise HTTPException(
                status_code=400, 
                detail=f"Vehicle is already booked at this time by {existing_user}"
            )
        
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
    
    # Staff can delete a booking if they created it OR it was assigned to them.
    if context.role == UserRole.STAFF and booking.get("created_by_user_id") != context.user_id \
            and booking.get("assigned_to_user_id") != context.user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own bookings")
    
    await db.bookings.delete_one(query)
    
    return {"message": "Booking deleted"}


@api_router.post("/bookings/{booking_id}/approve")
async def approve_booking(
    booking_id: str,
    context: TenantContext = Depends(require_admin)
):
    """Approve a pending booking"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, booking_id)
    booking = await db.bookings.find_one(query, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    await db.bookings.update_one(query, {"$set": {"status": "approved"}})
    
    return {"message": "Booking approved", "booking_id": booking_id}


@api_router.post("/bookings/{booking_id}/reject")
async def reject_booking(
    booking_id: str,
    reason: Optional[str] = None,
    context: TenantContext = Depends(require_admin)
):
    """Reject a pending booking"""
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, booking_id)
    booking = await db.bookings.find_one(query, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update = {"status": "rejected"}
    if reason:
        update["rejection_reason"] = reason
    
    await db.bookings.update_one(query, {"$set": update})
    
    return {"message": "Booking rejected", "booking_id": booking_id}


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
    """List all configured locations for the tenant. Cached for 60s per tenant."""
    cached = await ttl_cache.get(locations_key(context.tenant_id))
    if cached is not None:
        return cached

    query = TenantQueryBuilder.scope(context.tenant_id)
    locations = await db.locations.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    response = {"locations": locations}
    await ttl_cache.set(locations_key(context.tenant_id), response, ttl=60)
    return response


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
    await ttl_cache.invalidate(locations_key(context.tenant_id))
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
    await ttl_cache.invalidate(locations_key(context.tenant_id))
    
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
    
    await ttl_cache.invalidate(locations_key(context.tenant_id))
    return {"message": "Location deleted"}


# ==================== VEHICLE AVAILABILITY ====================

@api_router.get("/vehicles/{vehicle_id}/availability")
async def get_vehicle_availability(
    vehicle_id: str,
    date: Optional[str] = None,
    view: str = "day",  # day, week, month
    context: TenantContext = Depends(require_tenant_context)
):
    """
    Get availability timeline for a specific vehicle.
    Returns hourly slots with status (available, booked, recurring, past).
    """
    # Verify vehicle exists
    query = TenantQueryBuilder.scope_by_id(context.tenant_id, vehicle_id)
    vehicle = await db.vehicles.find_one(query, {"_id": 0})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Parse date or use today
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        target_date = datetime.now(timezone.utc)
    
    # Determine date range based on view
    if view == "week":
        # Get start of week (Monday)
        start_of_week = target_date - timedelta(days=target_date.weekday())
        dates = [start_of_week + timedelta(days=i) for i in range(7)]
    elif view == "month":
        # Get all days in the month
        first_day = target_date.replace(day=1)
        if target_date.month == 12:
            last_day = target_date.replace(year=target_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            last_day = target_date.replace(month=target_date.month + 1, day=1) - timedelta(days=1)
        dates = [first_day + timedelta(days=i) for i in range((last_day - first_day).days + 1)]
    else:
        # Single day
        dates = [target_date]
    
    # Get all bookings for the date range
    start_range = dates[0].replace(hour=0, minute=0, second=0, microsecond=0)
    end_range = dates[-1].replace(hour=23, minute=59, second=59, microsecond=999999)
    
    bookings = await db.bookings.find({
        "tenant_id": context.tenant_id,
        "car_id": vehicle_id,
        "start_time": {"$lte": end_range.isoformat()},
        "end_time": {"$gte": start_range.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    now = datetime.now(timezone.utc)
    availability_data = []
    
    for day in dates:
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        hours = []
        
        # Generate hourly slots from 7am to 10pm
        for hour in range(7, 23):
            slot_start = day.replace(hour=hour, minute=0, second=0, microsecond=0)
            slot_end = day.replace(hour=hour, minute=59, second=59, microsecond=999999)
            
            # Default status
            status = "available"
            booked_by = None
            is_recurring = False
            
            # Check if slot is in the past
            slot_start_utc = slot_start.replace(tzinfo=timezone.utc)
            if slot_start_utc < now:
                status = "past"
            
            # Check bookings that overlap this slot
            for booking in bookings:
                try:
                    booking_start = datetime.fromisoformat(booking["start_time"].replace("Z", "+00:00"))
                    booking_end = datetime.fromisoformat(booking["end_time"].replace("Z", "+00:00"))
                    
                    slot_start_aware = slot_start.replace(tzinfo=timezone.utc)
                    slot_end_aware = slot_end.replace(tzinfo=timezone.utc)
                    
                    # Check overlap
                    if booking_start <= slot_end_aware and booking_end >= slot_start_aware:
                        is_recurring = booking.get("is_recurring", False)
                        status = "recurring" if is_recurring else "booked"
                        booked_by = booking.get("user_name", "Unknown")
                        break
                except:
                    continue
            
            hours.append({
                "hour": hour,
                "time_display": f"{hour:02d}:00",
                "status": status,
                "booked_by": booked_by,
                "is_recurring": is_recurring
            })
        
        availability_data.append({
            "date": day.strftime("%Y-%m-%d"),
            "date_display": day.strftime("%d %b"),
            "day_short": day.strftime("%a"),
            "hours": hours
        })
    
    return {
        "vehicle_id": vehicle_id,
        "vehicle_name": vehicle.get("name", vehicle.get("registration")),
        "view": view,
        "availability": availability_data
    }


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
    # Use stable public URL — must NOT use FRONTEND_URL (which may be the Emergent
    # deployment hostname) so QR codes always scan to the branded customer domain.
    base_url = get_public_url()
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

    # NOTE: Support Admin auto-seed disabled at customer request (May 2026).
    # The cross-tenant support@quickwing.com account caused confusion in
    # franchise team lists. Re-enable this line if Quick Wing ever needs an
    # off-site support backdoor again. The user record + memberships have
    # also been removed; uncommenting alone will re-create them on next boot.
    # await seed_support_admin()

    # Seed Malcolm's super admin account
    await seed_malcolm_admin()
    
    # Seed Open Claw bot account
    await seed_bot_account()

    # One-shot cleanup: remove the legacy shared "Quick Wing Demo Ltd" tenant
    # if it still exists. The demo model moved from one-shared-tenant-plus-
    # magic-links to per-demo-tenant creation (via the "Create Client" form).
    await cleanup_legacy_demo_tenant()

    # Start the SinoTrack bridge poller (Phase 2). Idempotent — safe if
    # startup runs twice under WatchFiles reload.
    try:
        from services import gps_poller
        gps_poller.start(db)
    except Exception as e:
        logger.error(f"Failed to start SinoTrack bridge: {e}")

    # Start the daily driver's licence reminder scheduler. Also idempotent.
    try:
        from services import licence_reminder_service
        licence_reminder_service.start(db)
    except Exception as e:
        logger.error(f"Failed to start licence reminder scheduler: {e}")
    
    # Fix any stale absolute logo URLs ('http://localhost:8001/...') left in
    # the DB from before the upload endpoint was switched to relative URLs.
    await fix_legacy_logo_urls()
    
    # Ensure indexes exist — each wrapped so one failure doesn't skip the rest
    index_specs = [
        # --- Tenant lookup & auth (critical path for every request) ---
        ("tenants", [("slug", 1)], {"unique": True}),
        ("users", "email", {"unique": True}),
        ("users", "id", {"unique": True}),
        ("memberships", [("user_id", 1), ("tenant_id", 1)], {}),
        ("memberships", [("tenant_id", 1)], {}),

        # --- Vehicles ---
        ("vehicles", [("tenant_id", 1), ("id", 1)], {}),
        ("vehicles", [("tenant_id", 1), ("registration", 1)], {}),  # bulk-import dedupe

        # --- Bookings (highest-volume collection — conflict checks + reports) ---
        ("bookings", [("tenant_id", 1), ("id", 1)], {}),
        ("bookings", [("tenant_id", 1), ("car_id", 1), ("start_time", 1), ("end_time", 1)],
            {"name": "booking_conflict_idx"}),
        ("bookings", [("tenant_id", 1), ("start_time", -1)], {}),  # date-range reports
        ("bookings", [("tenant_id", 1), ("user_id", 1), ("start_time", -1)], {}),

        # --- Mileage logs (high-volume, time-series) ---
        ("mileage_logs", [("tenant_id", 1), ("vehicle_id", 1), ("logged_at", -1)], {}),

        # --- Car statuses (live fleet sheet) ---
        ("car_statuses", [("tenant_id", 1), ("vehicle_id", 1)], {}),

        # --- Audit / messages / todos ---
        ("audit_events", [("tenant_id", 1), ("created_at", -1)], {}),
        ("messages", [("tenant_id", 1), ("created_at", -1)], {}),
        ("todos", [("tenant_id", 1), ("status", 1), ("due_date", 1)], {}),

        # --- Chatbot ---
        ("chatbot_conversations", [("session_id", 1)], {}),
        ("chatbot_leads", [("created_at", -1)], {}),
    ]
    created = 0
    for coll, keys, opts in index_specs:
        try:
            await db[coll].create_index(keys, **opts)
            created += 1
        except Exception as e:
            logger.debug(f"Index skip on {coll} {keys}: {e}")
    logger.info(f"Performance indexes ensured: {created}/{len(index_specs)} applied.")


async def fix_legacy_logo_urls():
    """One-time cleanup: tenant logos previously stored absolute URLs baked with
    'http://localhost:8001/...' (because the upload endpoint defaulted to that
    when REACT_APP_BACKEND_URL wasn't set in the backend env). Those URLs are
    blocked by browsers when the app is served over HTTPS in preview/prod, so
    rewrite them to relative '/api/uploads/logos/...' which works on any host.
    Safe to run on every startup — only matches stale absolute URLs.
    """
    import re as _re
    try:
        cursor = db.tenants.find(
            {"settings.logo_url": {"$regex": "^https?://(localhost|0\\.0\\.0\\.0|127\\.0\\.0\\.1)"}},
            {"_id": 0, "id": 1, "settings.logo_url": 1, "name": 1},
        )
        fixed = 0
        async for t in cursor:
            lu = (t.get("settings") or {}).get("logo_url") or ""
            # Strip scheme + host, keep the path
            rel = _re.sub(r"^https?://[^/]+", "", lu)
            if rel and rel != lu:
                await db.tenants.update_one(
                    {"id": t["id"]},
                    {"$set": {"settings.logo_url": rel}},
                )
                fixed += 1
        if fixed:
            logger.info(f"fix_legacy_logo_urls: rewrote {fixed} stale absolute logo URL(s) to relative paths.")
    except Exception as e:
        logger.warning(f"fix_legacy_logo_urls failed: {e}")


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


# ==================== SUPPORT ADMIN (CROSS-TENANT) ====================
# Shared off-site support account. SAME credentials work in every tenant.
# Master admins are created per-tenant; this account is auto-attached to every
# tenant at creation time so support can access any franchise without per-tenant setup.
# IMPORTANT: This account does NOT force password change (would break shared access).
SUPPORT_ADMIN_EMAIL = "support@quickwing.com"
SUPPORT_ADMIN_PASSWORD = "QuickWing123!"
SUPPORT_ADMIN_NAME = "Quick Wing Support"


async def seed_support_admin():
    """Ensure the cross-tenant Support Admin user exists on startup."""
    try:
        existing = await db.users.find_one({"email": SUPPORT_ADMIN_EMAIL}, {"_id": 0})
        password_hash = get_password_hash(SUPPORT_ADMIN_PASSWORD)
        if existing:
            # Keep password fresh and account active
            await db.users.update_one(
                {"email": SUPPORT_ADMIN_EMAIL},
                {"$set": {
                    "password_hash": password_hash,
                    "is_active": True,
                    "name": SUPPORT_ADMIN_NAME,
                    "require_password_change": False,
                }}
            )
            logger.info(f"Support admin exists: {SUPPORT_ADMIN_EMAIL}")
        else:
            user = {
                "id": str(uuid.uuid4()),
                "email": SUPPORT_ADMIN_EMAIL,
                "name": SUPPORT_ADMIN_NAME,
                "password_hash": password_hash,
                "is_active": True,
                "require_password_change": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(user)
            logger.info(f"Created Support Admin: {SUPPORT_ADMIN_EMAIL}")
    except Exception as e:
        logger.error(f"Error seeding Support Admin: {e}")




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


# ==================== DEMO TENANTS & MAGIC LINK ====================

# Demo tenants are created via the "Create Client" flow with is_demo=True.
# They are blank tenants (no seeded cars/drivers/bookings) and the only way
# in is via a magic link URL returned when the tenant is created. The demo
# user has no valid password so email + password login is impossible.


async def cleanup_legacy_demo_tenant():
    """One-shot cleanup: the earlier design used a single shared demo tenant
    ("Quick Wing Demo Ltd", slug=demo) with pre-seeded cars/drivers/bookings.
    That model felt like a real customer's app instead of a demo, so it has
    been retired in favour of blank per-prospect demo tenants created via
    "Create Client". This deletes the shared tenant and everything scoped to
    it. Safe to run on every startup — nothing to delete after the first.
    """
    LEGACY_ID = "00000000-0000-0000-0000-000000000d00"
    LEGACY_USER_ID = "00000000-0000-0000-0000-000000000d01"
    LEGACY_EMAIL = "demo@quickwing.com"
    try:
        tenant = await db.tenants.find_one({"id": LEGACY_ID}, {"_id": 0})
        if not tenant:
            return
        # Wipe tenant-scoped collections
        for coll in ("vehicles", "bookings", "car_statuses", "mileage_logs",
                     "audit_events", "messages", "todos", "memberships",
                     "compliance_alerts", "incidents", "notifications",
                     "custom_documents", "fuel_logs"):
            try:
                await db[coll].delete_many({"tenant_id": LEGACY_ID})
            except Exception:
                pass
        # Remove the demo user + all seeded staff users tied to the demo tenant
        await db.users.delete_many({
            "$or": [
                {"id": LEGACY_USER_ID},
                {"email": LEGACY_EMAIL},
                {"tenant_id": LEGACY_ID, "is_demo": True},
                {"email": {"$regex": r"@demo\.quickwing\.com$"}},
            ]
        })
        # Delete any tokens that pointed at the shared tenant
        await db.demo_tokens.delete_many({"tenant_id": LEGACY_ID})
        await db.demo_tokens.delete_many({"tenant_id": {"$exists": False}})
        # Finally the tenant itself
        await db.tenants.delete_one({"id": LEGACY_ID})
        logger.info("Legacy shared demo tenant removed")
    except Exception as e:
        logger.error(f"Error cleaning up legacy demo tenant: {e}")


def _base_url_from_request(request: Optional[Request]) -> str:
    """Derive the public base URL from the incoming request so magic-link
    URLs always match the domain the admin is actually browsing (preview,
    production, or a custom domain like quick-wing.com). Falls back to the
    stable public URL if request is None."""
    if request is None:
        return get_public_url().rstrip('/')
    host = request.headers.get('x-forwarded-host') or request.headers.get('host') or ''
    if not host:
        return get_public_url().rstrip('/')
    scheme = request.headers.get('x-forwarded-proto') or request.url.scheme or 'https'
    return f"{scheme}://{host}"


def _demo_token_public(t: dict, base_url: Optional[str] = None) -> dict:
    """Shape a demo_tokens row for the API response (adds computed URL).
    base_url should be the host the admin is browsing — pass str(request.base_url)
    from the endpoint, not FRONTEND_URL, so links match the current domain."""
    base = (base_url or get_public_url()).rstrip('/')
    url_path = f"/demo-link/{t['token']}"
    return {
        "id": t["id"],
        "token": t["token"],
        "tenant_id": t.get("tenant_id"),
        "tenant_slug": t.get("tenant_slug"),
        "tenant_name": t.get("tenant_name"),
        "prospect_name": t.get("prospect_name", ""),
        "prospect_email": t.get("prospect_email", ""),
        "created_by_email": t.get("created_by_email", ""),
        "created_at": t.get("created_at"),
        "expires_at": t.get("expires_at"),
        "revoked_at": t.get("revoked_at"),
        "last_used_at": t.get("last_used_at"),
        "use_count": t.get("use_count", 0),
        "url": f"{base}{url_path}",
    }


async def _mint_demo_token_for_tenant(tenant: dict, expires_in_days: int,
                                      created_by_user_id: str,
                                      created_by_email: str,
                                      prospect_name: str = "",
                                      prospect_email: str = "") -> dict:
    """Insert a demo_tokens row bound to a specific tenant. Returns the raw
    row (caller can shape it with `_demo_token_public`)."""
    row = {
        "id": str(uuid.uuid4()),
        "token": secrets.token_urlsafe(24),
        "tenant_id": tenant["id"],
        "tenant_slug": tenant["slug"],
        "tenant_name": tenant.get("name", ""),
        "prospect_name": (prospect_name or tenant.get("name", "")).strip(),
        "prospect_email": (prospect_email or "").strip(),
        "created_by_user_id": created_by_user_id,
        "created_by_email": created_by_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(
            days=max(1, min(365, expires_in_days))
        )).isoformat(),
        "revoked_at": None,
        "last_used_at": None,
        "use_count": 0,
    }
    await db.demo_tokens.insert_one(row)
    row.pop("_id", None)
    return row


@api_router.get("/platform/demo-tokens")
async def list_demo_tokens(
    context: TenantContext = Depends(require_platform_admin),
    request: Request = None,
):
    """List every demo token so admins can copy/reshare or revoke."""
    rows = await db.demo_tokens.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    base_url = _base_url_from_request(request)
    return [_demo_token_public(r, base_url=base_url) for r in rows]


@api_router.delete("/platform/demo-tokens/{token_id}")
async def revoke_demo_token(
    token_id: str,
    context: TenantContext = Depends(require_platform_admin),
):
    """Revoke a token — it can no longer be redeemed after this call."""
    row = await db.demo_tokens.find_one({"id": token_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Token not found")
    await db.demo_tokens.update_one(
        {"id": token_id},
        {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


class DemoRedeemPayload(BaseModel):
    token: str


@api_router.post("/demo/redeem")
async def redeem_demo_token(payload: DemoRedeemPayload):
    """Public endpoint. Exchange a magic-link token for a full auth JWT
    scoped to the token's demo tenant + demo user. No password required.
    """
    row = await db.demo_tokens.find_one({"token": payload.token}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Invalid demo link")
    if row.get("revoked_at"):
        raise HTTPException(status_code=403, detail="This demo link has been revoked")
    exp = row.get("expires_at")
    if exp:
        try:
            if datetime.fromisoformat(exp.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                raise HTTPException(status_code=403, detail="This demo link has expired")
        except HTTPException:
            raise
        except Exception:
            pass

    tenant_id = row.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=410, detail="This demo link is no longer valid (legacy)")

    demo_tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not demo_tenant or not demo_tenant.get("is_demo"):
        raise HTTPException(status_code=404, detail="Demo tenant not found")

    demo_user = await db.users.find_one(
        {"tenant_id": tenant_id, "is_demo": True, "role": UserRole.MASTER_ADMIN.value},
        {"_id": 0},
    )
    if not demo_user:
        raise HTTPException(status_code=503, detail="Demo environment is not ready yet")

    access_token = create_access_token({
        "sub": demo_user["id"],
        "email": demo_user["email"],
        "role": UserRole.MASTER_ADMIN.value,
        "tenant_id": tenant_id,
        "is_impersonating": False,
        "is_demo": True,
    })

    await db.demo_tokens.update_one(
        {"id": row["id"]},
        {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat()},
         "$inc": {"use_count": 1}},
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": demo_user["id"],
            "email": demo_user["email"],
            "name": demo_user.get("name", "Demo User"),
            "role": UserRole.MASTER_ADMIN.value,
            "require_password_change": False,
        },
        "active_tenant": {
            "tenant_id": tenant_id,
            "tenant_name": demo_tenant.get("name", "Demo"),
            "tenant_slug": demo_tenant.get("slug", ""),
            "role": UserRole.MASTER_ADMIN.value,
            "status": demo_tenant.get("status", "active"),
        },
        "prospect_name": row.get("prospect_name", ""),
    }


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


# ==================== WINGMAN AI CHATBOT ====================
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Email configuration (Gmail SMTP)
GMAIL_USER = os.environ.get('GMAIL_USER', '')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')
LEAD_NOTIFICATION_EMAIL = os.environ.get('LEAD_NOTIFICATION_EMAIL', 'lee.quickwing@gmail.com')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')


async def send_lead_email(lead_info: dict, transcript_html: str):
    """Send lead notification email via Gmail SMTP"""
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        logging.warning("Gmail credentials not configured - email not sent")
        return False
    
    try:
        # Create email
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"🚛 NEW FLEET LEAD: {lead_info.get('name', 'Unknown')} from {lead_info.get('company', 'Unknown Company')}"
        msg['From'] = GMAIL_USER
        msg['To'] = LEAD_NOTIFICATION_EMAIL
        
        # Plain text version
        plain_text = f"""
NEW FLEET LEAD - Quick Wing

Full Name: {lead_info.get('name', 'Not provided')}
Company Name: {lead_info.get('company', 'Not provided')}
Fleet Management Challenge: {lead_info.get('challenge', 'Not provided')}
Work Email: {lead_info.get('email', 'Not provided')}

--- Chat Transcript ---
{lead_info.get('transcript_text', 'No transcript available')}

---
Captured: {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}
Wingman Bot
        """
        
        # HTML version
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">🚛 NEW FLEET LEAD</h1>
                <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Quick Wing Wingman Chatbot</p>
            </div>
            
            <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
                <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">📋 Lead Details</h2>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 0; color: #64748b; font-weight: 600; width: 180px;">Full Name</td>
                        <td style="padding: 12px 0; color: #1e293b; font-weight: 500;">{lead_info.get('name', 'Not provided')}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 0; color: #64748b; font-weight: 600;">Company Name</td>
                        <td style="padding: 12px 0; color: #1e293b; font-weight: 500;">{lead_info.get('company', 'Not provided')}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 0; color: #64748b; font-weight: 600;">Fleet Challenge</td>
                        <td style="padding: 12px 0; color: #1e293b;">{lead_info.get('challenge', 'Not provided')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #64748b; font-weight: 600;">Work Email</td>
                        <td style="padding: 12px 0;"><a href="mailto:{lead_info.get('email', '')}" style="color: #2563eb; text-decoration: none; font-weight: 500;">{lead_info.get('email', 'Not provided')}</a></td>
                    </tr>
                </table>
                
                <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">💬 Full Chat Transcript</h2>
                <div style="background: #f8fafc; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0;">
                    {transcript_html if transcript_html else '<p style="color: #94a3b8; font-style: italic;">No transcript available</p>'}
                </div>
                
                <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                    <p style="margin: 0; font-size: 14px; color: #1e40af;">
                        <strong>Quick Actions:</strong><br>
                        <a href="mailto:{lead_info.get('email', '')}?subject=Re: Your Fleet Management Inquiry - Quick Wing" style="color: #2563eb;">📧 Reply via Email</a>
                    </p>
                </div>
            </div>
            
            <div style="background: #1e293b; padding: 16px; text-align: center; border-radius: 0 0 12px 12px;">
                <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                    Captured: {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}<br>
                    Powered by <span style="color: white; font-weight: 600;">Quick Wing</span> Wingman Bot 🚛💨
                </p>
            </div>
        </div>
        """
        
        part1 = MIMEText(plain_text, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send via Gmail SMTP
        def send_smtp():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
                server.send_message(msg)
        
        await asyncio.to_thread(send_smtp)
        logging.info(f"Lead email sent successfully to {LEAD_NOTIFICATION_EMAIL}")
        return True
        
    except Exception as e:
        logging.error(f"Failed to send lead email: {str(e)}")
        return False

# Quick Wing chatbot system prompt - Sales-focused B2B assistant
WINGMAN_SYSTEM_PROMPT = """You are Wingman, a consultative sales assistant for Quick Wing - Ireland's leading fleet management platform built specifically for franchise operations.

## THE PROBLEM WE SOLVE
Fleet managers waste hours on double-bookings, compliance paperwork, and chasing drivers for mileage updates. Quick Wing eliminates these headaches completely.

## OUR HOOK (Use this!)
"Cut admin time by 70% with automated compliance tracking." - This is our main value prop. Mention it early when relevant.

## KEY FEATURES TO BRAG ABOUT
1. **Zero Double-Bookings**: Smart conflict detection recommends available cars instantly
2. **Automated Compliance**: Never miss a tax renewal, NCT, or service - the system alerts you weeks in advance
3. **QR Code Mileage**: Drivers scan & submit mileage in seconds - no paperwork, no chasing
4. **Staff Mobile App**: Real-time vehicle status, one-tap bookings, and lift requests
5. **Cost Analytics**: See exactly where your money goes with detailed fleet reports

## WHAT MAKES US DIFFERENT
- Built specifically for Irish franchises (we understand your compliance needs)
- Multi-location support with per-franchise dashboards
- Both admin AND driver apps included
- No per-vehicle pricing traps - simple subscription tiers

## YOUR SALES APPROACH
1. **Ask discovery questions**: "How many vehicles are you managing?" "What's your biggest fleet headache right now?"
2. **Relate to their pain**: Connect their answer to a feature that solves it
3. **Create urgency**: "Most fleet managers tell us they wish they'd switched sooner"
4. **Push the demo**: Your #1 goal is to get them to book a demo call

## CALL-TO-ACTION (Push this!)
Always guide conversations toward: "I'd love to show you how this works for your fleet. Can I get your details to book a quick 15-minute demo?"

## RESPONSE STYLE
- Confident but not pushy
- Use specific numbers ("70% less admin time", "alerts 30 days before expiry")
- Keep responses punchy (2-3 sentences), then ask a question to keep them engaged
- If they seem interested, ask for their name, company, and email to book the demo

## HANDLING OBJECTIONS
- "Too expensive" → "Most customers see ROI within the first month from avoided compliance fines alone. What's your current setup costing you in admin hours?"
- "We use spreadsheets" → "Spreadsheets can't alert you when tax is expiring or prevent double-bookings. One missed renewal can cost €1,000+ in fines."
- "Need to think about it" → "Totally understand. Can I send you a case study showing how [similar franchise type] saved 15 hours/week? What's your email?"

When a user provides contact info, be warm and confirm: "Brilliant! Our team will reach out within 24 hours to schedule your demo. In the meantime, is there anything specific you'd like us to prepare?"""


class ChatMessage(BaseModel):
    message: str
    session_id: str
    user_info: Optional[dict] = None  # Optional: {name, company, email, phone}


class LeadInfo(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    initial_message: Optional[str] = None
    session_id: str


@api_router.post("/chatbot/message")
async def chatbot_message(chat_data: ChatMessage):
    """Process a chatbot message and return AI response"""
    try:
        # Initialize chat with Gemini 3 Flash
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=chat_data.session_id,
            system_message=WINGMAN_SYSTEM_PROMPT
        ).with_model("gemini", "gemini-3-flash-preview")
        
        # Create user message
        user_message = UserMessage(text=chat_data.message)
        
        # Get AI response
        response = await chat.send_message(user_message)
        
        # Store conversation in database for lead tracking
        await db.chatbot_conversations.update_one(
            {"session_id": chat_data.session_id},
            {
                "$push": {
                    "messages": {
                        "role": "user",
                        "content": chat_data.message,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                },
                "$set": {
                    "last_activity": datetime.now(timezone.utc).isoformat(),
                    "user_info": chat_data.user_info
                },
                "$setOnInsert": {
                    "session_id": chat_data.session_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Store AI response
        await db.chatbot_conversations.update_one(
            {"session_id": chat_data.session_id},
            {
                "$push": {
                    "messages": {
                        "role": "assistant",
                        "content": response,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        
        return {"response": response, "session_id": chat_data.session_id}
        
    except Exception as e:
        logging.error(f"Chatbot error: {str(e)}")
        return {
            "response": "I apologize, I'm having trouble connecting right now. Please try again in a moment, or feel free to email us directly at info@quick-wing.com!",
            "session_id": chat_data.session_id,
            "error": True
        }


@api_router.post("/chatbot/capture-lead")
async def capture_lead(lead_info: LeadInfo):
    """Capture lead information and send notification email with full transcript"""
    try:
        # Store lead in database
        lead_data = {
            "id": str(uuid.uuid4()),
            "session_id": lead_info.session_id,
            "name": lead_info.name,
            "company": lead_info.company,
            "email": lead_info.email,
            "phone": lead_info.phone,
            "initial_message": lead_info.initial_message,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "new"
        }
        
        await db.chatbot_leads.insert_one(lead_data)
        
        # Get full conversation transcript
        conversation = await db.chatbot_conversations.find_one(
            {"session_id": lead_info.session_id},
            {"_id": 0}
        )
        
        # Build transcript HTML
        transcript_html = ""
        if conversation and conversation.get("messages"):
            for msg in conversation["messages"]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                timestamp = msg.get("timestamp", "")
                
                if role == "user":
                    transcript_html += f'''
                    <div style="margin-bottom: 12px; text-align: right;">
                        <div style="display: inline-block; background: #2563eb; color: white; padding: 10px 14px; border-radius: 16px 16px 4px 16px; max-width: 80%; text-align: left;">
                            <p style="margin: 0; font-size: 14px;">{content}</p>
                        </div>
                        <p style="margin: 4px 0 0 0; font-size: 10px; color: #94a3b8;">Visitor</p>
                    </div>
                    '''
                else:
                    transcript_html += f'''
                    <div style="margin-bottom: 12px;">
                        <div style="display: inline-block; background: #f1f5f9; color: #1e293b; padding: 10px 14px; border-radius: 16px 16px 16px 4px; max-width: 80%;">
                            <p style="margin: 0; font-size: 14px;">{content}</p>
                        </div>
                        <p style="margin: 4px 0 0 0; font-size: 10px; color: #94a3b8;">Wingman AI</p>
                    </div>
                    '''
        
        # Update conversation with lead info
        await db.chatbot_conversations.update_one(
            {"session_id": lead_info.session_id},
            {
                "$set": {
                    "lead_captured": True,
                    "lead_info": {
                        "name": lead_info.name,
                        "company": lead_info.company,
                        "email": lead_info.email,
                        "phone": lead_info.phone
                    }
                }
            }
        )
        
        # Send notification email with full transcript (via Resend)
        try:
            import resend  # noqa: WPS433 (lazy import — optional dep)
            from services.email_service import SENDER_EMAIL  # noqa: WPS433
        except Exception:
            resend = None
            SENDER_EMAIL = None
        if resend and getattr(resend, "api_key", None) and LEAD_NOTIFICATION_EMAIL:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🚀 New Lead from Wingman Chatbot</h1>
                    <p style="color: #93c5fd; margin: 8px 0 0 0; font-size: 14px;">Quick Wing Fleet Management</p>
                </div>
                <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
                    <h2 style="color: #1e293b; margin-top: 0; font-size: 18px;">📋 Lead Information</h2>
                    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px 16px; color: #64748b; width: 100px; font-weight: 600;">Name</td>
                            <td style="padding: 12px 16px; color: #1e293b; font-weight: 500;">{lead_info.name or 'Not provided'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Company</td>
                            <td style="padding: 12px 16px; color: #1e293b; font-weight: 500;">{lead_info.company or 'Not provided'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Email</td>
                            <td style="padding: 12px 16px; color: #1e293b;"><a href="mailto:{lead_info.email}" style="color: #2563eb; text-decoration: none;">{lead_info.email or 'Not provided'}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Phone</td>
                            <td style="padding: 12px 16px; color: #1e293b;"><a href="tel:{lead_info.phone}" style="color: #2563eb; text-decoration: none;">{lead_info.phone or 'Not provided'}</a></td>
                        </tr>
                    </table>
                    
                    <h2 style="color: #1e293b; margin-top: 24px; font-size: 18px;">💬 Full Conversation Transcript</h2>
                    <div style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0;">
                        {transcript_html if transcript_html else '<p style="color: #94a3b8; font-style: italic;">No messages recorded</p>'}
                    </div>
                    
                    <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                        <h3 style="color: #1e293b; margin: 0 0 8px 0; font-size: 14px;">💡 Quick Actions</h3>
                        <p style="margin: 0; font-size: 13px; color: #475569;">
                            Reply to this lead: <a href="mailto:{lead_info.email}?subject=Re: Your Quick Wing Inquiry" style="color: #2563eb;">Send Email</a>
                            {f' | <a href="tel:{lead_info.phone}" style="color: #2563eb;">Call Now</a>' if lead_info.phone else ''}
                        </p>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 11px; margin-top: 24px; margin-bottom: 0; text-align: center;">
                        Received: {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}<br>
                        Session: {lead_info.session_id}
                    </p>
                </div>
                <div style="background: #1e293b; padding: 16px; text-align: center; border-radius: 0 0 8px 8px;">
                    <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                        Powered by <span style="color: white; font-weight: 600;">Quick Wing</span> Wingman AI
                    </p>
                </div>
            </div>
            """
            
            try:
                email_params = {
                    "from": SENDER_EMAIL,
                    "to": [LEAD_NOTIFICATION_EMAIL],
                    "subject": f"🚀 New Lead: {lead_info.name or 'Anonymous'} from {lead_info.company or 'Unknown Company'}",
                    "html": html_content
                }
                
                # Send email in background thread (non-blocking)
                await asyncio.to_thread(resend.Emails.send, email_params)
                logging.info(f"Lead notification email sent for session {lead_info.session_id}")
                
            except Exception as email_error:
                logging.error(f"Failed to send lead notification email: {str(email_error)}")
                # Don't fail the whole request if email fails
        
        return {
            "success": True,
            "message": "Lead captured successfully",
            "lead_id": lead_data["id"]
        }
        
    except Exception as e:
        logging.error(f"Lead capture error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to capture lead: {str(e)}")


# ==================== STAFF INVITATION & ACTIVATION ====================

ACTIVATION_TOKEN_TTL_DAYS = 7


async def _issue_staff_invitation(
    *,
    user_id: str,
    user_email: str,
    user_name: Optional[str],
    tenant_id: str,
    temporary_password: str,
) -> dict:
    """
    Generate an activation token for a newly invited staff member, then
    send them an invitation email.

    Returns: {"sent": bool, "error": Optional[str], "activation_url": str}
    Failures here MUST NOT block account creation — they are surfaced in
    the response so admins can fall back to sharing the temp password
    manually.
    """
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        return {"sent": False, "error": "Tenant not found", "activation_url": None}

    public_url = get_public_url()
    tenant_slug = tenant.get("slug")

    # Generate single-use activation token (7-day expiry).
    token_value = str(uuid.uuid4()).replace("-", "") + str(uuid.uuid4()).replace("-", "")
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=ACTIVATION_TOKEN_TTL_DAYS)

    await db.activation_tokens.insert_one({
        "token": token_value,
        "user_id": user_id,
        "user_email": user_email,
        "tenant_id": tenant_id,
        "tenant_slug": tenant_slug,
        "used": False,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    })

    activation_url = f"{public_url}/{tenant_slug}/activate?token={token_value}"
    login_url = f"{public_url}/{tenant_slug}/login"

    email_result = await send_staff_invitation_email(
        recipient_email=user_email,
        staff_name=user_name,
        tenant_name=tenant.get("name", "Quick Wing"),
        activation_url=activation_url,
        login_url=login_url,
        temporary_password=temporary_password,
    )

    return {
        "sent": email_result.get("success", False),
        "error": email_result.get("error"),
        "activation_url": activation_url,
    }


class ActivationTokenInfo(BaseModel):
    valid: bool
    user_email: Optional[str] = None
    tenant_slug: Optional[str] = None
    tenant_name: Optional[str] = None
    error: Optional[str] = None


@api_router.get("/auth/activate/{token}", response_model=ActivationTokenInfo)
async def get_activation_token_info(token: str):
    """
    Public endpoint — return info needed for the activation page so the
    frontend can show 'Welcome, you're joining {tenant}'.
    """
    record = await db.activation_tokens.find_one({"token": token}, {"_id": 0})
    if not record:
        return ActivationTokenInfo(valid=False, error="Invalid activation link")
    if record.get("used"):
        return ActivationTokenInfo(valid=False, error="This activation link has already been used")
    expires_at = record.get("expires_at")
    try:
        if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
            return ActivationTokenInfo(valid=False, error="This activation link has expired")
    except Exception:
        pass

    tenant = await db.tenants.find_one({"id": record.get("tenant_id")}, {"_id": 0})
    return ActivationTokenInfo(
        valid=True,
        user_email=record.get("user_email"),
        tenant_slug=record.get("tenant_slug"),
        tenant_name=tenant.get("name") if tenant else None,
    )


class ActivateAccountRequest(BaseModel):
    token: str
    new_password: str


@api_router.post("/auth/activate")
async def activate_account(payload: ActivateAccountRequest):
    """
    Public endpoint — consume an activation token, set the new password,
    clear the require_password_change flag, and return a login token plus
    membership info so the frontend can drop the user straight into their
    dashboard.
    """
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    record = await db.activation_tokens.find_one({"token": payload.token}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid activation link")
    if record.get("used"):
        raise HTTPException(status_code=400, detail="This activation link has already been used")
    expires_at = record.get("expires_at")
    try:
        if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This activation link has expired")
    except HTTPException:
        raise
    except Exception:
        pass

    user = await db.users.find_one({"id": record["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="User account not found")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": get_password_hash(payload.new_password),
            "require_password_change": False,
        }}
    )
    await db.activation_tokens.update_one(
        {"token": payload.token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Issue a base access token (no tenant context yet — frontend can call
    # /auth/select-tenant the same way the regular login flow does).
    access_token = create_access_token({"sub": user["id"], "email": user["email"]})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["id"],
        "tenant_slug": record.get("tenant_slug"),
    }


# Resend an invitation to an existing tenant user. Admin only.
# Generates a fresh activation token and emails the user a new invite.
@api_router.post("/tenant/users/{user_id}/resend-invitation")
async def resend_user_invitation(
    user_id: str,
    context: TenantContext = Depends(require_admin),
):
    """Re-issue the staff invitation email for an existing tenant user."""
    membership = await db.memberships.find_one(
        {"tenant_id": context.tenant_id, "user_id": user_id},
        {"_id": 0},
    )
    if not membership:
        raise HTTPException(status_code=404, detail="User is not a member of this tenant")

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Reset password to the default so the email's temp password works again
    # and the user is forced to change it on first login.
    new_temp = "QuickWing123!"
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "password_hash": get_password_hash(new_temp),
            "require_password_change": True,
        }}
    )

    invite_result = await _issue_staff_invitation(
        user_id=user_id,
        user_email=user["email"],
        user_name=user.get("name"),
        tenant_id=context.tenant_id,
        temporary_password=new_temp,
    )

    return {
        "message": "Invitation re-sent" if invite_result.get("sent") else "User reset; email failed",
        "email_sent": invite_result.get("sent", False),
        "email_error": invite_result.get("error"),
        "temporary_password": new_temp,
        # Always surface the activation URL — when email delivery fails,
        # admins can copy this link and hand it to the staff member via
        # WhatsApp / SMS / another channel.
        "activation_url": invite_result.get("activation_url"),
    }


# ==================== CUSTOM DOCUMENTS (templates + submissions) ====================
# Admins design forms (e.g. Fuel Log, Pre-trip check). Staff submit them
# from their dashboard. Each tenant has its own templates and submissions.


async def _seed_builtin_templates_if_missing(tenant_id: str) -> None:
    """Create the built-in templates (e.g. Car Inspection Sheet) for a tenant
    if they don't already have one with the same name. Also cleans up any
    legacy 'Fuel Log' built-in template so it stops appearing to admins/staff.
    Safe to call repeatedly.
    """
    # Cleanup: remove legacy built-in Fuel Log template and its submissions.
    legacy = await db.document_templates.find_one(
        {"tenant_id": tenant_id, "name": "Fuel Log"}, {"_id": 0, "id": 1}
    )
    if legacy and legacy.get("id"):
        await db.document_submissions.delete_many(
            {"tenant_id": tenant_id, "template_id": legacy["id"]}
        )
        await db.document_templates.delete_one(
            {"tenant_id": tenant_id, "id": legacy["id"]}
        )

    for tpl in BUILTIN_TEMPLATES:
        existing = await db.document_templates.find_one(
            {"tenant_id": tenant_id, "name": tpl.name}, {"_id": 0, "id": 1}
        )
        if existing:
            continue
        doc = build_template_doc(tenant_id=tenant_id, payload=tpl, is_builtin=True)
        await db.document_templates.insert_one(doc)


@api_router.get("/documents/templates")
async def list_document_templates(
    include_inactive: bool = False,
    context: TenantContext = Depends(require_tenant_context),
):
    """List all document templates for the tenant.
    Staff get only active templates; admins can include inactive."""
    await _seed_builtin_templates_if_missing(context.tenant_id)
    query: dict = {"tenant_id": context.tenant_id}
    is_admin = context.role in (UserRole.ADMIN, UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN)
    if not (is_admin and include_inactive):
        query["is_active"] = True
    cursor = db.document_templates.find(query, {"_id": 0}).sort("created_at", 1)
    return await cursor.to_list(length=200)


@api_router.post("/documents/templates")
async def create_document_template(
    payload: DocTemplateCreate,
    context: TenantContext = Depends(require_admin),
):
    """Admin: create a new custom document template."""
    try:
        doc = build_template_doc(tenant_id=context.tenant_id, payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.document_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/documents/templates/{template_id}")
async def get_document_template(
    template_id: str,
    context: TenantContext = Depends(require_tenant_context),
):
    doc = await db.document_templates.find_one(
        {"id": template_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    return doc


@api_router.put("/documents/templates/{template_id}")
async def update_document_template(
    template_id: str,
    payload: DocTemplateUpdate,
    context: TenantContext = Depends(require_admin),
):
    existing = await db.document_templates.find_one(
        {"id": template_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    try:
        merged = merge_template_update(existing, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.document_templates.update_one(
        {"id": template_id, "tenant_id": context.tenant_id},
        {"$set": merged},
    )
    return merged


@api_router.delete("/documents/templates/{template_id}")
async def delete_document_template(
    template_id: str,
    context: TenantContext = Depends(require_admin),
):
    existing = await db.document_templates.find_one(
        {"id": template_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    # Hard delete the template, but leave existing submissions in place so
    # historical data remains visible to admins.
    await db.document_templates.delete_one(
        {"id": template_id, "tenant_id": context.tenant_id}
    )
    return {"success": True}


@api_router.get("/documents/inbox/unread-count")
async def documents_inbox_unread_count(
    context: TenantContext = Depends(require_tenant_context),
):
    """Return the number of `document_submitted` notifications the current
    admin hasn't marked as read yet. Powers the red dot on the Documents
    sub-tab.
    """
    if context.role not in (UserRole.ADMIN, UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN):
        return {"count": 0}
    count = await db.notifications.count_documents({
        "tenant_id": context.tenant_id,
        "user_id": context.user_id,
        "type": "document_submitted",
        "read": False,
    })
    return {"count": int(count)}


@api_router.post("/documents/inbox/mark-read")
async def documents_inbox_mark_read(
    context: TenantContext = Depends(require_tenant_context),
):
    """Mark every unread `document_submitted` notification for the current
    admin as read. Called when the admin opens the Documents Inbox tab.
    """
    if context.role not in (UserRole.ADMIN, UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN):
        return {"marked": 0}
    res = await db.notifications.update_many(
        {
            "tenant_id": context.tenant_id,
            "user_id": context.user_id,
            "type": "document_submitted",
            "read": False,
        },
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"marked": int(res.modified_count)}


@api_router.get("/documents/submissions")
async def list_document_submissions(
    template_id: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 200,
    skip: int = 0,
    context: TenantContext = Depends(require_tenant_context),
):
    """List submissions. Admins see all; staff see only their own.

    Optional `q` performs a case-insensitive search across template name,
    submitted-by (name + email) and vehicle registration.
    """
    query: dict = {"tenant_id": context.tenant_id}
    if template_id:
        query["template_id"] = template_id
    if vehicle_id:
        query["vehicle_id"] = vehicle_id

    is_admin = context.role in (UserRole.ADMIN, UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN)
    if not is_admin:
        query["submitted_by_user_id"] = context.user_id

    if q:
        needle = str(q).strip()
        if needle:
            regex = {"$regex": re.escape(needle), "$options": "i"}
            query["$or"] = [
                {"template_name": regex},
                {"submitted_by_name": regex},
                {"submitted_by_email": regex},
                {"vehicle_registration": regex},
            ]

    cursor = db.document_submissions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.document_submissions.count_documents(query)
    return {"items": items, "total": total}


@api_router.post("/documents/submissions")
async def create_document_submission(
    payload: DocSubmissionCreate,
    context: TenantContext = Depends(require_tenant_context),
):
    """Staff or admin submits a document."""
    template = await db.document_templates.find_one(
        {"id": payload.template_id, "tenant_id": context.tenant_id, "is_active": True},
        {"_id": 0},
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found or inactive")
    try:
        doc = build_submission_doc(
            tenant_id=context.tenant_id,
            template=template,
            payload=payload,
            submitted_by_user_id=context.user_id,
            submitted_by_name=context.user_name,
            submitted_by_email=context.user_email,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # If a vehicle field was provided as just an id, hydrate the registration.
    if doc.get("vehicle_id") and not doc.get("vehicle_registration"):
        veh = await db.vehicles.find_one(
            {"id": doc["vehicle_id"], "tenant_id": context.tenant_id},
            {"_id": 0, "registration": 1},
        )
        if veh:
            doc["vehicle_registration"] = veh.get("registration")

    await db.document_submissions.insert_one(doc)
    doc.pop("_id", None)

    # Notify all admins/master-admins of this tenant (skip the submitter).
    try:
        admin_memberships = await db.memberships.find(
            {"tenant_id": context.tenant_id, "role": {"$in": ["admin", "master_admin"]}},
            {"_id": 0, "user_id": 1},
        ).to_list(500)
        reporter_name = doc.get("submitted_by_name") or context.user_email or "A staff member"
        tpl_name = doc.get("template_name") or "a document"
        for m in admin_memberships:
            if m["user_id"] == context.user_id:
                continue
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "tenant_id": context.tenant_id,
                "user_id": m["user_id"],
                "type": "document_submitted",
                "title": f"New {tpl_name} submitted",
                "message": f"{reporter_name} submitted a {tpl_name}.",
                "link": "/dashboard?tab=reports&sub=documents",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "meta": {
                    "submission_id": doc.get("id"),
                    "template_id": doc.get("template_id"),
                    "template_name": tpl_name,
                    "submitted_by_user_id": context.user_id,
                    "submitted_by_name": reporter_name,
                },
            })
    except Exception:
        pass

    return doc


@api_router.get("/documents/submissions/{submission_id}")
async def get_document_submission(
    submission_id: str,
    context: TenantContext = Depends(require_tenant_context),
):
    doc = await db.document_submissions.find_one(
        {"id": submission_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Submission not found")
    is_admin = context.role in (UserRole.ADMIN, UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN)
    if not is_admin and doc.get("submitted_by_user_id") != context.user_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    return doc


@api_router.patch("/documents/submissions/{submission_id}")
async def update_document_submission(
    submission_id: str,
    payload: DocSubmissionUpdate,
    context: TenantContext = Depends(require_admin),
):
    existing = await db.document_submissions.find_one(
        {"id": submission_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Submission not found")
    update: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    data = payload.model_dump(exclude_unset=True)
    if "data" in data and isinstance(data["data"], dict):
        merged = {**(existing.get("data") or {}), **data["data"]}
        update["data"] = merged
    if "status" in data and data["status"]:
        update["status"] = str(data["status"])
    await db.document_submissions.update_one(
        {"id": submission_id, "tenant_id": context.tenant_id}, {"$set": update}
    )
    refreshed = await db.document_submissions.find_one(
        {"id": submission_id, "tenant_id": context.tenant_id}, {"_id": 0}
    )
    return refreshed


@api_router.delete("/documents/submissions/{submission_id}")
async def delete_document_submission(
    submission_id: str,
    context: TenantContext = Depends(require_admin),
):
    res = await db.document_submissions.delete_one(
        {"id": submission_id, "tenant_id": context.tenant_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"success": True}


@api_router.get("/documents/fuel-analytics")
async def get_fuel_analytics(
    month: Optional[str] = None,  # YYYY-MM, defaults to current month
    context: TenantContext = Depends(require_admin),
):
    """
    Aggregate Fuel Log submissions for the requested month, grouped by
    vehicle. Used by the admin reports dashboard.

    Returns:
      {
        "month": "2026-02",
        "total_cost": 1234.56,
        "total_litres": 678.9,
        "submissions_count": 42,
        "vehicles": [
          {"vehicle_id": ..., "vehicle_registration": ..., "cost": 250.0, "litres": 130.0, "fills": 4}
        ],
        "currency": "EUR"
      }
    """
    # Find the Fuel Log template for this tenant. If missing, return zeros.
    template = await db.document_templates.find_one(
        {"tenant_id": context.tenant_id, "name": "Fuel Log"},
        {"_id": 0, "id": 1},
    )
    if not template:
        await _seed_builtin_templates_if_missing(context.tenant_id)
        template = await db.document_templates.find_one(
            {"tenant_id": context.tenant_id, "name": "Fuel Log"},
            {"_id": 0, "id": 1},
        )

    # Default month = current
    now = datetime.now(timezone.utc)
    target_month = (month or now.strftime("%Y-%m")).strip()

    if not template:
        return {
            "month": target_month,
            "total_cost": 0.0,
            "total_litres": 0.0,
            "submissions_count": 0,
            "vehicles": [],
            "currency": "EUR",
        }

    # ISO date string range covers the calendar month inclusively.
    month_start = f"{target_month}-01"
    try:
        year, mnum = [int(x) for x in target_month.split("-")]
        nyear, nmonth = (year + 1, 1) if mnum == 12 else (year, mnum + 1)
        next_month_start = f"{nyear:04d}-{nmonth:02d}-01"
    except Exception:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")

    cursor = db.document_submissions.find(
        {
            "tenant_id": context.tenant_id,
            "template_id": template["id"],
            "created_at": {"$gte": month_start, "$lt": next_month_start},
        },
        {"_id": 0, "vehicle_id": 1, "vehicle_registration": 1, "data": 1},
    )

    by_vehicle: Dict[str, Dict[str, Any]] = {}
    total_cost = 0.0
    total_litres = 0.0
    count = 0
    async for sub in cursor:
        count += 1
        cost = float(sub.get("data", {}).get("cost_eur") or 0)
        litres = float(sub.get("data", {}).get("litres") or 0)
        total_cost += cost
        total_litres += litres
        veh_id = sub.get("vehicle_id") or "unknown"
        veh_reg = sub.get("vehicle_registration") or "Unknown vehicle"
        bucket = by_vehicle.setdefault(
            veh_id,
            {"vehicle_id": veh_id, "vehicle_registration": veh_reg, "cost": 0.0, "litres": 0.0, "fills": 0},
        )
        bucket["cost"] += cost
        bucket["litres"] += litres
        bucket["fills"] += 1

    # Sort by cost desc.
    vehicles = sorted(by_vehicle.values(), key=lambda x: x["cost"], reverse=True)
    return {
        "month": target_month,
        "total_cost": round(total_cost, 2),
        "total_litres": round(total_litres, 2),
        "submissions_count": count,
        "vehicles": [
            {
                **v,
                "cost": round(v["cost"], 2),
                "litres": round(v["litres"], 2),
            }
            for v in vehicles
        ],
        "currency": "EUR",
    }


@api_router.get("/chatbot/conversation/{session_id}")
async def get_conversation(session_id: str):
    """Get conversation history for a session"""
    conversation = await db.chatbot_conversations.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not conversation:
        return {"session_id": session_id, "messages": []}
    
    return conversation


# ==================== LEGAL RECORDS (Platform-level, super admin only) ====================

class LegalRecord(BaseModel):
    company_legal_name: Optional[str] = ""
    company_registration_number: Optional[str] = ""
    registered_address: Optional[str] = ""
    trading_product_name: Optional[str] = "Quick Wing"
    trademark_status: Optional[str] = ""
    trademark_reference_number: Optional[str] = ""
    domain_name_records: Optional[str] = ""
    github_repository_link: Optional[str] = ""
    hosting_provider: Optional[str] = ""
    date_of_first_creation: Optional[str] = ""
    date_of_first_launch: Optional[str] = ""
    developer_contributor_records: Optional[str] = ""
    ip_assignment_status: Optional[str] = ""
    contract_upload_reference_notes: Optional[str] = ""


LEGAL_RECORD_DOC_ID = "platform_legal_record"


@api_router.get("/platform/legal-records")
async def get_legal_records(
    context: TenantContext = Depends(require_super_admin)
):
    """Return the singleton legal record for QuickFleet Limited."""
    doc = await db.legal_records.find_one(
        {"_id": LEGAL_RECORD_DOC_ID},
        {"_id": 0}
    )
    if not doc:
        # Return defaults
        return LegalRecord().model_dump()
    # Strip metadata fields
    doc.pop("updated_at", None)
    doc.pop("updated_by", None)
    return doc


@api_router.put("/platform/legal-records")
async def update_legal_records(
    payload: LegalRecord,
    context: TenantContext = Depends(require_super_admin)
):
    """Upsert the singleton legal record. Super admin only."""
    data = payload.model_dump()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_by"] = context.user_email if context else "unknown"
    await db.legal_records.update_one(
        {"_id": LEGAL_RECORD_DOC_ID},
        {"$set": data},
        upsert=True
    )
    return {"success": True, "record": data}


@api_router.post("/tenant/licence-reminders/run-now")
async def run_licence_reminders_now(
    context: TenantContext = Depends(require_admin),
):
    """Manually kick off the daily licence-reminder job. Useful right after
    setup so admins can prove the plumbing works without waiting until 08:00
    UTC. Idempotent — a user who has already had today's reminder won't get
    a second one thanks to the `licence_reminder_sends` dedupe key.
    """
    try:
        from services import licence_reminder_service
        summaries = await licence_reminder_service.run_now()
        return {"success": True, "summaries": summaries}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Licence reminder run failed: {exc}") from exc


# Include router - MUST be after all routes are defined
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown():
    client.close()
