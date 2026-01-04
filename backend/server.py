from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import qrcode
from io import BytesIO


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


# ==================== MODELS ====================

# Car Models
class CarBase(BaseModel):
    name: str
    registration: str
    current_status: str = "Free"  # Free, In Use, Needs Cleaning, Needs Repair

class CarCreate(CarBase):
    pass

class Car(CarBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    qr_code_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Status Update Models
class StatusUpdateCreate(BaseModel):
    car_id: str
    status: str  # Free, In Use, Needs Cleaning, Needs Repair
    notes: Optional[str] = ""
    user_name: Optional[str] = "Anonymous"

class StatusUpdate(StatusUpdateCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Booking Models
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


# Assistance Provider Models
class AssistanceProviderCreate(BaseModel):
    region: str  # Kerry, West Cork
    name: str
    phone: str
    service_type: str  # Breakdown, Maintenance, Towing, etc.

class AssistanceProvider(AssistanceProviderCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== HELPER FUNCTIONS ====================

def serialize_datetime(doc):
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(doc, dict):
        for key, value in doc.items():
            if isinstance(value, datetime):
                doc[key] = value.isoformat()
    return doc

def deserialize_datetime(doc, fields):
    """Convert ISO string back to datetime objects"""
    if doc:
        for field in fields:
            if field in doc and isinstance(doc[field], str):
                doc[field] = datetime.fromisoformat(doc[field])
    return doc


# ==================== CAR ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Quick Wing Fleet Management API"}


@api_router.post("/cars", response_model=Car)
async def create_car(car: CarCreate):
    """Create a new car"""
    car_obj = Car(**car.model_dump())
    car_obj.qr_code_url = f"/api/cars/{car_obj.id}/qr"
    
    doc = serialize_datetime(car_obj.model_dump())
    await db.cars.insert_one(doc)
    return car_obj


@api_router.get("/cars", response_model=List[Car])
async def get_cars():
    """Get all cars"""
    cars = await db.cars.find({}, {"_id": 0}).to_list(1000)
    for car in cars:
        deserialize_datetime(car, ['created_at'])
    return cars


@api_router.get("/cars/{car_id}", response_model=Car)
async def get_car(car_id: str):
    """Get a specific car"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    deserialize_datetime(car, ['created_at'])
    return car


@api_router.put("/cars/{car_id}", response_model=Car)
async def update_car(car_id: str, car_update: CarCreate):
    """Update a car"""
    existing_car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not existing_car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    update_data = car_update.model_dump()
    await db.cars.update_one({"id": car_id}, {"$set": update_data})
    
    updated_car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    deserialize_datetime(updated_car, ['created_at'])
    return updated_car


@api_router.delete("/cars/{car_id}")
async def delete_car(car_id: str):
    """Delete a car"""
    result = await db.cars.delete_one({"id": car_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Car not found")
    return {"message": "Car deleted successfully"}


@api_router.get("/cars/{car_id}/qr")
async def get_car_qr_code(car_id: str):
    """Generate QR code for a car"""
    car = await db.cars.find_one({"id": car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Generate QR code URL (points to status update page)
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    qr_url = f"{frontend_url}/status-update?car={car_id}"
    
    # Create QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to bytes
    buf = BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")


# ==================== STATUS UPDATE ENDPOINTS ====================

@api_router.post("/status", response_model=StatusUpdate)
async def create_status_update(status_update: StatusUpdateCreate):
    """Create a status update for a car"""
    # Verify car exists
    car = await db.cars.find_one({"id": status_update.car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Create status update
    status_obj = StatusUpdate(**status_update.model_dump())
    doc = serialize_datetime(status_obj.model_dump())
    await db.status_updates.insert_one(doc)
    
    # Update car's current status
    await db.cars.update_one(
        {"id": status_update.car_id},
        {"$set": {"current_status": status_update.status}}
    )
    
    return status_obj


@api_router.get("/status/live", response_model=List[dict])
async def get_live_status():
    """Get live status of all cars"""
    cars = await db.cars.find({}, {"_id": 0}).to_list(1000)
    
    result = []
    for car in cars:
        # Get latest status update for this car
        latest_status = await db.status_updates.find_one(
            {"car_id": car['id']},
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
        
        deserialize_datetime(car, ['created_at'])
        if latest_status:
            deserialize_datetime(latest_status, ['timestamp'])
        
        result.append({
            "car": car,
            "latest_status": latest_status
        })
    
    return result


@api_router.get("/status/history/{car_id}", response_model=List[StatusUpdate])
async def get_status_history(car_id: str, limit: int = Query(50, ge=1, le=500)):
    """Get status update history for a car"""
    history = await db.status_updates.find(
        {"car_id": car_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for item in history:
        deserialize_datetime(item, ['timestamp'])
    
    return history


# ==================== BOOKING ENDPOINTS ====================

@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking: BookingCreate):
    """Create a new booking with conflict checking"""
    # Verify car exists
    car = await db.cars.find_one({"id": booking.car_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Check for booking conflicts
    conflicts = await db.bookings.find({
        "car_id": booking.car_id,
        "$or": [
            # New booking starts during existing booking
            {
                "start_time": {"$lte": booking.start_time.isoformat()},
                "end_time": {"$gt": booking.start_time.isoformat()}
            },
            # New booking ends during existing booking
            {
                "start_time": {"$lt": booking.end_time.isoformat()},
                "end_time": {"$gte": booking.end_time.isoformat()}
            },
            # New booking encompasses existing booking
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
    
    # Create booking
    booking_obj = Booking(**booking.model_dump())
    doc = serialize_datetime(booking_obj.model_dump())
    await db.bookings.insert_one(doc)
    
    return booking_obj


@api_router.get("/bookings", response_model=List[Booking])
async def get_all_bookings():
    """Get all bookings"""
    bookings = await db.bookings.find({}, {"_id": 0}).sort("start_time", -1).to_list(1000)
    for booking in bookings:
        deserialize_datetime(booking, ['start_time', 'end_time', 'created_at'])
    return bookings


@api_router.get("/bookings/car/{car_id}", response_model=List[Booking])
async def get_car_bookings(car_id: str):
    """Get all bookings for a specific car"""
    bookings = await db.bookings.find(
        {"car_id": car_id},
        {"_id": 0}
    ).sort("start_time", -1).to_list(1000)
    
    for booking in bookings:
        deserialize_datetime(booking, ['start_time', 'end_time', 'created_at'])
    
    return bookings


@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str):
    """Delete a booking"""
    result = await db.bookings.delete_one({"id": booking_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking deleted successfully"}


# ==================== ASSISTANCE PROVIDER ENDPOINTS ====================

@api_router.post("/assistance", response_model=AssistanceProvider)
async def create_assistance_provider(provider: AssistanceProviderCreate):
    """Create a new assistance provider"""
    provider_obj = AssistanceProvider(**provider.model_dump())
    doc = serialize_datetime(provider_obj.model_dump())
    await db.assistance_providers.insert_one(doc)
    return provider_obj


@api_router.get("/assistance", response_model=List[AssistanceProvider])
async def get_all_assistance_providers():
    """Get all assistance providers"""
    providers = await db.assistance_providers.find({}, {"_id": 0}).to_list(1000)
    for provider in providers:
        deserialize_datetime(provider, ['created_at'])
    return providers


@api_router.get("/assistance/{region}", response_model=List[AssistanceProvider])
async def get_assistance_providers_by_region(region: str):
    """Get assistance providers for a specific region"""
    providers = await db.assistance_providers.find(
        {"region": region},
        {"_id": 0}
    ).to_list(1000)
    
    for provider in providers:
        deserialize_datetime(provider, ['created_at'])
    
    return providers


@api_router.put("/assistance/{provider_id}", response_model=AssistanceProvider)
async def update_assistance_provider(provider_id: str, provider_update: AssistanceProviderCreate):
    """Update an assistance provider"""
    existing = await db.assistance_providers.find_one({"id": provider_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    update_data = provider_update.model_dump()
    await db.assistance_providers.update_one({"id": provider_id}, {"$set": update_data})
    
    updated = await db.assistance_providers.find_one({"id": provider_id}, {"_id": 0})
    deserialize_datetime(updated, ['created_at'])
    return updated


@api_router.delete("/assistance/{provider_id}")
async def delete_assistance_provider(provider_id: str):
    """Delete an assistance provider"""
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
