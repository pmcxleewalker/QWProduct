"""
Vehicle, Booking, and other tenant-scoped models
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# ==================== VEHICLE MODELS ====================

class VehicleBase(BaseModel):
    name: str
    registration: str
    current_status: str = "Free"
    tax_due_date: Optional[str] = None
    nct_due_date: Optional[str] = None
    service_due_mileage: Optional[int] = None
    current_mileage: Optional[int] = None
    base_location: Optional[str] = None


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    registration: Optional[str] = None
    current_status: Optional[str] = None
    tax_due_date: Optional[str] = None
    nct_due_date: Optional[str] = None
    service_due_mileage: Optional[int] = None
    current_mileage: Optional[int] = None
    base_location: Optional[str] = None
    is_blocked: Optional[bool] = None
    blocked_reason: Optional[str] = None


class Vehicle(VehicleBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # REQUIRED - tenant isolation
    is_blocked: bool = False
    blocked_reason: Optional[str] = None
    blocked_by: Optional[str] = None
    blocked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== BOOKING MODELS ====================

class BookingCreate(BaseModel):
    car_id: str
    user_name: str
    start_time: str
    end_time: str
    purpose: Optional[str] = ""
    location: Optional[str] = ""
    notes: Optional[str] = ""
    is_double_up_call: bool = False
    is_recurring: bool = False
    recurrence_type: Optional[str] = None
    recurrence_end_date: Optional[str] = None
    recurrence_count: Optional[int] = None


class BookingUpdate(BaseModel):
    user_name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    purpose: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    is_double_up_call: Optional[bool] = None


class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # REQUIRED - tenant isolation
    car_id: str
    user_name: str
    start_time: str
    end_time: str
    purpose: str = ""
    location: str = ""
    notes: str = ""
    is_double_up_call: bool = False
    is_recurring: bool = False
    recurrence_type: Optional[str] = None
    recurrence_end_date: Optional[str] = None
    recurrence_count: Optional[int] = None
    recurring_group_id: Optional[str] = None
    status: str = "approved"  # pending, approved, rejected
    created_by_email: str
    created_by_user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== STATUS UPDATE MODELS ====================

class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # REQUIRED - tenant isolation
    car_id: str
    status: str
    location: str = ""
    notes: str = ""
    mileage: Optional[int] = None
    reported_by: str
    reported_by_user_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== PROVIDER MODELS ====================

class ProviderCreate(BaseModel):
    name: str
    service_type: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class Provider(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # REQUIRED - tenant isolation
    name: str
    service_type: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== MESSAGE/ANNOUNCEMENT MODELS ====================

class MessageCreate(BaseModel):
    title: str
    content: str
    priority: str = "normal"
    requires_acknowledgment: bool = False


class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # REQUIRED - tenant isolation
    title: str
    content: str
    priority: str = "normal"
    requires_acknowledgment: bool = False
    created_by: str
    created_by_user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    acknowledged_by: List[str] = []


# ==================== TODO MODELS ====================

class TodoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_mandatory: bool = False
    due_date: Optional[str] = None
    is_daily_reset: bool = False
    reset_time: Optional[str] = None


class Todo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # REQUIRED - tenant isolation
    title: str
    description: Optional[str] = None
    is_mandatory: bool = False
    is_completed: bool = False
    completed_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    due_date: Optional[str] = None
    is_daily_reset: bool = False
    reset_time: Optional[str] = None
    last_reset: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== LIFT REQUEST MODELS ====================

class LiftRequestCreate(BaseModel):
    from_location: str
    to_location: str
    date: str
    time: str
    seats_needed: int = 1
    notes: Optional[str] = None


class LiftRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # REQUIRED - tenant isolation
    from_location: str
    to_location: str
    date: str
    time: str
    seats_needed: int = 1
    notes: Optional[str] = None
    requester_email: str
    requester_name: str
    status: str = "open"
    accepted_by: Optional[str] = None
    accepted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
