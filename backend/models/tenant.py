"""
Tenant and Multi-Tenancy Models
"""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
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
    ESSENTIAL = "essential"     # Quick Wing Essential - €299/month (Most Popular)
    PROFESSIONAL = "professional"  # Quick Wing Professional - €499/month
    CUSTOM = "custom"           # Custom plan - super admin sets vehicles, users, and price


# ============================================
# MASTER FEATURE REGISTRY
# All toggleable features with metadata
# ============================================
FEATURE_REGISTRY = {
    # === CORE FEATURES (Available in all plans) ===
    "vehicle_booking": {
        "name": "Vehicle Booking",
        "description": "Basic vehicle booking system with calendar view",
        "category": "core",
        "default_plans": ["standard", "essential", "professional"],
        "sellable": False  # Always included
    },
    "fleet_compliance": {
        "name": "Fleet Compliance",
        "description": "Track tax, NCT, insurance due dates",
        "category": "core",
        "default_plans": ["standard", "essential", "professional"],
        "sellable": False
    },
    "basic_reports": {
        "name": "Basic Reports",
        "description": "Fleet usage statistics and basic analytics",
        "category": "reports",
        "default_plans": ["standard", "essential", "professional"],
        "sellable": False
    },
    "staff_calendars": {
        "name": "Staff Calendars",
        "description": "Personal booking calendars for staff members",
        "category": "core",
        "default_plans": ["standard", "essential", "professional"],
        "sellable": False
    },
    "admin_all_cars_calendar": {
        "name": "Admin All Cars Calendar",
        "description": "Admin view of all vehicle bookings",
        "category": "core",
        "default_plans": ["standard", "essential", "professional"],
        "sellable": False
    },
    "email_support": {
        "name": "Email Support",
        "description": "Standard email support",
        "category": "support",
        "default_plans": ["standard", "essential", "professional"],
        "sellable": False
    },
    "standard_onboarding": {
        "name": "Standard Onboarding",
        "description": "Basic setup assistance",
        "category": "support",
        "default_plans": ["standard", "essential", "professional"],
        "sellable": False
    },
    
    # === ESSENTIAL TIER FEATURES ===
    "enhanced_reports": {
        "name": "Enhanced Reports",
        "description": "Advanced analytics with charts and trends",
        "category": "reports",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 29
    },
    "booking_visibility_enhanced": {
        "name": "Enhanced Booking Visibility",
        "description": "See who booked what and when across the fleet",
        "category": "bookings",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 19
    },
    "booking_admin_control": {
        "name": "Admin Booking Control",
        "description": "Approve/reject bookings, manage conflicts",
        "category": "bookings",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 25
    },
    "compliance_oversight_broad": {
        "name": "Compliance Oversight",
        "description": "Fleet-wide compliance dashboard and alerts",
        "category": "compliance",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 35
    },
    "cost_analytics": {
        "name": "Cost Analytics",
        "description": "Track and analyze fleet costs",
        "category": "reports",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 39
    },
    "faster_support": {
        "name": "Faster Support",
        "description": "24-hour response time guarantee",
        "category": "support",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 15
    },
    "recurring_bookings": {
        "name": "Recurring Bookings",
        "description": "Set up daily, weekly, or monthly recurring bookings",
        "category": "bookings",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 25
    },
    "live_status_updates": {
        "name": "Live Status Updates",
        "description": "Real-time fleet status with auto-refresh",
        "category": "core",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 19
    },
    "qr_codes": {
        "name": "QR Codes",
        "description": "Generate QR codes for vehicles linking to booking page",
        "category": "core",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 15
    },
    "block_vehicles": {
        "name": "Block/Unblock Vehicles",
        "description": "Temporarily block vehicles with reason tracking",
        "category": "fleet",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 10
    },
    "request_lift": {
        "name": "Request a Lift",
        "description": "Allow staff to request lifts from other team members",
        "category": "bookings",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 15
    },
    "show_map": {
        "name": "Show Map",
        "description": "View fleet and bookings on interactive map",
        "category": "fleet",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 25
    },
    "map_booking_pins": {
        "name": "Map Booking Pins",
        "description": "See all active bookings pinned on map with journey routes",
        "category": "fleet",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 19
    },
    "location_summary_reports": {
        "name": "Location Summary Reports",
        "description": "Reports grouped by admin-configured locations",
        "category": "reports",
        "default_plans": ["essential", "professional"],
        "sellable": True,
        "addon_price": 29
    },
    
    # === PROFESSIONAL TIER FEATURES ===
    "detailed_reports": {
        "name": "Detailed Reports",
        "description": "Full reporting suite with custom date ranges",
        "category": "reports",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 49
    },
    "priority_support": {
        "name": "Priority Support",
        "description": "4-hour response time, dedicated support line",
        "category": "support",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 45
    },
    "multi_site_oversight": {
        "name": "Multi-Site Oversight",
        "description": "Manage multiple locations from one dashboard",
        "category": "admin",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 59
    },
    "advanced_permissions": {
        "name": "Advanced Permissions",
        "description": "Granular role-based access control",
        "category": "admin",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 35
    },
    "custom_exports": {
        "name": "Custom Exports",
        "description": "Export data to CSV, PDF with custom templates",
        "category": "reports",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 25
    },
    "user_management": {
        "name": "User Management",
        "description": "Full CRUD for team members with role assignment",
        "category": "admin",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 29
    },
    "status_history": {
        "name": "Status History",
        "description": "Track vehicle status changes over time",
        "category": "fleet",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 19
    },
    "announcements": {
        "name": "Announcements",
        "description": "Send announcements to all team members",
        "category": "communication",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 15
    },
    "daily_timeline": {
        "name": "Daily Timeline View",
        "description": "Hourly fleet utilization chart",
        "category": "reports",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 29
    },
    "mileage_tracking": {
        "name": "Mileage Tracking",
        "description": "Track current mileage and service due alerts",
        "category": "compliance",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 25
    },
    "api_access": {
        "name": "API Access",
        "description": "REST API access for integrations",
        "category": "integrations",
        "default_plans": ["professional"],
        "sellable": True,
        "addon_price": 99
    }
}

# Get feature categories for UI grouping
FEATURE_CATEGORIES = {
    "core": "Core Features",
    "bookings": "Booking Features",
    "fleet": "Fleet Management",
    "reports": "Reports & Analytics",
    "compliance": "Compliance & Tracking",
    "admin": "Administration",
    "support": "Support",
    "communication": "Communication",
    "integrations": "Integrations"
}

def get_plan_default_features(plan: str) -> Dict[str, bool]:
    """Get the default features for a plan"""
    features = {}
    for feature_key, feature_config in FEATURE_REGISTRY.items():
        features[feature_key] = plan in feature_config.get("default_plans", [])
    return features


# Plan configuration with features and limits
PLAN_CONFIG = {
    TenantPlan.STANDARD: {
        "name": "Quick Wing Standard",
        "price": 179,
        "currency": "EUR",
        "max_vehicles": 10,
        "max_users": 15,
        "customizations_per_month": 1,
        "sub_label": "Best for small teams",
        "features": get_plan_default_features("standard"),
        "description": "A practical fleet system for smaller franchises",
        "tagline": "Simple structure for smaller teams that need control without complexity"
    },
    TenantPlan.ESSENTIAL: {
        "name": "Quick Wing Essential",
        "price": 299,
        "currency": "EUR",
        "max_vehicles": 25,
        "max_users": 35,
        "customizations_per_month": 2,
        "is_popular": True,
        "sub_label": "Best value",
        "features": get_plan_default_features("essential"),
        "description": "The best fit for growing franchises that need more control",
        "tagline": "Built to be the sweet spot for value, scale and day-to-day control"
    },
    TenantPlan.PROFESSIONAL: {
        "name": "Quick Wing Professional",
        "price": 499,
        "currency": "EUR",
        "max_vehicles": 50,
        "max_users": 50,
        "customizations_per_month": 4,
        "sub_label": "Best for multi-site operations",
        "features": get_plan_default_features("professional"),
        "description": "For larger franchises that need more scale and visibility",
        "tagline": "Designed for larger teams that need flexibility, oversight and structure at scale"
    },
    TenantPlan.CUSTOM: {
        "name": "Custom Plan",
        "price": 0,                  # Set per-tenant via custom_price at creation time
        "currency": "EUR",
        "max_vehicles": 10,          # Default — overridden per-tenant
        "max_users": 15,             # Default — overridden per-tenant
        "customizations_per_month": 4,
        "sub_label": "Tailored",
        "features": get_plan_default_features("professional"),  # Full feature set
        "description": "Custom-built plan for this franchise",
        "tagline": "Bespoke limits and pricing set by Quick Wing"
    }
}


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"      # Platform owner - full access to all tenants
    MASTER_ADMIN = "master_admin"    # Franchise owner - pays for service, manages their tenant
    CONTENT_MANAGER = "content_manager"  # Content manager - access to Content and Subscriptions only
    BOT = "bot"                      # Bot/API access - Franchises tab only (for Open Claw)
    ADMIN = "admin"                  # Admin within tenant (created by master admin)
    STAFF = "staff"                  # Regular staff within a tenant


# ==================== TENANT MODELS ====================

class TenantCreate(BaseModel):
    name: str
    slug: str  # URL-friendly identifier
    plan: TenantPlan = TenantPlan.CUSTOM
    # Optional: Master Admin credentials. If not provided, will be auto-generated
    master_admin_email: Optional[EmailStr] = None  # Now validates email format
    master_admin_name: Optional[str] = None
    # Custom limits (super admin can override plan defaults)
    custom_max_vehicles: Optional[int] = None
    custom_max_users: Optional[int] = None
    # Custom monthly price (€) — required for CUSTOM plan, optional for others
    custom_price: Optional[float] = None
    # Feature overrides (super admin can enable/disable specific features)
    feature_overrides: Optional[dict] = None
    # Demo mode: creates a BLANK tenant with no master admin password. Access
    # is via a magic link URL returned from the create endpoint. No email +
    # password login is possible for demo tenants.
    is_demo: bool = False
    demo_link_expires_in_days: int = 30
    

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
    USER_PASSWORD_RESET = "user_password_reset"
    
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
