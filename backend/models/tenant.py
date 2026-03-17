"""
Tenant and Multi-Tenancy Models
"""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class TenantStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    PENDING_PAYMENT = "pending_payment"
    TRIAL = "trial"


class TenantPlan(str, Enum):
    STANDARD = "standard"       # Quick Wing Standard - €179/month
    ESSENTIAL = "essential"     # Quick Wing Essential - €279/month (Most Popular)
    PROFESSIONAL = "professional"  # Quick Wing Professional - €399/month


# Plan configuration with features and limits
PLAN_CONFIG = {
    TenantPlan.STANDARD: {
        "name": "Quick Wing Standard",
        "price": 179,
        "currency": "EUR",
        "max_vehicles": 10,
        "max_users": 20,
        "customizations_per_month": 1,
        "features": {
            "vehicle_booking": True,
            "fleet_compliance": True,  # Tax, insurance, NCT, service km's
            "basic_reports": True,
            "enhanced_reports": False,
            "detailed_reports": False,
            "staff_calendars": True,
            "admin_all_cars_calendar": True,
            "booking_visibility_enhanced": False,
            "booking_admin_control": False,
            "compliance_oversight_broad": False,
            "multi_location_support": False,
            "api_access": False,
            "priority_support": False,
            "custom_branding": False,
        },
        "description": "A practical fleet system for smaller franchises",
        "tagline": "Simple structure for smaller teams that need control without complexity"
    },
    TenantPlan.ESSENTIAL: {
        "name": "Quick Wing Essential",
        "price": 279,
        "currency": "EUR",
        "max_vehicles": 25,
        "max_users": 35,
        "customizations_per_month": 2,
        "is_popular": True,
        "features": {
            "vehicle_booking": True,
            "fleet_compliance": True,
            "basic_reports": True,
            "enhanced_reports": True,  # Enhanced fleet reports
            "detailed_reports": False,
            "staff_calendars": True,
            "admin_all_cars_calendar": True,
            "booking_visibility_enhanced": True,  # Stronger booking visibility
            "booking_admin_control": True,  # Admin control over bookings
            "compliance_oversight_broad": True,  # Broader compliance oversight
            "multi_location_support": False,
            "api_access": False,
            "priority_support": False,
            "custom_branding": False,
        },
        "description": "The best fit for growing franchises that need more control",
        "tagline": "Built to be the sweet spot for value, scale and day-to-day control"
    },
    TenantPlan.PROFESSIONAL: {
        "name": "Quick Wing Professional",
        "price": 399,
        "currency": "EUR",
        "max_vehicles": 50,
        "max_users": 50,
        "customizations_per_month": 4,
        "features": {
            "vehicle_booking": True,
            "fleet_compliance": True,
            "basic_reports": True,
            "enhanced_reports": True,
            "detailed_reports": True,  # Full detailed reporting & analytics
            "staff_calendars": True,
            "admin_all_cars_calendar": True,
            "booking_visibility_enhanced": True,
            "booking_admin_control": True,
            "compliance_oversight_broad": True,
            "multi_location_support": True,  # Manage multiple depot locations
            "priority_support": True,  # Priority customer support
            "custom_branding": True,  # Custom logo and color scheme
            "cost_analytics": True,  # Customizable cost-per-mile analytics
        },
        "description": "For larger franchises that need more scale and visibility",
        "tagline": "Designed for larger teams that need flexibility and structure at scale"
    }
}


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"      # Platform owner - full access to all tenants
    MASTER_ADMIN = "master_admin"    # Franchise owner - pays for service, manages their tenant
    ADMIN = "admin"                  # Admin within tenant (created by master admin)
    STAFF = "staff"                  # Regular staff within a tenant


# ==================== TENANT MODELS ====================

class TenantCreate(BaseModel):
    name: str
    slug: str  # URL-friendly identifier
    plan: TenantPlan = TenantPlan.STANDARD
    # Optional: Master Admin credentials. If not provided, will be auto-generated
    master_admin_email: Optional[EmailStr] = None  # Now validates email format
    master_admin_name: Optional[str] = None
    # Custom limits (super admin can override plan defaults)
    custom_max_vehicles: Optional[int] = None
    custom_max_users: Optional[int] = None
    # Feature overrides (super admin can enable/disable specific features)
    feature_overrides: Optional[dict] = None
    

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[TenantStatus] = None
    plan: Optional[TenantPlan] = None
    subscription_expires_at: Optional[datetime] = None
    max_vehicles: Optional[int] = None
    max_users: Optional[int] = None
    notes: Optional[str] = None
    # Feature overrides for super admin
    feature_overrides: Optional[dict] = None
    customizations_remaining: Optional[int] = None


class Tenant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str  # URL-friendly identifier (e.g., "bluebird-care")
    status: TenantStatus = TenantStatus.ACTIVE
    plan: TenantPlan = TenantPlan.STANDARD
    subscription_expires_at: Optional[datetime] = None
    max_vehicles: int = 10  # Plan limits
    max_users: int = 20
    customizations_remaining: int = 1  # Monthly customizations
    customizations_reset_date: Optional[datetime] = None
    feature_overrides: Optional[dict] = None  # Super admin can override features
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TenantUsageStats(BaseModel):
    tenant_id: str
    tenant_name: str
    vehicles_count: int
    users_count: int
    bookings_count: int
    bookings_this_month: int
    status: TenantStatus
    plan: TenantPlan


# ==================== USER MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = None  # Optional - will be auto-generated if not provided
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: Optional[str] = None
    password_hash: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserResponse(BaseModel):
    """User response without sensitive data"""
    id: str
    email: str
    name: Optional[str] = None
    is_active: bool
    created_at: datetime


# ==================== MEMBERSHIP MODELS ====================

class MembershipCreate(BaseModel):
    user_id: str
    tenant_id: str
    role: UserRole = UserRole.STAFF


class Membership(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tenant_id: str
    role: UserRole
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserWithMemberships(BaseModel):
    """User with all their tenant memberships"""
    id: str
    email: str
    name: Optional[str] = None
    is_active: bool
    memberships: List[dict]  # [{tenant_id, tenant_name, tenant_slug, role}]


# ==================== TENANT CONTEXT ====================

class TenantContext(BaseModel):
    """Current tenant context for authenticated requests"""
    user_id: str
    user_email: str
    user_name: Optional[str]
    tenant_id: Optional[str]  # None for super/master admin without active tenant
    tenant_name: Optional[str]
    tenant_slug: Optional[str]
    role: UserRole
    is_impersonating: bool = False  # True when master admin is impersonating


class TenantSelector(BaseModel):
    """For selecting active tenant after login"""
    tenant_id: str


# ==================== AUDIT MODELS ====================

class AuditAction(str, Enum):
    # Tenant actions
    TENANT_CREATED = "tenant_created"
    TENANT_UPDATED = "tenant_updated"
    TENANT_SUSPENDED = "tenant_suspended"
    TENANT_REACTIVATED = "tenant_reactivated"
    TENANT_DELETED = "tenant_deleted"
    
    # User actions
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    USER_REMOVED = "user_removed"
    USER_ROLE_CHANGED = "user_role_changed"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    
    # Impersonation
    IMPERSONATION_START = "impersonation_start"
    IMPERSONATION_END = "impersonation_end"
    
    # Data actions
    VEHICLE_CREATED = "vehicle_created"
    VEHICLE_DELETED = "vehicle_deleted"
    VEHICLE_STATUS_UPDATED = "vehicle_status_updated"
    BOOKING_CREATED = "booking_created"
    BOOKING_DELETED = "booking_deleted"
    DATA_EXPORTED = "data_exported"
    
    # Security
    UNAUTHORIZED_ACCESS_ATTEMPT = "unauthorized_access_attempt"
    TENANT_ISOLATION_VIOLATION = "tenant_isolation_violation"


class AuditEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    actor_user_id: str
    actor_email: str
    tenant_id: Optional[str] = None  # Nullable for platform-level events
    action: AuditAction
    resource_type: Optional[str] = None  # e.g., "tenant", "user", "vehicle"
    resource_id: Optional[str] = None
    meta: Optional[dict] = None  # Additional context
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== TOKEN MODELS ====================

class TokenPayload(BaseModel):
    """JWT token payload structure"""
    sub: str  # user_id
    email: str
    role: UserRole
    tenant_id: Optional[str] = None
    tenant_slug: Optional[str] = None
    is_impersonating: bool = False
    exp: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    tenants: List[dict]  # List of tenant memberships
    active_tenant: Optional[dict] = None
