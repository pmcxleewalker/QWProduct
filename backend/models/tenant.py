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
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"      # Platform owner - full access to all tenants
    MASTER_ADMIN = "master_admin"    # Franchise owner - pays for service, manages their tenant
    ADMIN = "admin"                  # Admin within tenant (created by master admin)
    STAFF = "staff"                  # Regular staff within a tenant


# ==================== TENANT MODELS ====================

class TenantCreate(BaseModel):
    name: str
    slug: str  # URL-friendly identifier
    plan: TenantPlan = TenantPlan.STARTER
    # Optional: Master Admin credentials. If not provided, will be auto-generated
    master_admin_email: Optional[str] = None
    master_admin_name: Optional[str] = None
    

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[TenantStatus] = None
    plan: Optional[TenantPlan] = None
    subscription_expires_at: Optional[datetime] = None
    max_vehicles: Optional[int] = None
    max_users: Optional[int] = None
    notes: Optional[str] = None


class Tenant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str  # URL-friendly identifier (e.g., "bluebird-care")
    status: TenantStatus = TenantStatus.ACTIVE
    plan: TenantPlan = TenantPlan.STARTER
    subscription_expires_at: Optional[datetime] = None
    max_vehicles: int = 10  # Plan limits
    max_users: int = 20
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
    password: str
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
    USER_ROLE_CHANGED = "user_role_changed"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    
    # Impersonation
    IMPERSONATION_START = "impersonation_start"
    IMPERSONATION_END = "impersonation_end"
    
    # Data actions
    VEHICLE_CREATED = "vehicle_created"
    VEHICLE_DELETED = "vehicle_deleted"
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
