from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import timedelta
import uuid
from datetime import datetime, timezone
import qrcode
from io import BytesIO
import httpx
import json
from pywebpush import webpush, WebPushException

# Import auth utilities
from auth import (
    get_password_hash, 
    verify_password, 
    create_access_token,
    get_current_user,
    get_current_admin_user,
    generate_invite_token
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# VAPID keys for push notifications
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:admin@quickwing.com')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ==================== AUTHENTICATION MODELS ====================

# Master Admin email - has elevated permissions
MASTER_ADMIN_EMAIL = "carlyodonovan@bluebirdcare.ie"

class UserBase(BaseModel):
    email: EmailStr
    role: str = "staff"  # admin or staff

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    invite_token: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    is_master_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInvite(BaseModel):
    email: EmailStr
    role: str = "staff"

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

class AdminDeleteRequest(BaseModel):
    master_admin_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ==================== CAR MODELS ====================

class CarBase(BaseModel):
    name: str
    registration: str
    current_status: str = "Free"
    base_location: Optional[str] = None  # Tralee, Bantry, or other base location
    # Compliance dates
    tax_due_date: Optional[str] = None
    nct_due_date: Optional[str] = None
    # Mileage tracking
    current_mileage: Optional[int] = None
    service_due_mileage: Optional[int] = None
    last_mileage_update: Optional[str] = None
    last_mileage_updated_by: Optional[str] = None
    # Blocking feature
    is_blocked: bool = False
    block_reason: Optional[str] = None  # Service, Cleaning, Other
    blocked_by: Optional[str] = None
    blocked_at: Optional[str] = None

class CarCreate(CarBase):
    pass

class Car(CarBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    qr_code_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MileageUpdate(BaseModel):
    mileage: int


# ==================== STATUS UPDATE MODELS ====================

class StatusUpdateCreate(BaseModel):
    car_id: str
    status: str
    notes: Optional[str] = ""
    user_name: Optional[str] = "Anonymous"
    location: Optional[str] = ""

class StatusUpdate(StatusUpdateCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== BOOKING MODELS ====================

class BookingCreate(BaseModel):
    car_id: str
    user_name: str
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = ""  # Purpose of the booking
    location: Optional[str] = ""  # Eircode or location where car will be
    is_double_up_call: bool = False  # Double up call indicator for reports
    # Recurring booking fields
    is_recurring: bool = False
    recurrence_type: Optional[str] = None  # daily, weekly, monthly
    recurrence_end_date: Optional[datetime] = None
    recurrence_count: Optional[int] = None  # Number of occurrences

class Booking(BookingCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by_email: Optional[str] = None  # Track who created the booking
    status: str = "approved"  # approved, pending_approval, rejected
    recurring_group_id: Optional[str] = None  # Links recurring bookings together
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== ADMIN MESSAGE MODELS ====================

class AdminMessageCreate(BaseModel):
    title: str
    content: str
    requires_acknowledgment: bool = True
    is_active: bool = True

class AdminMessage(AdminMessageCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageAcknowledgment(BaseModel):
    message_id: str
    user_email: str
    acknowledged_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== PUSH NOTIFICATION MODELS ====================

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # Contains p256dh and auth keys

class PushSubscriptionCreate(BaseModel):
    subscription: dict  # The full subscription object from browser
    user_email: str


# ==================== TO DO LIST MODELS ====================

class TodoItemCreate(BaseModel):
    title: str
    is_mandatory: bool = False
    # Scheduling options for recurring tasks
    schedule_type: Optional[str] = None  # 'daily', 'weekly', 'monthly', or None for one-time
    schedule_days: Optional[List[int]] = None  # For weekly: [0-6] (Sun-Sat), For monthly: [1-31]

class TodoItemUpdate(BaseModel):
    title: Optional[str] = None
    is_mandatory: Optional[bool] = None
    is_completed: Optional[bool] = None
    schedule_type: Optional[str] = None
    schedule_days: Optional[List[int]] = None

class TodoItem(TodoItemCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_completed: bool = False
    created_by: Optional[str] = None
    completed_by: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== LIFT REQUEST MODELS ====================

class LiftRequestCreate(BaseModel):
    requester_name: str  # Who needs the lift
    from_location: str   # From where
    to_location: str     # To where
    lift_date: str       # Date of lift (ISO format)
    lift_time: str       # Time of lift (HH:MM format)
    notes: Optional[str] = ""

class LiftRequest(LiftRequestCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_email: str  # Email of the staff who created the request
    status: str = "active"  # active, accepted, cancelled
    accepted_by_email: Optional[str] = None
    accepted_by_name: Optional[str] = None
    accepted_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== ASSISTANCE PROVIDER MODELS ====================

class AssistanceProviderCreate(BaseModel):
    region: str
    name: str
    phone: str
    service_type: str

class AssistanceProvider(AssistanceProviderCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== CAR BLOCK MODELS ====================

class CarBlockCreate(BaseModel):
    reason: str  # Service, Cleaning, Other

class CarUnblockCreate(BaseModel):
    sign_off_notes: Optional[str] = ""


# ==================== CAR UPDATE MODEL ====================

class CarUpdate(BaseModel):
    name: Optional[str] = None
    registration: Optional[str] = None
    current_status: Optional[str] = None
    tax_due_date: Optional[str] = None
    nct_due_date: Optional[str] = None
    service_due_date: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

def serialize_datetime(doc):
    if isinstance(doc, dict):
        for key, value in doc.items():
            if isinstance(value, datetime):
                doc[key] = value.isoformat()
    return doc

def deserialize_datetime(doc, fields):
    if doc:
        for field in fields:
            if field in doc and isinstance(doc[field], str):
                doc[field] = datetime.fromisoformat(doc[field])
    return doc


# ==================== AUTHENTICATION ENDPOINTS ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user with an invite token"""
    # Check if invite token is valid
    invite = await db.invites.find_one({"token": user_data.invite_token, "used": False}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invite token")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    user_obj = User(email=user_data.email, role=invite.get('role', 'staff'))
    user_dict = user_obj.model_dump()
    user_dict['password_hash'] = get_password_hash(user_data.password)
    user_dict = serialize_datetime(user_dict)
    
    await db.users.insert_one(user_dict)
    
    # Mark invite as used
    await db.invites.update_one({"token": user_data.invite_token}, {"$set": {"used": True}})
    
    # Create access token
    access_token = create_access_token(data={"sub": user_obj.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user_obj.id, "email": user_obj.email, "role": user_obj.role}
    }


@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login user with email and password"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    if not user.get('is_active', True):
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    access_token = create_access_token(data={"sub": user['id']})
    
    # Check if user is master admin
    is_master_admin = user['email'] == MASTER_ADMIN_EMAIL
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user['id'], 
            "email": user['email'], 
            "role": user['role'],
            "is_master_admin": is_master_admin
        }
    }


@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user"""
    deserialize_datetime(current_user, ['created_at'])
    # Remove password_hash before returning
    current_user.pop('password_hash', None)
    # Add master admin flag
    current_user['is_master_admin'] = current_user.get('email') == MASTER_ADMIN_EMAIL
    return current_user


@api_router.post("/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change current user's password"""
    # Verify current password
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user or not verify_password(password_data.current_password, user['password_hash']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    new_hash = get_password_hash(password_data.new_password)
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"password_hash": new_hash, "must_change_password": False}}
    )
    
    return {"message": "Password changed successfully"}


# ==================== ADMIN USER MANAGEMENT ENDPOINTS ====================

class DirectUserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "staff"


class InitialSetup(BaseModel):
    company_name: str
    admin_email: EmailStr
    admin_password: str


@api_router.post("/setup/initial")
async def initial_setup(setup_data: InitialSetup):
    """Initial setup endpoint - only works when no admin exists (for new franchise setup)"""
    # Check if any admin already exists
    existing_admin = await db.users.find_one({"role": "admin"}, {"_id": 0})
    if existing_admin:
        raise HTTPException(
            status_code=400, 
            detail="Setup already completed. An admin account already exists."
        )
    
    # Create the master admin account
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": setup_data.admin_email,
        "password_hash": get_password_hash(setup_data.admin_password),
        "role": "admin",
        "is_active": True,
        "must_change_password": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "initial_setup"
    }
    
    await db.users.insert_one(admin_user)
    
    # Store company settings
    await db.settings.update_one(
        {"key": "company"},
        {"$set": {
            "key": "company",
            "name": setup_data.company_name,
            "setup_completed": True,
            "setup_date": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "message": "Setup completed successfully",
        "company_name": setup_data.company_name,
        "admin_email": setup_data.admin_email
    }


@api_router.get("/setup/status")
async def get_setup_status():
    """Check if initial setup has been completed"""
    existing_admin = await db.users.find_one({"role": "admin"}, {"_id": 0})
    settings = await db.settings.find_one({"key": "company"}, {"_id": 0})
    
    return {
        "setup_completed": existing_admin is not None,
        "company_name": settings.get("name") if settings else None
    }


@api_router.post("/admin/users/create")
async def create_user_directly(user_data: DirectUserCreate, current_admin: dict = Depends(get_current_admin_user)):
    """Admin: Create a user account directly with a password"""
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Create new user
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "role": user_data.role,
        "is_active": True,
        "must_change_password": True,  # Flag to prompt password change on first login
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_admin['email']
    }
    
    await db.users.insert_one(new_user)
    
    return {
        "message": "User created successfully",
        "user": {
            "id": new_user['id'],
            "email": new_user['email'],
            "role": new_user['role']
        }
    }


class AdminPasswordReset(BaseModel):
    new_password: str

@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_user_password(user_id: str, data: AdminPasswordReset, current_admin: dict = Depends(get_current_admin_user)):
    """Admin: Reset any user's password (except Master Admin unless you ARE Master Admin)"""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Find the user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only Master Admin can reset Master Admin's password
    if user.get('email') == MASTER_ADMIN_EMAIL:
        if current_admin.get('email') != MASTER_ADMIN_EMAIL:
            raise HTTPException(
                status_code=403, 
                detail="Only Master Admin can change their own password"
            )
    
    # Update password
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "password_hash": get_password_hash(data.new_password),
            "password_reset_by": current_admin['email'],
            "password_reset_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Password reset successfully for {user['email']}"}


@api_router.post("/admin/users/invite")
async def invite_user(invite_data: UserInvite, current_admin: dict = Depends(get_current_admin_user)):
    """Admin: Create invite link for new user"""
    # Check if user already exists
    existing_user = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Generate invite token
    token = generate_invite_token()
    # HARDCODED: Always use the production URL for invites
    frontend_url = "https://cartrack-19.emergent.host"
    invite_url = f"{frontend_url}/register?token={token}"
    
    # Store invite in database
    invite_doc = {
        "id": str(uuid.uuid4()),
        "email": invite_data.email,
        "role": invite_data.role,
        "token": token,
        "used": False,
        "created_by": current_admin['id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.invites.insert_one(invite_doc)
    
    return {
        "message": "Invite created successfully",
        "invite_url": invite_url,
        "email": invite_data.email,
        "role": invite_data.role
    }


@api_router.get("/admin/users", response_model=List[User])
async def list_users(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    current_admin: dict = Depends(get_current_admin_user)
):
    """Admin: Get all users with pagination"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    for user in users:
        deserialize_datetime(user, ['created_at'])
        # Add master admin flag
        user['is_master_admin'] = user.get('email') == MASTER_ADMIN_EMAIL
    return users


@api_router.put("/admin/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate, current_admin: dict = Depends(get_current_admin_user)):
    """Admin: Update user role or status"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot modify master admin's role
    if user.get('email') == MASTER_ADMIN_EMAIL and user_update.role:
        raise HTTPException(status_code=403, detail="Cannot modify Master Admin's role")
    
    update_data = user_update.model_dump(exclude_unset=True)
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    deserialize_datetime(updated_user, ['created_at'])
    updated_user['is_master_admin'] = updated_user.get('email') == MASTER_ADMIN_EMAIL
    return updated_user


@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_admin: dict = Depends(get_current_admin_user)):
    """Admin: Deactivate staff user (admin deletion requires master admin)"""
    # Prevent admin from deleting themselves
    if user_id == current_admin['id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Check if target user is an admin
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If target is an admin, only master admin can delete them
    if target_user.get('role') == 'admin':
        if current_admin.get('email') != MASTER_ADMIN_EMAIL:
            raise HTTPException(
                status_code=403, 
                detail="Only Master Admin can delete admin accounts. Please contact Carly O'Donovan."
            )
    
    # Cannot delete the master admin
    if target_user.get('email') == MASTER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Cannot delete the Master Admin account")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deactivated successfully"}


@api_router.post("/admin/users/{user_id}/delete-admin")
async def delete_admin_user(user_id: str, request: AdminDeleteRequest, current_admin: dict = Depends(get_current_admin_user)):
    """Master Admin only: Delete an admin user with password verification"""
    # Only master admin can use this endpoint
    if current_admin.get('email') != MASTER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Only Master Admin can delete admin accounts")
    
    # Verify master admin's password
    master_admin = await db.users.find_one({"email": MASTER_ADMIN_EMAIL}, {"_id": 0})
    if not master_admin or not verify_password(request.master_admin_password, master_admin.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid Master Admin password")
    
    # Check target user
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot delete self
    if user_id == current_admin['id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Cannot delete master admin
    if target_user.get('email') == MASTER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Cannot delete the Master Admin account")
    
    # Deactivate the admin
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"Admin user {target_user.get('email')} has been deactivated"}


@api_router.get("/admin/master-admin-check")
async def check_master_admin(current_user: dict = Depends(get_current_user)):
    """Check if current user is the master admin"""
    is_master = current_user.get('email') == MASTER_ADMIN_EMAIL
    return {
        "is_master_admin": is_master,
        "master_admin_email": MASTER_ADMIN_EMAIL if is_master else None
    }


# ==================== CAR ENDPOINTS (Protected) ====================

@api_router.get("/")
async def root():
    return {"message": "Quick Wing Fleet Management API"}


@api_router.post("/cars", response_model=Car)
async def create_car(car: CarCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Create a new car"""
    car_obj = Car(**car.model_dump())
    car_obj.qr_code_url = f"/api/cars/{car_obj.id}/qr"
    
    doc = serialize_datetime(car_obj.model_dump())
    await db.cars.insert_one(doc)
    return car_obj


@api_router.get("/cars", response_model=List[Car])
async def get_cars(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get all cars (authenticated users) with pagination"""
    cars = await db.cars.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    for car in cars:
        deserialize_datetime(car, ['created_at'])
    return cars


@api_router.get("/cars/{car_id}", response_model=Car)
async def get_car(car_id: str):
    """Get a specific car (public for QR code access)"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    deserialize_datetime(car, ['created_at'])
    return car


@api_router.put("/cars/{car_id}", response_model=Car)
async def update_car(car_id: str, car_update: CarCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Update a car"""
    existing_car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not existing_car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    update_data = car_update.model_dump()
    await db.cars.update_one({"id": car_id}, {"$set": update_data})
    
    updated_car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    deserialize_datetime(updated_car, ['created_at'])
    return updated_car


@api_router.delete("/cars/{car_id}")
async def delete_car(car_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Delete a car"""
    result = await db.cars.delete_one({"id": car_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Car not found")
    return {"message": "Car deleted successfully"}


@api_router.get("/cars/{car_id}/qr")
async def get_car_qr_code(car_id: str):
    """Generate QR code for a car (public) - directs to mileage update page"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # HARDCODED: Always use the production URL for QR codes
    frontend_url = "https://cartrack-19.emergent.host"
    # Direct to mileage update page
    qr_url = f"{frontend_url}/mileage?car={car_id}"
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")


# ==================== CAR BLOCKING ENDPOINTS ====================

@api_router.post("/cars/{car_id}/block")
async def block_car(car_id: str, block_data: CarBlockCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Block a car for service/cleaning/other"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    if car.get('is_blocked'):
        raise HTTPException(status_code=400, detail="Car is already blocked")
    
    update_data = {
        "is_blocked": True,
        "block_reason": block_data.reason,
        "blocked_by": current_user['email'],
        "blocked_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cars.update_one({"id": car_id}, {"$set": update_data})
    
    return {"message": f"Car blocked for {block_data.reason}", "car_id": car_id}


@api_router.post("/cars/{car_id}/unblock")
async def unblock_car(car_id: str, unblock_data: CarUnblockCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Unblock a car (sign off)"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    if not car.get('is_blocked'):
        raise HTTPException(status_code=400, detail="Car is not blocked")
    
    # Log the unblock action
    unblock_log = {
        "id": str(uuid.uuid4()),
        "car_id": car_id,
        "action": "unblock",
        "previous_reason": car.get('block_reason'),
        "sign_off_by": current_user['email'],
        "sign_off_notes": unblock_data.sign_off_notes,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.car_block_logs.insert_one(unblock_log)
    
    update_data = {
        "is_blocked": False,
        "block_reason": None,
        "blocked_by": None,
        "blocked_at": None
    }
    
    await db.cars.update_one({"id": car_id}, {"$set": update_data})
    
    return {"message": "Car unblocked successfully", "car_id": car_id}


# ==================== ADMIN STATUS UPDATE ENDPOINT ====================

class AdminStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = ""
    location: Optional[str] = ""

@api_router.put("/admin/cars/{car_id}/status")
async def admin_update_car_status(car_id: str, status_data: AdminStatusUpdate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Update a car's status directly"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Create a status update record
    status_obj = StatusUpdate(
        car_id=car_id,
        status=status_data.status,
        notes=status_data.notes or "Status updated by admin",
        user_name=current_user['email'],
        location=status_data.location or ""
    )
    doc = serialize_datetime(status_obj.model_dump())
    await db.status_updates.insert_one(doc)
    
    # Update the car's current status
    await db.cars.update_one(
        {"id": car_id},
        {"$set": {"current_status": status_data.status}}
    )
    
    return {
        "message": f"Car status updated to '{status_data.status}'",
        "car_id": car_id,
        "status": status_data.status
    }


@api_router.put("/cars/{car_id}/mileage")
async def update_car_mileage(
    car_id: str,
    mileage_data: MileageUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update car mileage (accessible via QR code scan by any authenticated user)"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    if mileage_data.mileage < 0:
        raise HTTPException(status_code=400, detail="Mileage cannot be negative")
    
    # Check if new mileage is less than current (possible odometer rollback warning)
    current_mileage = car.get('current_mileage')
    if current_mileage and mileage_data.mileage < current_mileage:
        # Allow but log a warning - could be a correction
        pass
    
    # Update the car's mileage
    update_data = {
        "current_mileage": mileage_data.mileage,
        "last_mileage_update": datetime.now(timezone.utc).isoformat(),
        "last_mileage_updated_by": current_user.get('email', 'Unknown')
    }
    
    await db.cars.update_one(
        {"id": car_id},
        {"$set": update_data}
    )
    
    # Check if service is due
    service_due_mileage = car.get('service_due_mileage')
    service_warning = None
    if service_due_mileage and mileage_data.mileage >= service_due_mileage:
        service_warning = f"⚠️ Service due! Current: {mileage_data.mileage} km, Service due at: {service_due_mileage} km"
    elif service_due_mileage and mileage_data.mileage >= (service_due_mileage - 500):
        service_warning = f"⚠️ Service approaching! Current: {mileage_data.mileage} km, Service due at: {service_due_mileage} km"
    
    return {
        "message": "Mileage updated successfully",
        "car_id": car_id,
        "car_name": car.get('name'),
        "current_mileage": mileage_data.mileage,
        "service_warning": service_warning
    }


@api_router.get("/cars/{car_id}/details")
async def get_car_details(car_id: str):
    """Get car details (public endpoint for QR code scans before login)"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    return {
        "id": car.get('id'),
        "name": car.get('name'),
        "registration": car.get('registration'),
        "current_mileage": car.get('current_mileage'),
        "last_mileage_update": car.get('last_mileage_update')
    }


# ==================== COMPLIANCE ALERTS ENDPOINT ====================

@api_router.get("/admin/compliance-alerts")
async def get_compliance_alerts(current_user: dict = Depends(get_current_admin_user)):
    """Admin: Get cars with upcoming compliance dates (within 30 days)"""
    cars = await db.cars.find({}, {"_id": 0}).to_list(1000)
    
    alerts = []
    today = datetime.now(timezone.utc).date()
    alert_threshold = today + timedelta(days=30)
    
    for car in cars:
        car_alerts = []
        
        # Check Tax due date
        if car.get('tax_due_date'):
            try:
                tax_date = datetime.fromisoformat(car['tax_due_date'].replace('Z', '+00:00')).date()
                if tax_date <= alert_threshold:
                    days_until = (tax_date - today).days
                    car_alerts.append({
                        "type": "Tax",
                        "due_date": car['tax_due_date'],
                        "days_until": days_until,
                        "is_overdue": days_until < 0
                    })
            except (ValueError, TypeError):
                pass
        
        # Check NCT due date
        if car.get('nct_due_date'):
            try:
                nct_date = datetime.fromisoformat(car['nct_due_date'].replace('Z', '+00:00')).date()
                if nct_date <= alert_threshold:
                    days_until = (nct_date - today).days
                    car_alerts.append({
                        "type": "NCT",
                        "due_date": car['nct_due_date'],
                        "days_until": days_until,
                        "is_overdue": days_until < 0
                    })
            except (ValueError, TypeError):
                pass
        
        # Check Service due date
        if car.get('service_due_date'):
            try:
                service_date = datetime.fromisoformat(car['service_due_date'].replace('Z', '+00:00')).date()
                if service_date <= alert_threshold:
                    days_until = (service_date - today).days
                    car_alerts.append({
                        "type": "Service",
                        "due_date": car['service_due_date'],
                        "days_until": days_until,
                        "is_overdue": days_until < 0
                    })
            except (ValueError, TypeError):
                pass
        
        if car_alerts:
            alerts.append({
                "car_id": car['id'],
                "car_name": car['name'],
                "registration": car['registration'],
                "alerts": car_alerts
            })
    
    # Sort by most urgent (lowest days_until)
    alerts.sort(key=lambda x: min(a['days_until'] for a in x['alerts']))
    
    return alerts


# ==================== REPORTS ENDPOINTS ====================

@api_router.get("/admin/reports/fleet-usage")
async def get_fleet_usage_report(
    start_date: Optional[str] = Query(None, description="Filter bookings from this date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter bookings until this date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin: Get fleet usage report with booking statistics, optionally filtered by date range"""
    
    # Get all cars
    cars = await db.cars.find({}, {"_id": 0}).to_list(100)
    car_map = {car['id']: car for car in cars}
    
    # Build booking query with optional date filter
    booking_query = {}
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = f"{start_date}T00:00:00"
        if end_date:
            date_filter["$lte"] = f"{end_date}T23:59:59"
        if date_filter:
            booking_query["start_time"] = date_filter
    
    # Get bookings (filtered if dates provided)
    bookings = await db.bookings.find(booking_query, {"_id": 0}).to_list(5000)
    
    # Get all status updates
    status_updates = await db.status_updates.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate statistics per car
    car_stats = {}
    for car in cars:
        car_id = car['id']
        car_bookings = [b for b in bookings if b.get('car_id') == car_id]
        car_statuses = [s for s in status_updates if s.get('car_id') == car_id]
        
        # Count bookings by status
        approved_bookings = [b for b in car_bookings if b.get('status') == 'approved']
        pending_bookings = [b for b in car_bookings if b.get('status') == 'pending_approval']
        
        # Count "In Use" status updates
        in_use_count = len([s for s in car_statuses if s.get('status') == 'In Use'])
        
        car_stats[car_id] = {
            "car_id": car_id,
            "car_name": car['name'],
            "registration": car['registration'],
            "current_status": car.get('current_status', 'Unknown'),
            "total_bookings": len(car_bookings),
            "approved_bookings": len(approved_bookings),
            "pending_bookings": len(pending_bookings),
            "status_updates": len(car_statuses),
            "in_use_count": in_use_count,
            "is_blocked": car.get('is_blocked', False)
        }
    
    # Sort cars by total bookings (most booked first)
    sorted_by_bookings = sorted(car_stats.values(), key=lambda x: x['total_bookings'], reverse=True)
    
    # Sort cars by usage (in_use_count)
    sorted_by_usage = sorted(car_stats.values(), key=lambda x: x['in_use_count'], reverse=True)
    
    # Get least used cars (non-zero bookings at bottom, zero at top)
    least_used = sorted(car_stats.values(), key=lambda x: x['total_bookings'])
    
    # Calculate totals
    total_bookings = sum(s['total_bookings'] for s in car_stats.values())
    total_approved = sum(s['approved_bookings'] for s in car_stats.values())
    total_pending = sum(s['pending_bookings'] for s in car_stats.values())
    
    # Get unique bookers
    unique_users = set(b.get('user_name', '') for b in bookings if b.get('user_name'))
    
    # Group cars by base_location for location-based stats
    location_stats = {}
    for car in cars:
        loc = car.get('base_location') or 'Unassigned'
        if loc not in location_stats:
            location_stats[loc] = {'total': 0, 'blocked': 0, 'booked': 0}
        location_stats[loc]['total'] += 1
        if car.get('is_blocked'):
            location_stats[loc]['blocked'] += 1
    
    return {
        "summary": {
            "total_vehicles": len(cars),
            "total_bookings": total_bookings,
            "approved_bookings": total_approved,
            "pending_bookings": total_pending,
            "unique_users": len(unique_users),
            "blocked_vehicles": len([c for c in cars if c.get('is_blocked')])
        },
        "most_booked": sorted_by_bookings[:10],
        "most_used": sorted_by_usage[:10],
        "least_used": least_used[:10],
        "all_cars": list(car_stats.values()),
        "location_stats": location_stats,
        "date_range": {
            "start": start_date,
            "end": end_date
        } if start_date or end_date else None
    }


@api_router.get("/admin/reports/cars-without-bookings")
async def get_cars_without_bookings(
    date: str = Query(..., description="Date to check for bookings (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin: Get cars that have no bookings on a specific date, grouped by location"""
    
    # Get all active (non-blocked) cars
    cars = await db.cars.find({"is_blocked": {"$ne": True}}, {"_id": 0}).to_list(100)
    
    # Get all approved bookings for the specified date
    start_of_day = f"{date}T00:00:00"
    end_of_day = f"{date}T23:59:59"
    
    bookings = await db.bookings.find({
        "status": "approved",
        "$or": [
            {"start_time": {"$gte": start_of_day, "$lte": end_of_day}},
            {"end_time": {"$gte": start_of_day, "$lte": end_of_day}},
            {"start_time": {"$lte": start_of_day}, "end_time": {"$gte": end_of_day}}
        ]
    }, {"_id": 0}).to_list(500)
    
    # Create car map for quick lookup
    car_map = {car['id']: car for car in cars}
    
    # Calculate availability for each car
    car_availability = {}
    for car in cars:
        car_id = car['id']
        car_bookings = [b for b in bookings if b.get('car_id') == car_id]
        
        # Calculate free time slots (assume 8am-6pm working hours = 10 hours = 600 minutes)
        working_start = 8 * 60  # 8:00 AM in minutes
        working_end = 18 * 60   # 6:00 PM in minutes
        total_working_minutes = working_end - working_start
        
        # Calculate booked minutes
        booked_minutes = 0
        booked_slots = []
        for booking in car_bookings:
            try:
                b_start = datetime.fromisoformat(booking['start_time'].replace('Z', '+00:00'))
                b_end = datetime.fromisoformat(booking['end_time'].replace('Z', '+00:00'))
                
                # Convert to minutes from midnight
                start_mins = b_start.hour * 60 + b_start.minute
                end_mins = b_end.hour * 60 + b_end.minute
                
                # Clip to working hours
                start_mins = max(start_mins, working_start)
                end_mins = min(end_mins, working_end)
                
                if end_mins > start_mins:
                    booked_minutes += (end_mins - start_mins)
                    booked_slots.append({
                        'start': f"{start_mins // 60:02d}:{start_mins % 60:02d}",
                        'end': f"{end_mins // 60:02d}:{end_mins % 60:02d}",
                        'user': booking.get('user_name', 'Unknown'),
                        'is_double_up': booking.get('is_double_up_call', False)
                    })
            except:
                pass
        
        free_minutes = total_working_minutes - booked_minutes
        location = car.get('base_location') or 'Unassigned'
        
        car_availability[car_id] = {
            'id': car_id,
            'name': car['name'],
            'registration': car['registration'],
            'location': location,
            'total_bookings': len(car_bookings),
            'booked_minutes': booked_minutes,
            'free_minutes': free_minutes,
            'free_hours': round(free_minutes / 60, 1),
            'utilization_percent': round((booked_minutes / total_working_minutes) * 100, 1) if total_working_minutes > 0 else 0,
            'is_fully_free': len(car_bookings) == 0,
            'booked_slots': booked_slots,
            'current_status': car.get('current_status', 'Unknown')
        }
    
    # Group by location
    cars_by_location = {}
    for car_data in car_availability.values():
        loc = car_data['location']
        if loc not in cars_by_location:
            cars_by_location[loc] = []
        cars_by_location[loc].append(car_data)
    
    # Calculate location summaries
    location_summaries = {}
    for loc, loc_cars in cars_by_location.items():
        fully_free = [c for c in loc_cars if c['is_fully_free']]
        partially_free = [c for c in loc_cars if not c['is_fully_free'] and c['free_minutes'] > 0]
        fully_booked = [c for c in loc_cars if c['free_minutes'] == 0]
        total_free_hours = sum(c['free_hours'] for c in loc_cars)
        avg_utilization = sum(c['utilization_percent'] for c in loc_cars) / len(loc_cars) if loc_cars else 0
        
        location_summaries[loc] = {
            'total_cars': len(loc_cars),
            'fully_free': len(fully_free),
            'partially_free': len(partially_free),
            'fully_booked': len(fully_booked),
            'total_free_hours': round(total_free_hours, 1),
            'avg_utilization': round(avg_utilization, 1)
        }
    
    # Time slot analysis (hourly breakdown)
    time_slots = {}
    for hour in range(8, 18):  # 8am to 6pm
        slot_key = f"{hour:02d}:00"
        slot_start = hour * 60
        slot_end = (hour + 1) * 60
        
        free_cars = 0
        booked_cars = 0
        for car_data in car_availability.values():
            is_booked_this_hour = False
            for slot in car_data['booked_slots']:
                slot_start_mins = int(slot['start'].split(':')[0]) * 60 + int(slot['start'].split(':')[1])
                slot_end_mins = int(slot['end'].split(':')[0]) * 60 + int(slot['end'].split(':')[1])
                if slot_start_mins < slot_end and slot_end_mins > slot_start:
                    is_booked_this_hour = True
                    break
            if is_booked_this_hour:
                booked_cars += 1
            else:
                free_cars += 1
        
        time_slots[slot_key] = {
            'free': free_cars,
            'booked': booked_cars,
            'total': len(cars)
        }
    
    return {
        "date": date,
        "cars_by_location": cars_by_location,
        "location_summaries": location_summaries,
        "time_slots": time_slots,
        "total_cars": len(cars),
        "total_available": len([c for c in car_availability.values() if c['is_fully_free']]),
        "total_partially_free": len([c for c in car_availability.values() if not c['is_fully_free'] and c['free_minutes'] > 0]),
        "total_fully_booked": len([c for c in car_availability.values() if c['free_minutes'] == 0]),
        "locations": list(cars_by_location.keys()),
        "all_cars": list(car_availability.values())
    }
@api_router.get("/admin/reports/booking-charts")
async def get_booking_charts_data(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin: Get booking data aggregated for charts and audit purposes"""
    
    # Build query
    query = {}
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = f"{start_date}T00:00:00"
        if end_date:
            date_filter["$lte"] = f"{end_date}T23:59:59"
        if date_filter:
            query["start_time"] = date_filter
    
    # Get bookings
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(5000)
    cars = await db.cars.find({}, {"_id": 0}).to_list(100)
    car_map = {car['id']: car for car in cars}
    
    # Bookings by status
    status_counts = {}
    for b in bookings:
        status = b.get('status', 'unknown')
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Double up call stats
    double_up_count = len([b for b in bookings if b.get('is_double_up_call', False)])
    single_call_count = len(bookings) - double_up_count
    
    # Bookings by car
    car_counts = {}
    for b in bookings:
        car_id = b.get('car_id')
        car_name = car_map.get(car_id, {}).get('name', 'Unknown')
        car_counts[car_name] = car_counts.get(car_name, 0) + 1
    
    # Bookings by user
    user_counts = {}
    for b in bookings:
        user = b.get('user_name', 'Unknown')
        user_counts[user] = user_counts.get(user, 0) + 1
    
    # Bookings by day of week
    day_counts = {i: 0 for i in range(7)}
    day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    for b in bookings:
        try:
            start = datetime.fromisoformat(b['start_time'].replace('Z', '+00:00'))
            day_counts[start.weekday()] = day_counts.get(start.weekday(), 0) + 1
        except:
            pass
    
    # Bookings over time (by month)
    monthly_counts = {}
    for b in bookings:
        try:
            start = datetime.fromisoformat(b['start_time'].replace('Z', '+00:00'))
            month_key = start.strftime('%Y-%m')
            monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
        except:
            pass
    
    # Recurring vs one-time
    recurring_count = len([b for b in bookings if b.get('is_recurring') or b.get('recurring_group_id')])
    one_time_count = len(bookings) - recurring_count
    
    # Bookings by location (base_location of car)
    location_counts = {}
    for b in bookings:
        car_id = b.get('car_id')
        location = car_map.get(car_id, {}).get('base_location') or 'Unassigned'
        location_counts[location] = location_counts.get(location, 0) + 1
    
    return {
        "total_bookings": len(bookings),
        "date_range": {"start": start_date, "end": end_date},
        "by_status": [{"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: -x[1])],
        "by_car": [{"car": k, "count": v} for k, v in sorted(car_counts.items(), key=lambda x: -x[1])[:15]],
        "by_user": [{"user": k, "count": v} for k, v in sorted(user_counts.items(), key=lambda x: -x[1])[:15]],
        "by_day_of_week": [{"day": day_names[i], "count": day_counts.get(i, 0)} for i in range(7)],
        "by_month": [{"month": k, "count": v} for k, v in sorted(monthly_counts.items())],
        "recurring_vs_onetime": {"recurring": recurring_count, "one_time": one_time_count},
        "double_up_calls": {"double_up": double_up_count, "single": single_call_count},
        "by_location": [{"location": k, "count": v} for k, v in sorted(location_counts.items(), key=lambda x: -x[1])]
    }


@api_router.get("/admin/reports/export")
async def export_fleet_report(current_user: dict = Depends(get_current_admin_user)):
    """Admin: Export fleet report as CSV"""
    import csv
    from io import StringIO
    
    # Get all cars
    cars = await db.cars.find({}, {"_id": 0}).to_list(100)
    
    # Get all bookings
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(1000)
    
    # Get all status updates
    status_updates = await db.status_updates.find({}, {"_id": 0}).to_list(1000)
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'Car Name', 'Registration', 'Current Status', 'Total Bookings', 
        'Approved Bookings', 'Pending Bookings', 'Status Updates', 
        'In Use Count', 'Is Blocked'
    ])
    
    # Data rows
    for car in cars:
        car_id = car['id']
        car_bookings = [b for b in bookings if b.get('car_id') == car_id]
        car_statuses = [s for s in status_updates if s.get('car_id') == car_id]
        
        approved = len([b for b in car_bookings if b.get('status') == 'approved'])
        pending = len([b for b in car_bookings if b.get('status') == 'pending_approval'])
        in_use = len([s for s in car_statuses if s.get('status') == 'In Use'])
        
        writer.writerow([
            car['name'],
            car['registration'],
            car.get('current_status', 'Unknown'),
            len(car_bookings),
            approved,
            pending,
            len(car_statuses),
            in_use,
            'Yes' if car.get('is_blocked') else 'No'
        ])
    
    # Return CSV response
    output.seek(0)
    from fastapi.responses import StreamingResponse
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=fleet_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@api_router.get("/admin/reports/daily-availability")
async def get_daily_availability_report(
    date: str = Query(None, description="Date in YYYY-MM-DD format, defaults to today"),
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin: Get daily availability report showing all cars and their hourly availability"""
    # Parse the date
    if date:
        try:
            check_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            check_date = datetime.now(timezone.utc)
    else:
        check_date = datetime.now(timezone.utc)
    
    # Get all cars (excluding blocked)
    cars = await db.cars.find({"is_blocked": {"$ne": True}}, {"_id": 0}).to_list(100)
    
    # Get all approved bookings for the date
    start_of_day = check_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = check_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    bookings = await db.bookings.find({
        "status": "approved"
    }, {"_id": 0}).to_list(1000)
    
    # Filter bookings for this date
    day_bookings = []
    for booking in bookings:
        try:
            b_start = booking.get('start_time')
            b_end = booking.get('end_time')
            
            if isinstance(b_start, str):
                b_start = datetime.fromisoformat(b_start.replace('Z', '+00:00'))
            if isinstance(b_end, str):
                b_end = datetime.fromisoformat(b_end.replace('Z', '+00:00'))
            
            if b_start.tzinfo is None:
                b_start = b_start.replace(tzinfo=timezone.utc)
            if b_end.tzinfo is None:
                b_end = b_end.replace(tzinfo=timezone.utc)
            
            # Check if booking overlaps with this day
            if b_start <= end_of_day and b_end >= start_of_day:
                day_bookings.append({
                    **booking,
                    'start_time_dt': b_start,
                    'end_time_dt': b_end
                })
        except Exception:
            continue
    
    # Working hours 7 AM to 11 PM
    work_hours = list(range(7, 23))  # 7:00 to 22:00
    
    # Build availability matrix for each car
    car_availability = []
    for car in cars:
        car_id = car['id']
        car_bookings = [b for b in day_bookings if b.get('car_id') == car_id]
        
        hourly_status = []
        for hour in work_hours:
            slot_start = check_date.replace(hour=hour, minute=0, second=0, tzinfo=timezone.utc)
            slot_end = check_date.replace(hour=hour + 1, minute=0, second=0, tzinfo=timezone.utc)
            
            # Check if slot is in the past
            now = datetime.now(timezone.utc)
            if slot_end < now:
                hourly_status.append({
                    "hour": hour,
                    "time_display": f"{hour:02d}:00",
                    "status": "past",
                    "booked_by": None,
                    "is_recurring": False
                })
            else:
                # Check if slot overlaps with any booking
                is_booked = False
                booked_by = None
                is_recurring = False
                booking_purpose = None
                
                for booking in car_bookings:
                    if booking['start_time_dt'] < slot_end and booking['end_time_dt'] > slot_start:
                        is_booked = True
                        booked_by = booking.get('user_name', 'Unknown')
                        is_recurring = booking.get('is_recurring', False) or booking.get('recurring_group_id') is not None
                        booking_purpose = booking.get('purpose', '')
                        break
                
                if is_booked:
                    hourly_status.append({
                        "hour": hour,
                        "time_display": f"{hour:02d}:00",
                        "status": "recurring" if is_recurring else "booked",
                        "booked_by": booked_by,
                        "is_recurring": is_recurring,
                        "purpose": booking_purpose
                    })
                else:
                    hourly_status.append({
                        "hour": hour,
                        "time_display": f"{hour:02d}:00",
                        "status": "available",
                        "booked_by": None,
                        "is_recurring": False
                    })
        
        # Count availability stats
        available_count = sum(1 for h in hourly_status if h['status'] == 'available')
        booked_count = sum(1 for h in hourly_status if h['status'] in ['booked', 'recurring'])
        
        car_availability.append({
            "car_id": car_id,
            "car_name": car.get('name', 'Unknown'),
            "registration": car.get('registration', ''),
            "current_status": car.get('current_status', 'Unknown'),
            "hourly_availability": hourly_status,
            "stats": {
                "available_hours": available_count,
                "booked_hours": booked_count,
                "total_hours": len(work_hours)
            }
        })
    
    # Summary stats
    total_available = sum(c['stats']['available_hours'] for c in car_availability)
    total_booked = sum(c['stats']['booked_hours'] for c in car_availability)
    
    return {
        "report_date": check_date.strftime("%Y-%m-%d"),
        "report_date_display": check_date.strftime("%A, %d %B %Y"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "work_hours": work_hours,
        "summary": {
            "total_cars": len(cars),
            "total_available_hours": total_available,
            "total_booked_hours": total_booked,
            "availability_percentage": round((total_available / (total_available + total_booked)) * 100, 1) if (total_available + total_booked) > 0 else 100
        },
        "cars": car_availability
    }


# ==================== STATUS UPDATE ENDPOINTS ====================
# Note: Manual status updates are now admin-only. Live status is primarily 
# determined by active bookings (Booked/Recurring) automatically.

@api_router.post("/status", response_model=StatusUpdate)
async def create_status_update(status_update: StatusUpdateCreate, current_user: dict = Depends(get_current_admin_user)):
    """Create a status update (Admin only - for manual overrides when car is not booked)"""
    car = await db.cars.find_one({"id": status_update.car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    status_obj = StatusUpdate(**status_update.model_dump())
    status_obj.user_name = current_user['email'].split('@')[0]  # Record who made the change
    doc = serialize_datetime(status_obj.model_dump())
    await db.status_updates.insert_one(doc)
    
    await db.cars.update_one(
        {"id": status_update.car_id},
        {"$set": {"current_status": status_update.status}}
    )
    
    return status_obj


@api_router.get("/status/live", response_model=List[dict])
async def get_live_status(current_user: dict = Depends(get_current_user)):
    """Get live status of all cars (authenticated users) - Optimized with aggregation"""
    from datetime import datetime, timezone
    
    # Get current time for booking checks
    now = datetime.now(timezone.utc)
    
    # Use aggregation pipeline to avoid N+1 query problem
    pipeline = [
        {"$project": {"_id": 0}},
        {
            "$lookup": {
                "from": "status_updates",
                "let": {"car_id": "$id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$car_id", "$$car_id"]}}},
                    {"$sort": {"timestamp": -1}},
                    {"$limit": 1},
                    {"$project": {"_id": 0}}
                ],
                "as": "status_array"
            }
        },
        {
            "$addFields": {
                "latest_status": {"$arrayElemAt": ["$status_array", 0]}
            }
        },
        {"$project": {"status_array": 0}}
    ]
    
    cars_with_status = await db.cars.aggregate(pipeline).to_list(1000)
    
    # Get all approved bookings that are currently active (now is between start and end time)
    active_bookings = await db.bookings.find({
        "status": "approved",
        "start_time": {"$lte": now.isoformat()},
        "end_time": {"$gte": now.isoformat()}
    }, {"_id": 0, "car_id": 1, "user_name": 1, "start_time": 1, "end_time": 1, "location": 1, "purpose": 1, "recurring_group_id": 1}).to_list(1000)
    
    # Create a map of car_id -> active booking info
    active_booking_map = {}
    for booking in active_bookings:
        car_id = booking.get('car_id')
        if car_id:
            booking['is_recurring'] = booking.get('recurring_group_id') is not None
            active_booking_map[car_id] = booking
    
    # Deserialize datetime fields and update status based on active bookings
    for item in cars_with_status:
        if 'created_at' in item:
            deserialize_datetime(item, ['created_at'])
        if item.get('latest_status') and 'timestamp' in item['latest_status']:
            deserialize_datetime(item['latest_status'], ['timestamp'])
        
        # Check if this car has an active booking right now
        car_id = item.get('id')
        if car_id and car_id in active_booking_map and not item.get('is_blocked'):
            booking_info = active_booking_map[car_id]
            is_recurring = booking_info.get('is_recurring', False)
            
            # Override the status to "Recurring" or "Booked" based on booking type
            item['current_status'] = 'Recurring' if is_recurring else 'Booked'
            
            # Add booking info to latest_status for display
            if not item.get('latest_status'):
                item['latest_status'] = {}
            item['latest_status']['auto_status'] = item['current_status']
            item['latest_status']['booked_by'] = booking_info.get('user_name', 'Unknown')
            item['latest_status']['is_recurring'] = is_recurring
            # Add location from booking if available
            booking_location = booking_info.get('location', '')
            if booking_location:
                item['latest_status']['location'] = booking_location
    
    # Format response to match expected structure
    result = []
    for item in cars_with_status:
        latest_status = item.pop('latest_status', None)
        result.append({
            "car": item,
            "latest_status": latest_status
        })
    
    return result


@api_router.get("/status/history/{car_id}", response_model=List[StatusUpdate])
async def get_status_history(car_id: str, limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_current_user)):
    """Get status history for a car (authenticated users)"""
    history = await db.status_updates.find(
        {"car_id": car_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for item in history:
        deserialize_datetime(item, ['timestamp'])
    
    return history


# ==================== BOOKING ENDPOINTS ====================

@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking: BookingCreate, current_user: dict = Depends(get_current_user)):
    """Create a new booking (authenticated users)"""
    logging.info(f"Booking request: car_id={booking.car_id}, user={current_user['email']}, start={booking.start_time}, end={booking.end_time}")
    
    car = await db.cars.find_one({"id": booking.car_id}, {"_id": 0})
    if not car:
        logging.error(f"Car not found: {booking.car_id}")
        raise HTTPException(status_code=404, detail=f"Car not found: {booking.car_id}")
    
    # Check if car is blocked
    if car.get('is_blocked'):
        logging.warning(f"Attempted booking on blocked car: {car.get('name')}")
        raise HTTPException(
            status_code=400,
            detail=f"Car is blocked for {car.get('block_reason', 'maintenance')}. Cannot create booking."
        )
    
    # Check for booking conflicts
    conflicts = await db.bookings.find({
        "car_id": booking.car_id,
        "$or": [
            {
                "start_time": {"$lte": booking.start_time.isoformat()},
                "end_time": {"$gt": booking.start_time.isoformat()}
            },
            {
                "start_time": {"$lt": booking.end_time.isoformat()},
                "end_time": {"$gte": booking.end_time.isoformat()}
            },
            {
                "start_time": {"$gte": booking.start_time.isoformat()},
                "end_time": {"$lte": booking.end_time.isoformat()}
            }
        ]
    }, {"_id": 0}).to_list(10)
    
    if conflicts:
        raise HTTPException(
            status_code=409,
            detail="Booking conflict: Car is already booked for this time period"
        )
    
    booking_obj = Booking(**booking.model_dump())
    booking_obj.created_by_email = current_user['email']  # Track who created the booking
    
    # Handle recurring bookings
    if booking.is_recurring and booking.recurrence_type:
        is_admin = current_user.get('role') == 'admin'
        # Staff recurring bookings need admin approval
        if not is_admin:
            booking_obj.status = "pending_approval"
        
        # Generate recurring group ID
        recurring_group_id = str(uuid.uuid4())
        booking_obj.recurring_group_id = recurring_group_id
        
        # Calculate recurring dates
        recurring_bookings = []
        current_start = booking.start_time
        current_end = booking.end_time
        duration = current_end - current_start
        
        count = 0
        max_count = booking.recurrence_count or 52  # Default max 52 occurrences
        
        while count < max_count:
            if booking.recurrence_end_date and current_start > booking.recurrence_end_date:
                break
            
            # Create booking for this occurrence
            occurrence = Booking(**booking.model_dump())
            occurrence.id = str(uuid.uuid4())
            occurrence.created_by_email = current_user['email']
            occurrence.recurring_group_id = recurring_group_id
            occurrence.start_time = current_start
            occurrence.end_time = current_start + duration
            if not is_admin:
                occurrence.status = "pending_approval"
            
            doc = serialize_datetime(occurrence.model_dump())
            recurring_bookings.append(doc)
            
            # Calculate next occurrence
            if booking.recurrence_type == "daily":
                current_start = current_start + timedelta(days=1)
            elif booking.recurrence_type == "weekly":
                current_start = current_start + timedelta(weeks=1)
            elif booking.recurrence_type == "monthly":
                # Add one month
                month = current_start.month + 1
                year = current_start.year
                if month > 12:
                    month = 1
                    year += 1
                try:
                    current_start = current_start.replace(year=year, month=month)
                except ValueError:
                    # Handle edge cases like Jan 31 -> Feb 28
                    current_start = current_start.replace(year=year, month=month, day=28)
            
            count += 1
        
        # Insert all recurring bookings
        if recurring_bookings:
            await db.bookings.insert_many(recurring_bookings)
        
        # Return the first booking
        booking_obj = Booking(**{k: v for k, v in recurring_bookings[0].items() if k != '_id'})
        return booking_obj
    
    doc = serialize_datetime(booking_obj.model_dump())
    await db.bookings.insert_one(doc)
    
    return booking_obj


@api_router.get("/bookings", response_model=List[Booking])
async def get_all_bookings(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(2000, ge=1, le=5000, description="Maximum number of records to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get all bookings (authenticated users) with pagination"""
    # Get bookings from the last 6 months and all future bookings
    # This ensures we don't miss any relevant bookings while keeping the response manageable
    from datetime import timedelta
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    
    bookings = await db.bookings.find(
        {"start_time": {"$gte": six_months_ago.isoformat()}},
        {"_id": 0}
    ).sort("start_time", 1).skip(skip).limit(limit).to_list(limit)
    
    for booking in bookings:
        deserialize_datetime(booking, ['start_time', 'end_time', 'created_at'])
    return bookings


@api_router.get("/bookings/car/{car_id}", response_model=List[Booking])
async def get_car_bookings(
    car_id: str,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get bookings for a specific car (authenticated users) with pagination"""
    bookings = await db.bookings.find(
        {"car_id": car_id},
        {"_id": 0}
    ).sort("start_time", -1).skip(skip).limit(limit).to_list(limit)
    
    for booking in bookings:
        deserialize_datetime(booking, ['start_time', 'end_time', 'created_at'])
    
    return bookings


@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a booking - Admins can delete any booking, users can only cancel their own"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check permissions: Admin can delete any, user can only delete their own
    is_admin = current_user.get('role') == 'admin'
    is_owner = booking.get('created_by_email') == current_user['email']
    
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=403, 
            detail="You can only cancel your own bookings. Contact an admin to delete other bookings."
        )
    
    result = await db.bookings.delete_one({"id": booking_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    action = "deleted" if is_admin else "cancelled"
    return {"message": f"Booking {action} successfully"}


@api_router.delete("/bookings/series/{recurring_group_id}")
async def delete_booking_series(recurring_group_id: str, current_user: dict = Depends(get_current_user)):
    """Delete all bookings in a recurring series - Admins can delete any, users can only delete their own"""
    # Get all bookings in this series
    series_bookings = await db.bookings.find(
        {"recurring_group_id": recurring_group_id},
        {"_id": 0}
    ).to_list(100)
    
    if not series_bookings:
        raise HTTPException(status_code=404, detail="Recurring booking series not found")
    
    # Check permissions using the first booking in the series
    first_booking = series_bookings[0]
    is_admin = current_user.get('role') == 'admin'
    is_owner = first_booking.get('created_by_email') == current_user['email']
    
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=403, 
            detail="You can only cancel your own booking series. Contact an admin to delete other bookings."
        )
    
    # Delete all bookings in the series
    result = await db.bookings.delete_many({"recurring_group_id": recurring_group_id})
    
    action = "deleted" if is_admin else "cancelled"
    return {
        "message": f"Recurring booking series {action} successfully",
        "deleted_count": result.deleted_count
    }


@api_router.delete("/admin/bookings/clear")
async def clear_bookings_by_date_range(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin: Clear all bookings within a date range"""
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    # Find bookings in the date range
    # We need to compare against start_time field
    bookings_to_delete = await db.bookings.find({}, {"_id": 0, "id": 1, "start_time": 1}).to_list(10000)
    
    ids_to_delete = []
    for booking in bookings_to_delete:
        try:
            b_start = booking.get('start_time')
            if isinstance(b_start, str):
                b_start = datetime.fromisoformat(b_start.replace('Z', '+00:00'))
            if b_start.tzinfo is None:
                b_start = b_start.replace(tzinfo=timezone.utc)
            
            if start_dt <= b_start <= end_dt:
                ids_to_delete.append(booking['id'])
        except Exception:
            continue
    
    if not ids_to_delete:
        return {"message": "No bookings found in the specified date range", "deleted_count": 0}
    
    # Delete the bookings
    result = await db.bookings.delete_many({"id": {"$in": ids_to_delete}})
    
    return {
        "message": f"Successfully cleared {result.deleted_count} bookings from {start_date} to {end_date}",
        "deleted_count": result.deleted_count
    }


@api_router.get("/admin/reports/bookings-detail")
async def get_bookings_detail_report(
    start_date: str = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(None, description="End date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin: Get detailed booking report with vehicle details, booked by, times, location, purpose"""
    # Get all bookings
    bookings = await db.bookings.find({}, {"_id": 0}).sort("start_time", -1).to_list(5000)
    
    # Get all cars for vehicle details lookup
    cars = await db.cars.find({}, {"_id": 0}).to_list(100)
    car_map = {car['id']: car for car in cars}
    
    # Parse date filters if provided
    filter_start = None
    filter_end = None
    if start_date:
        try:
            filter_start = datetime.strptime(start_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        except ValueError:
            pass
    if end_date:
        try:
            filter_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except ValueError:
            pass
    
    report_data = []
    for booking in bookings:
        car = car_map.get(booking.get('car_id'), {})
        
        # Parse start and end times
        start_time = booking.get('start_time')
        end_time = booking.get('end_time')
        
        if isinstance(start_time, str):
            try:
                start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            except:
                pass
        
        if isinstance(end_time, str):
            try:
                end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            except:
                pass
        
        # Ensure timezone awareness for comparison
        if isinstance(start_time, datetime) and start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        # Apply date filter if provided
        if filter_start and isinstance(start_time, datetime):
            if start_time < filter_start:
                continue
        if filter_end and isinstance(start_time, datetime):
            if start_time > filter_end:
                continue
        
        # Format times for display (Irish locale)
        start_time_display = start_time.strftime("%d/%m/%Y %H:%M") if isinstance(start_time, datetime) else str(start_time)[:16] if start_time else 'N/A'
        end_time_display = end_time.strftime("%d/%m/%Y %H:%M") if isinstance(end_time, datetime) else str(end_time)[:16] if end_time else 'N/A'
        
        report_data.append({
            "vehicle_name": car.get('name', 'Unknown'),
            "vehicle_registration": car.get('registration', 'N/A'),
            "booked_by": booking.get('user_name', 'Unknown'),
            "start_time": start_time_display,
            "end_time": end_time_display,
            "location": booking.get('location', ''),
            "purpose": booking.get('purpose', booking.get('destination_notes', '')),
            "status": booking.get('status', 'unknown'),
            "is_recurring": booking.get('is_recurring', False) or booking.get('recurring_group_id') is not None,
            "is_double_up_call": booking.get('is_double_up_call', False)
        })
    
    # Count double-up calls
    double_up_count = len([r for r in report_data if r.get('is_double_up_call', False)])
    
    return {
        "total_records": len(report_data),
        "double_up_calls": double_up_count,
        "date_range": {
            "start": start_date or "All",
            "end": end_date or "All"
        },
        "bookings": report_data
    }


# ==================== BOOKING SUGGESTIONS ENDPOINT ====================

@api_router.get("/bookings/suggestions")
async def get_booking_suggestions(current_user: dict = Depends(get_current_user)):
    """Get available car and time slot suggestions for the next 7 days"""
    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=7)
    
    # Get all cars that are not blocked
    cars = await db.cars.find({"is_blocked": {"$ne": True}}, {"_id": 0}).to_list(100)
    
    # Get all approved bookings (we'll filter by date in code to avoid string comparison issues)
    bookings = await db.bookings.find({"status": "approved"}, {"_id": 0}).to_list(500)
    
    # Build availability info for each car
    suggestions = []
    
    # Define standard working hours (8 AM to 6 PM)
    work_start_hour = 8
    work_end_hour = 18
    
    for car in cars:
        car_id = car.get('id')
        car_name = car.get('name', 'Unknown')
        car_reg = car.get('registration', '')
        
        # Get bookings for this car
        car_bookings = [b for b in bookings if b.get('car_id') == car_id]
        
        # Find free slots for the next 7 days
        free_slots = []
        
        for day_offset in range(7):
            # Create timezone-aware datetime for the day
            check_date = (now + timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            day_start = check_date.replace(hour=work_start_hour, tzinfo=timezone.utc)
            day_end = check_date.replace(hour=work_end_hour, tzinfo=timezone.utc)
            
            # Skip if day start is in the past
            if day_start < now:
                day_start = now.replace(minute=0, second=0, microsecond=0, tzinfo=timezone.utc) + timedelta(hours=1)
                if day_start.hour < work_start_hour:
                    day_start = day_start.replace(hour=work_start_hour, tzinfo=timezone.utc)
                if day_start >= day_end:
                    continue
            
            # Get bookings for this day
            day_bookings = []
            for b in car_bookings:
                try:
                    b_start_str = b.get('start_time', '')
                    b_end_str = b.get('end_time', '')
                    if not b_start_str or not b_end_str:
                        continue
                    
                    # Parse datetime strings
                    if isinstance(b_start_str, str):
                        b_start = datetime.fromisoformat(b_start_str.replace('Z', '+00:00'))
                    else:
                        b_start = b_start_str
                    if isinstance(b_end_str, str):
                        b_end = datetime.fromisoformat(b_end_str.replace('Z', '+00:00'))
                    else:
                        b_end = b_end_str
                    
                    # Ensure timezone awareness
                    if b_start.tzinfo is None:
                        b_start = b_start.replace(tzinfo=timezone.utc)
                    if b_end.tzinfo is None:
                        b_end = b_end.replace(tzinfo=timezone.utc)
                    
                    # Check if booking overlaps with this day
                    if b_start.date() == check_date.date() or b_end.date() == check_date.date():
                        day_bookings.append({'start': b_start, 'end': b_end})
                except Exception as e:
                    logging.error(f"Error parsing booking datetime: {e}")
                    continue
            
            # Sort bookings by start time
            day_bookings.sort(key=lambda x: x['start'])
            
            # Find gaps between bookings
            current_time = day_start
            for booking in day_bookings:
                if booking['start'] > current_time:
                    # There's a gap before this booking
                    gap_duration = (booking['start'] - current_time).total_seconds() / 3600
                    if gap_duration >= 1:  # At least 1 hour slot
                        free_slots.append({
                            "date": check_date.strftime("%Y-%m-%d"),
                            "day_name": check_date.strftime("%A"),
                            "start": current_time.strftime("%H:%M"),
                            "end": booking['start'].strftime("%H:%M"),
                            "duration_hours": round(gap_duration, 1)
                        })
                current_time = max(current_time, booking['end'])
            
            # Check for gap after last booking
            if current_time < day_end:
                gap_duration = (day_end - current_time).total_seconds() / 3600
                if gap_duration >= 1:
                    free_slots.append({
                        "date": check_date.strftime("%Y-%m-%d"),
                        "day_name": check_date.strftime("%A"),
                        "start": current_time.strftime("%H:%M"),
                        "end": day_end.strftime("%H:%M"),
                        "duration_hours": round(gap_duration, 1)
                    })
        
        # Only include cars with available slots
        if free_slots:
            suggestions.append({
                "car_id": car_id,
                "car_name": car_name,
                "registration": car_reg,
                "total_free_slots": len(free_slots),
                "free_slots": free_slots[:10]  # Limit to first 10 slots per car
            })
    
    # Sort by most available
    suggestions.sort(key=lambda x: x['total_free_slots'], reverse=True)
    
    return suggestions


# ==================== DETAILED CAR AVAILABILITY ENDPOINT ====================

@api_router.get("/cars/{car_id}/availability")
async def get_car_availability(
    car_id: str,
    date: str = Query(None, description="Date in YYYY-MM-DD format, defaults to today"),
    view: str = Query("day", description="View type: day, week, or month"),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed hourly availability for a specific car"""
    # Get the car
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Parse the date
    if date:
        try:
            base_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            base_date = datetime.now(timezone.utc)
    else:
        base_date = datetime.now(timezone.utc)
    
    # Determine date range based on view
    if view == "week":
        days_to_check = 7
    elif view == "month":
        days_to_check = 30
    else:  # day
        days_to_check = 1
    
    # Working hours 7 AM to 11 PM
    work_start_hour = 7
    work_end_hour = 23
    
    # Get all bookings for this car in the date range
    end_date = base_date + timedelta(days=days_to_check)
    bookings = await db.bookings.find({
        "car_id": car_id,
        "status": "approved"
    }, {"_id": 0}).to_list(500)
    
    availability = []
    
    for day_offset in range(days_to_check):
        check_date = base_date + timedelta(days=day_offset)
        day_data = {
            "date": check_date.strftime("%Y-%m-%d"),
            "day_name": check_date.strftime("%A"),
            "day_short": check_date.strftime("%a"),
            "date_display": check_date.strftime("%b %d"),
            "hours": []
        }
        
        # Get bookings for this day
        day_bookings = []
        for b in bookings:
            try:
                b_start_str = b.get('start_time', '')
                b_end_str = b.get('end_time', '')
                if not b_start_str or not b_end_str:
                    continue
                
                if isinstance(b_start_str, str):
                    b_start = datetime.fromisoformat(b_start_str.replace('Z', '+00:00'))
                else:
                    b_start = b_start_str
                if isinstance(b_end_str, str):
                    b_end = datetime.fromisoformat(b_end_str.replace('Z', '+00:00'))
                else:
                    b_end = b_end_str
                
                if b_start.tzinfo is None:
                    b_start = b_start.replace(tzinfo=timezone.utc)
                if b_end.tzinfo is None:
                    b_end = b_end.replace(tzinfo=timezone.utc)
                
                # Check if booking overlaps with this day
                day_start = check_date.replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
                day_end = check_date.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                
                if b_start <= day_end and b_end >= day_start:
                    day_bookings.append({
                        'start': b_start,
                        'end': b_end,
                        'user_name': b.get('user_name', 'Unknown'),
                        'is_recurring': b.get('recurring_group_id') is not None
                    })
            except Exception:
                continue
        
        # Generate hourly slots
        now = datetime.now(timezone.utc)
        for hour in range(work_start_hour, work_end_hour):
            slot_start = check_date.replace(hour=hour, minute=0, second=0, tzinfo=timezone.utc)
            slot_end = check_date.replace(hour=hour + 1, minute=0, second=0, tzinfo=timezone.utc)
            
            # Check if slot is in the past
            if slot_end < now:
                status = "past"
                booked_by = None
                is_recurring = False
            else:
                # Check if slot overlaps with any booking
                is_booked = False
                booked_by = None
                is_recurring = False
                for booking in day_bookings:
                    if booking['start'] < slot_end and booking['end'] > slot_start:
                        is_booked = True
                        booked_by = booking['user_name']
                        is_recurring = booking.get('is_recurring', False)
                        break
                
                # Set status: 'recurring', 'booked', or 'available'
                if is_booked:
                    status = "recurring" if is_recurring else "booked"
                else:
                    status = "available"
            
            day_data["hours"].append({
                "hour": hour,
                "time_display": f"{hour:02d}:00",
                "status": status,
                "booked_by": booked_by,
                "is_recurring": is_recurring
            })
        
        availability.append(day_data)
    
    return {
        "car_id": car_id,
        "car_name": car.get('name', 'Unknown'),
        "registration": car.get('registration', ''),
        "is_blocked": car.get('is_blocked', False),
        "view": view,
        "base_date": base_date.strftime("%Y-%m-%d"),
        "availability": availability
    }


# ==================== WEATHER PROXY ENDPOINT ====================

@api_router.get("/weather")
async def get_weather(current_user: dict = Depends(get_current_user)):
    """Get weather for Kerry and West Cork"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            kerry_resp = await client.get('https://wttr.in/Kerry,Ireland?format=j1')
            westcork_resp = await client.get('https://wttr.in/West+Cork,Ireland?format=j1')
            
            kerry_data = kerry_resp.json() if kerry_resp.status_code == 200 else None
            westcork_data = westcork_resp.json() if westcork_resp.status_code == 200 else None
            
            result = {"kerry": None, "westCork": None}
            
            if kerry_data and 'current_condition' in kerry_data:
                cc = kerry_data['current_condition'][0]
                result['kerry'] = {
                    "temp": cc.get('temp_C', '--'),
                    "desc": cc.get('weatherDesc', [{}])[0].get('value', 'Unknown'),
                    "feelsLike": cc.get('FeelsLikeC', '--'),
                    "humidity": cc.get('humidity', '--'),
                    "windSpeed": cc.get('windspeedKmph', '--'),
                    "code": cc.get('weatherCode', '113')
                }
            
            if westcork_data and 'current_condition' in westcork_data:
                cc = westcork_data['current_condition'][0]
                result['westCork'] = {
                    "temp": cc.get('temp_C', '--'),
                    "desc": cc.get('weatherDesc', [{}])[0].get('value', 'Unknown'),
                    "feelsLike": cc.get('FeelsLikeC', '--'),
                    "humidity": cc.get('humidity', '--'),
                    "windSpeed": cc.get('windspeedKmph', '--'),
                    "code": cc.get('weatherCode', '113')
                }
            
            return result
    except Exception as e:
        logging.error(f"Weather API error: {e}")
        return {"kerry": None, "westCork": None, "error": str(e)}


# ==================== RECURRING BOOKING APPROVAL ENDPOINTS ====================

class BookingRejectRequest(BaseModel):
    reason: str = ""

@api_router.get("/admin/pending-bookings")
async def get_pending_bookings(current_user: dict = Depends(get_current_admin_user)):
    """Admin: Get all pending recurring bookings that need approval"""
    # Get unique recurring groups that are pending
    pending = await db.bookings.find(
        {"status": "pending_approval"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    for booking in pending:
        deserialize_datetime(booking, ['start_time', 'end_time', 'created_at', 'recurrence_end_date'])
    
    # Group by recurring_group_id
    groups = {}
    for booking in pending:
        group_id = booking.get('recurring_group_id') or booking['id']
        if group_id not in groups:
            groups[group_id] = {
                'group_id': group_id,
                'bookings': [],
                'car_id': booking['car_id'],
                'user_name': booking['user_name'],
                'created_by_email': booking.get('created_by_email'),
                'recurrence_type': booking.get('recurrence_type'),
                'first_booking': booking,
            }
        groups[group_id]['bookings'].append(booking)
    
    return list(groups.values())


@api_router.post("/admin/bookings/{group_id}/approve")
async def approve_recurring_booking(group_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Approve a recurring booking group"""
    # Get the bookings to find the requester
    bookings = await db.bookings.find(
        {"$or": [{"recurring_group_id": group_id}, {"id": group_id}], "status": "pending_approval"},
        {"_id": 0}
    ).to_list(100)
    
    if not bookings:
        raise HTTPException(status_code=404, detail="No pending bookings found")
    
    result = await db.bookings.update_many(
        {"recurring_group_id": group_id, "status": "pending_approval"},
        {"$set": {"status": "approved"}}
    )
    
    if result.modified_count == 0:
        # Try single booking
        result = await db.bookings.update_one(
            {"id": group_id, "status": "pending_approval"},
            {"$set": {"status": "approved"}}
        )
    
    # Create notification for the requester
    first_booking = bookings[0]
    notification = {
        "id": str(uuid.uuid4()),
        "type": "booking_approved",
        "recipient_email": first_booking.get('created_by_email'),
        "booking_group_id": group_id,
        "car_id": first_booking['car_id'],
        "user_name": first_booking['user_name'],
        "recurrence_type": first_booking.get('recurrence_type'),
        "booking_count": len(bookings),
        "start_time": first_booking['start_time'] if isinstance(first_booking['start_time'], str) else first_booking['start_time'].isoformat(),
        "approved_by": current_user['email'],
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.booking_notifications.insert_one(notification)
    
    return {"message": f"Approved {result.modified_count} booking(s)"}


@api_router.post("/admin/bookings/{group_id}/reject")
async def reject_recurring_booking(group_id: str, reject_data: BookingRejectRequest, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Reject and delete a recurring booking group with reason"""
    # Get the bookings to find the requester before deleting
    bookings = await db.bookings.find(
        {"$or": [{"recurring_group_id": group_id}, {"id": group_id}], "status": "pending_approval"},
        {"_id": 0}
    ).to_list(100)
    
    if not bookings:
        raise HTTPException(status_code=404, detail="No pending bookings found")
    
    first_booking = bookings[0]
    
    # Create notification for the requester BEFORE deleting
    notification = {
        "id": str(uuid.uuid4()),
        "type": "booking_rejected",
        "recipient_email": first_booking.get('created_by_email'),
        "booking_group_id": group_id,
        "car_id": first_booking['car_id'],
        "user_name": first_booking['user_name'],
        "recurrence_type": first_booking.get('recurrence_type'),
        "booking_count": len(bookings),
        "start_time": first_booking['start_time'] if isinstance(first_booking['start_time'], str) else first_booking['start_time'].isoformat(),
        "rejected_by": current_user['email'],
        "rejection_reason": reject_data.reason,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.booking_notifications.insert_one(notification)
    
    # Now delete the bookings
    result = await db.bookings.delete_many(
        {"recurring_group_id": group_id, "status": "pending_approval"}
    )
    
    if result.deleted_count == 0:
        # Try single booking
        result = await db.bookings.delete_one(
            {"id": group_id, "status": "pending_approval"}
        )
    
    return {"message": f"Rejected and deleted {result.deleted_count} booking(s)"}


# ==================== BOOKING NOTIFICATIONS ENDPOINTS ====================

@api_router.get("/booking-notifications")
async def get_booking_notifications(current_user: dict = Depends(get_current_user)):
    """Get booking notifications for current user"""
    notifications = await db.booking_notifications.find(
        {"recipient_email": current_user['email'], "is_read": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return notifications


@api_router.post("/booking-notifications/{notification_id}/read")
async def mark_booking_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a booking notification as read"""
    result = await db.booking_notifications.update_one(
        {"id": notification_id, "recipient_email": current_user['email']},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}


# ==================== EDIT INDIVIDUAL BOOKING ENDPOINT ====================

class BookingUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    user_name: Optional[str] = None
    purpose: Optional[str] = None
    location: Optional[str] = None
    car_id: Optional[str] = None  # Allow changing the car for a single occurrence

@api_router.put("/admin/bookings/{booking_id}")
async def edit_booking(booking_id: str, booking_update: BookingUpdate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Edit an individual booking (even if part of a recurring series)"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_data = {}
    if booking_update.start_time:
        update_data["start_time"] = booking_update.start_time.isoformat()
    if booking_update.end_time:
        update_data["end_time"] = booking_update.end_time.isoformat()
    if booking_update.user_name:
        update_data["user_name"] = booking_update.user_name
    if booking_update.purpose is not None:
        update_data["purpose"] = booking_update.purpose
    if booking_update.location is not None:
        update_data["location"] = booking_update.location
    
    # Handle car change
    if booking_update.car_id and booking_update.car_id != booking.get('car_id'):
        # Verify the new car exists
        new_car = await db.cars.find_one({"id": booking_update.car_id}, {"_id": 0})
        if not new_car:
            raise HTTPException(status_code=404, detail="Selected car not found")
        if new_car.get('is_blocked'):
            raise HTTPException(status_code=400, detail=f"Car is blocked for {new_car.get('block_reason', 'maintenance')}")
        
        # Check for conflicts with the new car (exclude current booking)
        start_time = booking_update.start_time.isoformat() if booking_update.start_time else booking['start_time']
        end_time = booking_update.end_time.isoformat() if booking_update.end_time else booking['end_time']
        
        conflict = await db.bookings.find_one({
            "car_id": booking_update.car_id,
            "id": {"$ne": booking_id},
            "status": "approved",
            "$or": [
                {"start_time": {"$lt": end_time}, "end_time": {"$gt": start_time}}
            ]
        })
        
        if conflict:
            raise HTTPException(status_code=409, detail="New car is already booked for this time period")
        
        update_data["car_id"] = booking_update.car_id
    
    if update_data:
        # Mark as individually edited if part of recurring series
        if booking.get('recurring_group_id'):
            update_data["individually_edited"] = True
        
        await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    updated_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    deserialize_datetime(updated_booking, ['start_time', 'end_time', 'created_at'])
    
    return updated_booking


# Get available cars for a specific time slot (for car swapping)
@api_router.get("/admin/available-cars")
async def get_available_cars_for_slot(
    start_time: str = Query(..., description="Start time in ISO format"),
    end_time: str = Query(..., description="End time in ISO format"),
    exclude_booking_id: Optional[str] = Query(None, description="Booking ID to exclude from conflict check"),
    current_user: dict = Depends(get_current_admin_user)
):
    """Get cars that are available during a specific time slot"""
    # Get all cars that are not blocked
    all_cars = await db.cars.find({"is_blocked": {"$ne": True}}, {"_id": 0}).to_list(100)
    
    # Get bookings that conflict with the time slot
    conflicting_bookings = await db.bookings.find({
        "status": "approved",
        "$or": [
            {"start_time": {"$lt": end_time}, "end_time": {"$gt": start_time}}
        ]
    }, {"_id": 0, "car_id": 1, "id": 1}).to_list(500)
    
    # Filter out the excluded booking
    if exclude_booking_id:
        conflicting_bookings = [b for b in conflicting_bookings if b.get('id') != exclude_booking_id]
    
    # Get list of car IDs that are booked
    booked_car_ids = set(b.get('car_id') for b in conflicting_bookings)
    
    # Filter available cars
    available_cars = [car for car in all_cars if car.get('id') not in booked_car_ids]
    
    return available_cars


class SeriesBookingUpdate(BaseModel):
    user_name: Optional[str] = None
    purpose: Optional[str] = None
    location: Optional[str] = None
    # Note: For series, we don't allow changing times as each booking has different times

@api_router.put("/admin/bookings/series/{recurrence_id}")
async def edit_booking_series(recurrence_id: str, booking_update: SeriesBookingUpdate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Edit all bookings in a recurring series"""
    # Check if the series exists
    count = await db.bookings.count_documents({"recurring_group_id": recurrence_id})
    if count == 0:
        raise HTTPException(status_code=404, detail="No bookings found in this series")
    
    update_data = {}
    if booking_update.user_name:
        update_data["user_name"] = booking_update.user_name
    if booking_update.purpose is not None:
        update_data["purpose"] = booking_update.purpose
    if booking_update.location is not None:
        update_data["location"] = booking_update.location
    
    if update_data:
        result = await db.bookings.update_many(
            {"recurring_group_id": recurrence_id},
            {"$set": update_data}
        )
        return {"message": f"Updated {result.modified_count} booking(s) in series"}
    
    return {"message": "No changes provided"}


# ==================== ADMIN MESSAGING BOARD ENDPOINTS ====================

@api_router.post("/admin/messages", response_model=AdminMessage)
async def create_admin_message(message: AdminMessageCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Create a new message/announcement for staff"""
    message_obj = AdminMessage(**message.model_dump())
    message_obj.created_by = current_user['email']
    doc = serialize_datetime(message_obj.model_dump())
    await db.admin_messages.insert_one(doc)
    
    # Send push notification to all staff
    await send_push_notification(
        user_roles=['staff'],
        title="📢 " + message.title,
        body=message.content[:100] + ('...' if len(message.content) > 100 else ''),
        url="/",
        tag=f"admin-message-{message_obj.id}"
    )
    
    return message_obj


@api_router.get("/admin/messages")
async def get_admin_messages(current_user: dict = Depends(get_current_admin_user)):
    """Admin: Get all messages"""
    messages = await db.admin_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for msg in messages:
        deserialize_datetime(msg, ['created_at'])
    return messages


@api_router.delete("/admin/messages/{message_id}")
async def delete_admin_message(message_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Delete a message"""
    result = await db.admin_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    # Also delete acknowledgments
    await db.message_acknowledgments.delete_many({"message_id": message_id})
    return {"message": "Message deleted successfully"}


@api_router.put("/admin/messages/{message_id}")
async def update_admin_message(message_id: str, message: AdminMessageCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Update a message"""
    result = await db.admin_messages.update_one(
        {"id": message_id},
        {"$set": {
            "title": message.title,
            "content": message.content,
            "requires_acknowledgment": message.requires_acknowledgment,
            "is_active": message.is_active
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message updated successfully"}


# ==================== TO DO LIST ENDPOINTS ====================

@api_router.get("/admin/todos")
async def get_todos(current_user: dict = Depends(get_current_admin_user)):
    """Admin: Get all to-do items with auto-reset for mandatory scheduled tasks"""
    todos = await db.todos.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    now = datetime.now(timezone.utc)
    current_weekday = now.weekday()  # Monday=0, Sunday=6 - convert to Sunday=0 format
    current_weekday_sunday_start = (current_weekday + 1) % 7  # Convert to Sunday=0 format
    current_day_of_month = now.day
    
    for todo in todos:
        deserialize_datetime(todo, ['created_at'])
        
        # Auto-reset logic for mandatory tasks
        if todo.get('is_mandatory') and todo.get('is_completed') and todo.get('completed_at'):
            completed_at_str = todo.get('completed_at')
            try:
                # Parse completed_at timestamp
                if isinstance(completed_at_str, str):
                    completed_at = datetime.fromisoformat(completed_at_str.replace('Z', '+00:00'))
                else:
                    completed_at = completed_at_str
                
                time_since_completion = now - completed_at
                schedule_type = todo.get('schedule_type')
                schedule_days = todo.get('schedule_days', [])
                should_reset = False
                
                if schedule_type == 'daily':
                    # Reset after 24 hours
                    if time_since_completion >= timedelta(hours=24):
                        should_reset = True
                elif schedule_type == 'weekly' and schedule_days:
                    # Reset if it's a scheduled day and >24h since completion
                    if current_weekday_sunday_start in schedule_days and time_since_completion >= timedelta(hours=24):
                        should_reset = True
                elif schedule_type == 'monthly' and schedule_days:
                    # Reset if it's a scheduled day of month and >24h since completion
                    if current_day_of_month in schedule_days and time_since_completion >= timedelta(hours=24):
                        should_reset = True
                elif not schedule_type:
                    # One-time mandatory task: reset after 24h (original behavior)
                    if time_since_completion >= timedelta(hours=24):
                        should_reset = True
                
                if should_reset:
                    # Reset the task to incomplete
                    await db.todos.update_one(
                        {"id": todo['id']},
                        {"$set": {"is_completed": False, "completed_by": None, "completed_at": None}}
                    )
                    todo['is_completed'] = False
                    todo['completed_by'] = None
                    todo['completed_at'] = None
            except Exception as e:
                logging.error(f"Error processing todo reset for {todo.get('id')}: {e}")
    
    return todos

@api_router.post("/admin/todos", response_model=dict)
async def create_todo(todo: TodoItemCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Create a new to-do item"""
    todo_item = TodoItem(**todo.model_dump())
    todo_item.created_by = current_user['email']
    doc = serialize_datetime(todo_item.model_dump())
    await db.todos.insert_one(doc)
    return todo_item.model_dump()

@api_router.put("/admin/todos/{todo_id}")
async def update_todo(todo_id: str, todo_update: TodoItemUpdate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Update a to-do item"""
    update_data = {k: v for k, v in todo_update.model_dump().items() if v is not None}
    
    # If marking as completed, add completion info
    if update_data.get('is_completed') is True:
        update_data['completed_by'] = current_user['email']
        update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    elif update_data.get('is_completed') is False:
        update_data['completed_by'] = None
        update_data['completed_at'] = None
    
    if update_data:
        result = await db.todos.update_one({"id": todo_id}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="To-do item not found")
    
    updated = await db.todos.find_one({"id": todo_id}, {"_id": 0})
    deserialize_datetime(updated, ['created_at'])
    return updated

@api_router.delete("/admin/todos/{todo_id}")
async def delete_todo(todo_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Delete a to-do item"""
    result = await db.todos.delete_one({"id": todo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="To-do item not found")
    return {"message": "To-do item deleted successfully"}


# ==================== STAFF MESSAGE ENDPOINTS ====================

@api_router.get("/messages/unacknowledged")
async def get_unacknowledged_messages(current_user: dict = Depends(get_current_user)):
    """Get messages that require acknowledgment from current user"""
    # Get all active messages that require acknowledgment
    messages = await db.admin_messages.find(
        {"is_active": True, "requires_acknowledgment": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get user's acknowledgments
    acks = await db.message_acknowledgments.find(
        {"user_email": current_user['email']},
        {"_id": 0}
    ).to_list(100)
    acked_ids = {a['message_id'] for a in acks}
    
    # Filter to unacknowledged
    unacked = [m for m in messages if m['id'] not in acked_ids]
    
    for msg in unacked:
        deserialize_datetime(msg, ['created_at'])
    
    return unacked


@api_router.post("/messages/{message_id}/acknowledge")
async def acknowledge_message(message_id: str, current_user: dict = Depends(get_current_user)):
    """Acknowledge a message"""
    # Check if already acknowledged
    existing = await db.message_acknowledgments.find_one({
        "message_id": message_id,
        "user_email": current_user['email']
    })
    
    if existing:
        return {"message": "Already acknowledged"}
    
    ack = {
        "message_id": message_id,
        "user_email": current_user['email'],
        "acknowledged_at": datetime.now(timezone.utc).isoformat()
    }
    await db.message_acknowledgments.insert_one(ack)
    
    return {"message": "Message acknowledged"}


# ==================== LIFT REQUEST ENDPOINTS ====================

@api_router.post("/lift-requests", response_model=LiftRequest)
async def create_lift_request(request: LiftRequestCreate, current_user: dict = Depends(get_current_user)):
    """Create a lift request (staff only)"""
    lift_data = request.model_dump()
    lift_data['requester_email'] = current_user['email']
    lift_data['id'] = str(uuid.uuid4())
    lift_obj = LiftRequest(**lift_data)
    
    doc = serialize_datetime(lift_obj.model_dump())
    await db.lift_requests.insert_one(doc)
    
    # Send push notification to all admins
    requester_name = current_user['email'].split('@')[0]
    await send_push_notification(
        user_roles=['admin'],
        title="🚗 Lift Request",
        body=f"{requester_name} needs a lift from {request.pickup_location}",
        url="/",
        tag=f"lift-request-{lift_obj.id}"
    )
    
    return lift_obj


@api_router.get("/lift-requests")
async def get_lift_requests(current_user: dict = Depends(get_current_user)):
    """Get all active lift requests (excluding ones dismissed by current user)"""
    # Get user's dismissed requests
    dismissed = await db.lift_request_dismissals.find(
        {"user_email": current_user['email']},
        {"_id": 0}
    ).to_list(100)
    dismissed_ids = {d['request_id'] for d in dismissed}
    
    # Get all active requests
    requests = await db.lift_requests.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Filter out dismissed ones
    visible_requests = [r for r in requests if r['id'] not in dismissed_ids]
    
    for req in visible_requests:
        deserialize_datetime(req, ['created_at'])
    
    return visible_requests


@api_router.get("/lift-requests/all")
async def get_all_lift_requests(current_user: dict = Depends(get_current_user)):
    """Get all lift requests (including accepted/cancelled)"""
    requests = await db.lift_requests.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    for req in requests:
        deserialize_datetime(req, ['created_at'])
    
    return requests


@api_router.get("/lift-requests/count")
async def get_lift_request_count(current_user: dict = Depends(get_current_user)):
    """Get count of active lift requests visible to current user (for notification badge)"""
    # Get user's dismissed requests
    dismissed = await db.lift_request_dismissals.find(
        {"user_email": current_user['email']},
        {"_id": 0}
    ).to_list(100)
    dismissed_ids = {d['request_id'] for d in dismissed}
    
    # Count active requests not dismissed by user
    all_active = await db.lift_requests.find({"status": "active"}, {"_id": 0, "id": 1}).to_list(100)
    visible_count = sum(1 for r in all_active if r['id'] not in dismissed_ids)
    
    return {"count": visible_count}


@api_router.post("/lift-requests/{request_id}/accept")
async def accept_lift_request(request_id: str, accept_data: dict = None, current_user: dict = Depends(get_current_user)):
    """Accept a lift request and notify the requester"""
    lift_request = await db.lift_requests.find_one({"id": request_id}, {"_id": 0})
    if not lift_request:
        raise HTTPException(status_code=404, detail="Lift request not found")
    
    if lift_request['status'] != 'active':
        raise HTTPException(status_code=400, detail="This lift request is no longer active")
    
    # Cannot accept your own request
    if lift_request['requester_email'] == current_user['email']:
        raise HTTPException(status_code=400, detail="You cannot accept your own lift request")
    
    # Get the acceptor's name from user email
    acceptor_name = current_user['email'].split('@')[0].replace('.', ' ').title()
    
    # Get message from request body
    message = ""
    if accept_data and isinstance(accept_data, dict):
        message = accept_data.get('message', '')
    
    update_data = {
        "status": "accepted",
        "accepted_by_email": current_user['email'],
        "accepted_by_name": acceptor_name,
        "accepted_at": datetime.now(timezone.utc).isoformat(),
        "acceptor_message": message
    }
    
    await db.lift_requests.update_one({"id": request_id}, {"$set": update_data})
    
    # Create notification for the requester
    notification = {
        "id": str(uuid.uuid4()),
        "type": "lift_accepted",
        "recipient_email": lift_request['requester_email'],
        "lift_request_id": request_id,
        "requester_name": lift_request['requester_name'],
        "from_location": lift_request['from_location'],
        "to_location": lift_request['to_location'],
        "lift_date": lift_request['lift_date'],
        "lift_time": lift_request['lift_time'],
        "accepted_by_email": current_user['email'],
        "accepted_by_name": acceptor_name,
        "message": message,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lift_notifications.insert_one(notification)
    
    # Clean up dismissals for this request since it's now accepted
    await db.lift_request_dismissals.delete_many({"request_id": request_id})
    
    return {"message": "Lift request accepted successfully", "acceptor_name": acceptor_name}


# Lift Notifications Endpoints
@api_router.get("/lift-notifications")
async def get_lift_notifications(current_user: dict = Depends(get_current_user)):
    """Get lift notifications for current user"""
    notifications = await db.lift_notifications.find(
        {"recipient_email": current_user['email'], "is_read": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return notifications


@api_router.get("/lift-notifications/count")
async def get_lift_notification_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread lift notifications"""
    count = await db.lift_notifications.count_documents({
        "recipient_email": current_user['email'],
        "is_read": False
    })
    return {"count": count}


@api_router.post("/lift-notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    result = await db.lift_notifications.update_one(
        {"id": notification_id, "recipient_email": current_user['email']},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}


@api_router.post("/lift-requests/{request_id}/dismiss")
async def dismiss_lift_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Dismiss a lift request from view (personal - only hides for current user)"""
    lift_request = await db.lift_requests.find_one({"id": request_id}, {"_id": 0})
    if not lift_request:
        raise HTTPException(status_code=404, detail="Lift request not found")
    
    # Check if already dismissed
    existing = await db.lift_request_dismissals.find_one({
        "request_id": request_id,
        "user_email": current_user['email']
    })
    
    if existing:
        return {"message": "Already dismissed"}
    
    # Add dismissal record
    dismissal = {
        "id": str(uuid.uuid4()),
        "request_id": request_id,
        "user_email": current_user['email'],
        "dismissed_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lift_request_dismissals.insert_one(dismissal)
    
    return {"message": "Lift request dismissed from view"}


@api_router.delete("/lift-requests/{request_id}")
async def delete_lift_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a lift request - Only admin can delete"""
    lift_request = await db.lift_requests.find_one({"id": request_id}, {"_id": 0})
    if not lift_request:
        raise HTTPException(status_code=404, detail="Lift request not found")
    
    is_admin = current_user.get('role') == 'admin'
    
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can delete lift requests. Use 'Dismiss' to hide from your view."
        )
    
    # Delete the request
    await db.lift_requests.delete_one({"id": request_id})
    
    # Also clean up any dismissals for this request
    await db.lift_request_dismissals.delete_many({"request_id": request_id})
    
    return {"message": "Lift request deleted successfully"}


# ==================== ASSISTANCE PROVIDER ENDPOINTS ====================

@api_router.post("/assistance", response_model=AssistanceProvider)
async def create_assistance_provider(provider: AssistanceProviderCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Create assistance provider"""
    provider_obj = AssistanceProvider(**provider.model_dump())
    doc = serialize_datetime(provider_obj.model_dump())
    await db.assistance_providers.insert_one(doc)
    return provider_obj


@api_router.get("/assistance", response_model=List[AssistanceProvider])
async def get_all_assistance_providers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get all assistance providers (authenticated users) with pagination"""
    providers = await db.assistance_providers.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    for provider in providers:
        deserialize_datetime(provider, ['created_at'])
    return providers


@api_router.get("/assistance/{region}", response_model=List[AssistanceProvider])
async def get_assistance_providers_by_region(
    region: str,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get assistance providers by region (authenticated users) with pagination"""
    providers = await db.assistance_providers.find(
        {"region": region},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    for provider in providers:
        deserialize_datetime(provider, ['created_at'])
    
    return providers


@api_router.put("/assistance/{provider_id}", response_model=AssistanceProvider)
async def update_assistance_provider(provider_id: str, provider_update: AssistanceProviderCreate, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Update assistance provider"""
    existing = await db.assistance_providers.find_one({"id": provider_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    update_data = provider_update.model_dump()
    await db.assistance_providers.update_one({"id": provider_id}, {"$set": update_data})
    
    updated = await db.assistance_providers.find_one({"id": provider_id}, {"_id": 0})
    deserialize_datetime(updated, ['created_at'])
    return updated


@api_router.delete("/assistance/{provider_id}")
async def delete_assistance_provider(provider_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Admin: Delete assistance provider"""
    result = await db.assistance_providers.delete_one({"id": provider_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"message": "Provider deleted successfully"}


# ==================== PUSH NOTIFICATIONS ====================

@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for push subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_to_push(subscription_data: PushSubscriptionCreate, current_user: dict = Depends(get_current_user)):
    """Subscribe user to push notifications"""
    subscription_doc = {
        "id": str(uuid.uuid4()),
        "user_email": current_user['email'],
        "user_role": current_user.get('role', 'staff'),
        "subscription": subscription_data.subscription,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove any existing subscription for this endpoint
    await db.push_subscriptions.delete_many({
        "subscription.endpoint": subscription_data.subscription.get('endpoint')
    })
    
    # Save new subscription
    await db.push_subscriptions.insert_one(subscription_doc)
    return {"message": "Subscribed to push notifications"}

@api_router.delete("/push/unsubscribe")
async def unsubscribe_from_push(current_user: dict = Depends(get_current_user)):
    """Unsubscribe user from push notifications"""
    await db.push_subscriptions.delete_many({"user_email": current_user['email']})
    return {"message": "Unsubscribed from push notifications"}

async def send_push_notification(user_roles: List[str], title: str, body: str, url: str = "/", tag: str = None):
    """Send push notification to users with specified roles"""
    if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        logging.warning("VAPID keys not configured, skipping push notification")
        return
    
    # Get all subscriptions for users with the specified roles
    subscriptions = await db.push_subscriptions.find({
        "user_role": {"$in": user_roles}
    }, {"_id": 0}).to_list(1000)
    
    notification_payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/logo192.png",
        "badge": "/logo192.png",
        "url": url,
        "tag": tag or str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    failed_subscriptions = []
    
    for sub in subscriptions:
        try:
            webpush(
                subscription_info=sub['subscription'],
                data=notification_payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_EMAIL}
            )
        except WebPushException as ex:
            logging.error(f"Push notification failed: {ex}")
            # If subscription is invalid, mark for removal
            if ex.response and ex.response.status_code in [404, 410]:
                failed_subscriptions.append(sub['subscription']['endpoint'])
        except Exception as ex:
            logging.error(f"Push notification error: {ex}")
    
    # Remove invalid subscriptions
    if failed_subscriptions:
        await db.push_subscriptions.delete_many({
            "subscription.endpoint": {"$in": failed_subscriptions}
        })

async def send_push_to_user(user_email: str, title: str, body: str, url: str = "/", tag: str = None):
    """Send push notification to a specific user"""
    if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        return
    
    subscriptions = await db.push_subscriptions.find({
        "user_email": user_email
    }, {"_id": 0}).to_list(100)
    
    notification_payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/logo192.png",
        "badge": "/logo192.png",
        "url": url,
        "tag": tag or str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    for sub in subscriptions:
        try:
            webpush(
                subscription_info=sub['subscription'],
                data=notification_payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_EMAIL}
            )
        except Exception as ex:
            logging.error(f"Push notification error: {ex}")


# ==================== STAFF LOCATION TRACKING ENDPOINTS ====================

class StaffLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None  # GPS accuracy in meters
    heading: Optional[float] = None   # Direction of travel (degrees from north)
    speed: Optional[float] = None     # Speed in m/s

class StaffLocation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    user_name: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None
    is_sharing: bool = True
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@api_router.post("/location/update")
async def update_staff_location(location: StaffLocationUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user's location (staff members can share their location)"""
    user_email = current_user.get('email', '')
    user_name = user_email.split('@')[0] if user_email else 'Unknown'
    
    location_data = {
        "user_id": current_user['id'],
        "user_email": user_email,
        "user_name": user_name,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "accuracy": location.accuracy,
        "heading": location.heading,
        "speed": location.speed,
        "is_sharing": True,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update existing or insert new
    await db.staff_locations.update_one(
        {"user_id": current_user['id']},
        {"$set": location_data},
        upsert=True
    )
    
    return {"message": "Location updated successfully"}


@api_router.post("/location/stop-sharing")
async def stop_sharing_location(current_user: dict = Depends(get_current_user)):
    """Stop sharing location"""
    await db.staff_locations.update_one(
        {"user_id": current_user['id']},
        {"$set": {"is_sharing": False}}
    )
    return {"message": "Location sharing stopped"}


@api_router.get("/location/my-status")
async def get_my_location_status(current_user: dict = Depends(get_current_user)):
    """Get current user's location sharing status"""
    location = await db.staff_locations.find_one(
        {"user_id": current_user['id']}, 
        {"_id": 0}
    )
    return {
        "is_sharing": location.get('is_sharing', False) if location else False,
        "last_updated": location.get('last_updated') if location else None
    }


@api_router.get("/admin/staff-locations")
async def get_all_staff_locations(current_user: dict = Depends(get_current_admin_user)):
    """Admin: Get all staff locations who are actively sharing"""
    # Only return locations that are actively being shared and updated within last 30 minutes
    thirty_minutes_ago = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    
    locations = await db.staff_locations.find({
        "is_sharing": True,
        "last_updated": {"$gte": thirty_minutes_ago}
    }, {"_id": 0}).to_list(500)
    
    # Also get users who have stopped sharing or haven't updated recently
    all_users = await db.users.find({"is_active": True}, {"_id": 0, "id": 1, "email": 1, "role": 1}).to_list(500)
    active_user_ids = set(loc['user_id'] for loc in locations)
    
    # Find users not currently sharing
    inactive_users = []
    for user in all_users:
        if user['id'] not in active_user_ids:
            inactive_users.append({
                "user_id": user['id'],
                "user_email": user['email'],
                "user_name": user['email'].split('@')[0],
                "is_sharing": False,
                "role": user.get('role', 'staff')
            })
    
    return {
        "active_locations": locations,
        "inactive_users": inactive_users,
        "total_active": len(locations),
        "total_inactive": len(inactive_users)
    }


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def create_default_admin():
    """Create default admin user if no admin exists"""
    admin_count = await db.users.count_documents({"role": "admin"})
    if admin_count == 0:
        default_admin = {
            "id": str(uuid.uuid4()),
            "email": "admin@quickwing.com",
            "password_hash": get_password_hash("admin123"),
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(default_admin)
        logger.info("Default admin created: admin@quickwing.com / admin123")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
