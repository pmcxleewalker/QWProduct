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

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ==================== AUTHENTICATION MODELS ====================

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInvite(BaseModel):
    email: EmailStr
    role: str = "staff"

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

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
    # Compliance dates
    tax_due_date: Optional[str] = None
    nct_due_date: Optional[str] = None
    service_due_date: Optional[str] = None
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
    destination_notes: Optional[str] = ""
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
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user['id'], "email": user['email'], "role": user['role']}
    }


@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user"""
    deserialize_datetime(current_user, ['created_at'])
    # Remove password_hash before returning
    current_user.pop('password_hash', None)
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


@api_router.post("/admin/users/invite")
async def invite_user(invite_data: UserInvite, current_admin: dict = Depends(get_current_admin_user)):
    """Admin: Create invite link for new user"""
    # Check if user already exists
    existing_user = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Generate invite token
    token = generate_invite_token()
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
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
    return users


@api_router.put("/admin/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate, current_admin: dict = Depends(get_current_admin_user)):
    """Admin: Update user role or status"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.model_dump(exclude_unset=True)
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    deserialize_datetime(updated_user, ['created_at'])
    return updated_user


@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_admin: dict = Depends(get_current_admin_user)):
    """Admin: Deactivate user"""
    # Prevent admin from deleting themselves
    if user_id == current_admin['id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deactivated successfully"}


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
    """Generate QR code for a car (public)"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    qr_url = f"{frontend_url}/status-update?car={car_id}"
    
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


# ==================== STATUS UPDATE ENDPOINTS ====================

@api_router.post("/status", response_model=StatusUpdate)
async def create_status_update(status_update: StatusUpdateCreate):
    """Create a status update (public for QR code access)"""
    car = await db.cars.find_one({"id": status_update.car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    status_obj = StatusUpdate(**status_update.model_dump())
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
    
    # Deserialize datetime fields
    for item in cars_with_status:
        if 'created_at' in item:
            deserialize_datetime(item, ['created_at'])
        if item.get('latest_status') and 'timestamp' in item['latest_status']:
            deserialize_datetime(item['latest_status'], ['timestamp'])
    
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
    car = await db.cars.find_one({"id": booking.car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Check if car is blocked
    if car.get('is_blocked'):
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
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get all bookings (authenticated users) with pagination"""
    bookings = await db.bookings.find({}, {"_id": 0}).sort("start_time", -1).skip(skip).limit(limit).to_list(limit)
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
    destination_notes: Optional[str] = None

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
    if booking_update.destination_notes is not None:
        update_data["destination_notes"] = booking_update.destination_notes
    
    if update_data:
        # Mark as individually edited if part of recurring series
        if booking.get('recurring_group_id'):
            update_data["individually_edited"] = True
        
        await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    updated_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    deserialize_datetime(updated_booking, ['start_time', 'end_time', 'created_at'])
    
    return updated_booking


class SeriesBookingUpdate(BaseModel):
    user_name: Optional[str] = None
    destination_notes: Optional[str] = None
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
    if booking_update.destination_notes is not None:
        update_data["destination_notes"] = booking_update.destination_notes
    
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
