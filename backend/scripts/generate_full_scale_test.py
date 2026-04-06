"""
Full Scale Stress Test - 20 Professional Tier Franchises with 12 Months of Data
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import uuid
import random
from pymongo import MongoClient, InsertOne
from pymongo.errors import BulkWriteError

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'quick_wing_db')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

print(f"Connected to database: {DB_NAME}")

# Irish Eircodes for journey data
EIRCODES = [
    'D01 F5P2', 'D02 YK88', 'D03 A2B1', 'D04 N2W8', 'D05 K2R3',
    'D06 W8Y4', 'D07 P9K1', 'D08 R3E2', 'D09 T6H5', 'D10 Y7U9',
    'D11 W2E4', 'D12 R5T7', 'D13 Y8U2', 'D14 I3O5', 'D15 P6A8',
    'D16 S1D3', 'D17 F5G7', 'D18 H9J1', 'D20 K3L5', 'D22 Z7X9',
    'D24 C2V4', 'T12 A1B2', 'T23 C3D4', 'T45 E5F6', 'H91 A2B3',
    'H91 K4L5', 'V94 A1B2', 'V94 C3D4'
]

# 20 Professional Tier Franchises
FRANCHISES = [
    {"name": "Metro Fleet Dublin", "slug": "metro-dublin", "city": "Dublin"},
    {"name": "Cork Premier Transport", "slug": "cork-premier", "city": "Cork"},
    {"name": "Galway Executive Cars", "slug": "galway-exec", "city": "Galway"},
    {"name": "Limerick City Fleet", "slug": "limerick-city", "city": "Limerick"},
    {"name": "Waterford Logistics", "slug": "waterford-logistics", "city": "Waterford"},
    {"name": "Kilkenny Couriers", "slug": "kilkenny-couriers", "city": "Kilkenny"},
    {"name": "Sligo Transport Services", "slug": "sligo-transport", "city": "Sligo"},
    {"name": "Dundalk Fleet Management", "slug": "dundalk-fleet", "city": "Dundalk"},
    {"name": "Drogheda Delivery Co", "slug": "drogheda-delivery", "city": "Drogheda"},
    {"name": "Athlone Central Fleet", "slug": "athlone-central", "city": "Athlone"},
    {"name": "Wexford Wheels", "slug": "wexford-wheels", "city": "Wexford"},
    {"name": "Carlow Cars Ltd", "slug": "carlow-cars", "city": "Carlow"},
    {"name": "Tralee Transport", "slug": "tralee-transport", "city": "Tralee"},
    {"name": "Ennis Express", "slug": "ennis-express", "city": "Ennis"},
    {"name": "Letterkenny Logistics", "slug": "letterkenny-logistics", "city": "Letterkenny"},
    {"name": "Navan Fleet Services", "slug": "navan-fleet", "city": "Navan"},
    {"name": "Mullingar Motors", "slug": "mullingar-motors", "city": "Mullingar"},
    {"name": "Tullamore Transport", "slug": "tullamore-transport", "city": "Tullamore"},
    {"name": "Portlaoise Premier", "slug": "portlaoise-premier", "city": "Portlaoise"},
    {"name": "Clonmel Carriers", "slug": "clonmel-carriers", "city": "Clonmel"},
]

VEHICLE_MODELS = [
    "Toyota Prius", "Skoda Octavia", "Mercedes E-Class", "VW Passat", "Hyundai Ioniq",
    "Ford Transit", "Mercedes Sprinter", "VW Crafter", "BMW 5 Series", "Audi A6",
    "Tesla Model 3", "Nissan Leaf", "VW ID.4", "Mercedes Vito", "Ford Transit Custom"
]

FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Michael", "Jennifer", "David", "Linda", 
               "Sean", "Aoife", "Conor", "Siobhan", "Patrick", "Ciara", "Declan", "Niamh",
               "Liam", "Emma", "Noah", "Olivia", "Cian", "Sophie", "Darragh", "Grace"]
LAST_NAMES = ["Murphy", "Kelly", "Sullivan", "Walsh", "Smith", "Brien", "Byrne", "Ryan",
              "Connor", "Neill", "McCarthy", "Reilly", "Lynch", "Donnell", "Murray", "Quinn"]

BOOKING_PURPOSES = ["Client meeting", "Delivery", "Airport transfer", "Site visit", 
                    "Patient transport", "Maintenance", "Regular route", "Emergency call",
                    "Corporate event", "School run", "Hospital visit", "Court appearance"]

def generate_uuid():
    return str(uuid.uuid4())

def generate_reg():
    year = random.choice(["221", "222", "231", "232", "241", "242"])
    county = random.choice(["D", "C", "G", "L", "W", "KE", "MH", "WX"])
    return f"{year}-{county}-{random.randint(1000, 9999)}"

def hash_password(password):
    return pwd_context.hash(password)

def clear_stress_test_data():
    """Remove previously generated stress test data"""
    print("\nClearing previous stress test data...")
    
    # Get stress test tenant IDs
    stress_slugs = [f["slug"] for f in FRANCHISES]
    stress_tenants = list(db.tenants.find({"slug": {"$in": stress_slugs}}, {"id": 1}))
    stress_tenant_ids = [t["id"] for t in stress_tenants]
    
    if stress_tenant_ids:
        # Delete related data
        del_bookings = db.bookings.delete_many({"tenant_id": {"$in": stress_tenant_ids}})
        del_vehicles = db.vehicles.delete_many({"tenant_id": {"$in": stress_tenant_ids}})
        del_users = db.users.delete_many({"tenant_id": {"$in": stress_tenant_ids}})
        del_mileage = db.mileage_logs.delete_many({"tenant_id": {"$in": stress_tenant_ids}})
        del_tenants = db.tenants.delete_many({"slug": {"$in": stress_slugs}})
        
        print(f"  Deleted: {del_tenants.deleted_count} tenants, {del_vehicles.deleted_count} vehicles, "
              f"{del_users.deleted_count} users, {del_bookings.deleted_count} bookings, "
              f"{del_mileage.deleted_count} mileage logs")

def create_tenant(franchise):
    """Create a Professional tier tenant"""
    return {
        "id": generate_uuid(),
        "name": franchise["name"],
        "slug": franchise["slug"],
        "plan": "professional",
        "status": "active",
        "max_vehicles": 50,
        "max_users": 50,
        "customizations_per_month": 4,
        "customizations_remaining": 4,
        "feature_overrides": {},
        "branding": {"primary_color": random.choice(["#3B82F6", "#10B981", "#8B5CF6", "#EF4444"])},
        "contact_email": f"admin@{franchise['slug']}.ie",
        "address": f"{franchise['city']} Business Park, {franchise['city']}, Ireland",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

def create_users(tenant_id, tenant_slug, count=50):
    """Create users for a tenant - 50 users total"""
    users = []
    password_hash = hash_password("Password123")
    
    # Role distribution: 2 master_admin, 5 admin, 15 staff, 28 drivers
    roles = (["master_admin"] * 2 + ["admin"] * 5 + ["staff"] * 15 + ["driver"] * 28)[:count]
    
    for i, role in enumerate(roles):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        users.append({
            "id": generate_uuid(),
            "email": f"{first.lower()}.{last.lower()}{i+1}@{tenant_slug}.ie",
            "name": f"{first} {last}",
            "password_hash": password_hash,
            "role": role,
            "tenant_id": tenant_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    
    return users

def create_vehicles(tenant_id, count=50):
    """Create vehicles for a tenant - 50 vehicles"""
    vehicles = []
    for i in range(count):
        model = random.choice(VEHICLE_MODELS)
        vehicles.append({
            "id": generate_uuid(),
            "tenant_id": tenant_id,
            "name": f"{model} #{i+1}",
            "registration": generate_reg(),
            "make": model.split()[0],
            "model": " ".join(model.split()[1:]),
            "year": random.randint(2020, 2024),
            "color": random.choice(["White", "Black", "Silver", "Blue", "Grey"]),
            "fuel_type": random.choice(["Diesel", "Petrol", "Hybrid", "Electric"]),
            "status": "available",
            "current_mileage": random.randint(10000, 100000),
            "last_service_mileage": random.randint(5000, 50000),
            "service_due_mileage": random.randint(110000, 150000),
            "is_blocked": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return vehicles

def create_bookings_for_year(tenant_id, vehicles, users, months=12):
    """Create 12 months of bookings - ~3 per vehicle per week"""
    bookings = []
    drivers = [u for u in users if u["role"] in ["driver", "staff"]]
    
    start_date = datetime.now(timezone.utc) - timedelta(days=30 * months)
    end_date = datetime.now(timezone.utc) + timedelta(days=14)  # Include 2 weeks future
    
    current_date = start_date
    while current_date < end_date:
        # For each vehicle, create ~3 bookings per week (randomized)
        for vehicle in vehicles:
            # ~40% chance of booking on any given day per vehicle
            if random.random() < 0.40:
                user = random.choice(drivers)
                
                # Random time during business hours
                hour = random.randint(6, 20)
                minute = random.choice([0, 15, 30, 45])
                booking_start = current_date.replace(hour=hour, minute=minute)
                duration = random.randint(1, 6)
                booking_end = booking_start + timedelta(hours=duration)
                
                # Journey data
                start_eircode = random.choice(EIRCODES)
                end_eircode = random.choice([e for e in EIRCODES if e != start_eircode])
                
                # Status based on date
                if booking_start < datetime.now(timezone.utc) - timedelta(days=1):
                    status = random.choices(["completed", "cancelled"], weights=[95, 5])[0]
                elif booking_start < datetime.now(timezone.utc):
                    status = "confirmed"
                else:
                    status = random.choices(["confirmed", "pending"], weights=[80, 20])[0]
                
                bookings.append({
                    "id": generate_uuid(),
                    "tenant_id": tenant_id,
                    "car_id": vehicle["id"],
                    "user_id": user["id"],
                    "user_name": user["name"],
                    "start_time": booking_start.isoformat(),
                    "end_time": booking_end.isoformat(),
                    "purpose": random.choice(BOOKING_PURPOSES),
                    "status": status,
                    "is_recurring": random.random() < 0.1,  # 10% recurring
                    "start_eircode": start_eircode,
                    "end_eircode": end_eircode,
                    "start_address": f"{random.randint(1, 200)} Main St",
                    "end_address": f"{random.randint(1, 200)} High St",
                    "journey_stops": [],
                    "created_at": booking_start.isoformat(),
                    "updated_at": booking_start.isoformat(),
                })
        
        current_date += timedelta(days=1)
    
    return bookings

def create_mileage_logs(tenant_id, vehicles, months=12):
    """Create weekly mileage logs for each vehicle"""
    logs = []
    start_date = datetime.now(timezone.utc) - timedelta(days=30 * months)
    
    for vehicle in vehicles:
        current_mileage = vehicle["current_mileage"]
        current_date = start_date
        
        while current_date < datetime.now(timezone.utc):
            # Weekly log
            mileage_increase = random.randint(200, 800)
            current_mileage += mileage_increase
            
            logs.append({
                "id": generate_uuid(),
                "tenant_id": tenant_id,
                "vehicle_id": vehicle["id"],
                "mileage": current_mileage,
                "recorded_by": "System",
                "recorded_at": current_date.isoformat(),
                "source": random.choice(["app", "qr_scan", "manual"]),
                "created_at": current_date.isoformat(),
            })
            
            current_date += timedelta(days=7)
    
    return logs

def bulk_insert(collection, documents, batch_size=5000):
    """Insert documents in batches"""
    total = len(documents)
    inserted = 0
    
    for i in range(0, total, batch_size):
        batch = documents[i:i + batch_size]
        try:
            result = collection.insert_many(batch, ordered=False)
            inserted += len(result.inserted_ids)
        except BulkWriteError as e:
            inserted += e.details.get('nInserted', 0)
    
    return inserted

def main():
    print("=" * 60)
    print("FULL SCALE STRESS TEST - 20 Professional Franchises")
    print("12 Months of Data Generation")
    print("=" * 60)
    
    # Clear previous test data
    clear_stress_test_data()
    
    all_tenants = []
    all_users = []
    all_vehicles = []
    all_bookings = []
    all_mileage = []
    
    total_start = datetime.now()
    
    for idx, franchise in enumerate(FRANCHISES, 1):
        franchise_start = datetime.now()
        print(f"\n[{idx}/20] {franchise['name']}")
        
        # Create tenant
        tenant = create_tenant(franchise)
        all_tenants.append(tenant)
        
        # Create users (50)
        users = create_users(tenant["id"], franchise["slug"], 50)
        all_users.extend(users)
        print(f"  ✓ 50 users")
        
        # Create vehicles (50)
        vehicles = create_vehicles(tenant["id"], 50)
        all_vehicles.extend(vehicles)
        print(f"  ✓ 50 vehicles")
        
        # Create 12 months of bookings
        bookings = create_bookings_for_year(tenant["id"], vehicles, users, 12)
        all_bookings.extend(bookings)
        print(f"  ✓ {len(bookings):,} bookings (12 months)")
        
        # Create mileage logs
        mileage = create_mileage_logs(tenant["id"], vehicles, 12)
        all_mileage.extend(mileage)
        print(f"  ✓ {len(mileage):,} mileage logs")
        
        elapsed = (datetime.now() - franchise_start).total_seconds()
        print(f"  ⏱ {elapsed:.1f}s")
    
    # Bulk insert all data
    print("\n" + "=" * 60)
    print("INSERTING DATA INTO DATABASE...")
    print("=" * 60)
    
    print(f"\nInserting {len(all_tenants)} tenants...")
    db.tenants.insert_many(all_tenants)
    
    print(f"Inserting {len(all_users):,} users...")
    bulk_insert(db.users, all_users)
    
    print(f"Inserting {len(all_vehicles):,} vehicles...")
    bulk_insert(db.vehicles, all_vehicles)
    
    print(f"Inserting {len(all_bookings):,} bookings...")
    bulk_insert(db.bookings, all_bookings, batch_size=10000)
    
    print(f"Inserting {len(all_mileage):,} mileage logs...")
    bulk_insert(db.mileage_logs, all_mileage, batch_size=10000)
    
    total_elapsed = (datetime.now() - total_start).total_seconds()
    
    # Final summary
    print("\n" + "=" * 60)
    print("STRESS TEST DATA GENERATED")
    print("=" * 60)
    print(f"\n✅ 20 Professional Tier Franchises")
    print(f"✅ {len(all_users):,} Users (50 per franchise)")
    print(f"✅ {len(all_vehicles):,} Vehicles (50 per franchise)")
    print(f"✅ {len(all_bookings):,} Bookings (12 months)")
    print(f"✅ {len(all_mileage):,} Mileage Logs")
    print(f"\n⏱ Total time: {total_elapsed:.1f} seconds")
    
    # Verify counts
    print("\n" + "=" * 60)
    print("DATABASE VERIFICATION")
    print("=" * 60)
    print(f"Total Tenants: {db.tenants.count_documents({}):,}")
    print(f"Total Users: {db.users.count_documents({}):,}")
    print(f"Total Vehicles: {db.vehicles.count_documents({}):,}")
    print(f"Total Bookings: {db.bookings.count_documents({}):,}")
    print(f"Total Mileage Logs: {db.mileage_logs.count_documents({}):,}")
    
    print("\n" + "=" * 60)
    print("LOGIN CREDENTIALS")
    print("=" * 60)
    print("All users: Password123")
    print("\nSample admin logins:")
    for t in all_tenants[:5]:
        print(f"  {t['name']}: james.murphy1@{t['slug']}.ie")

if __name__ == "__main__":
    main()
