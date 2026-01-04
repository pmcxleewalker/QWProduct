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


# ==================== CAR MODELS ====================

class CarBase(BaseModel):
    name: str
    registration: str
    current_status: str = "Free"

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

class Booking(BookingCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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


# ==================== ADMIN USER MANAGEMENT ENDPOINTS ====================

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
    """Delete a booking (authenticated users)"""
    result = await db.bookings.delete_one({"id": booking_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking deleted successfully"}


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
async def get_assistance_providers_by_region(region: str, current_user: dict = Depends(get_current_user)):
    """Get assistance providers by region (authenticated users)"""
    providers = await db.assistance_providers.find(
        {"region": region},
        {"_id": 0}
    ).to_list(1000)
    
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
