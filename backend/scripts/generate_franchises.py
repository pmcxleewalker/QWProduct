"""
Generate 20 fully fitted franchises with complete data
"""
import os
import sys
sys.path.insert(0, '/app/backend')

from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import uuid
import random
from pymongo import MongoClient

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'quick_wing_db')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
print(f"Connected to database: {DB_NAME}")

# Irish Eircodes for journey data
DUBLIN_EIRCODES = [
    'D01 F5P2', 'D02 YK88', 'D03 A2B1', 'D04 N2W8', 'D05 K2R3',
    'D06 W8Y4', 'D07 P9K1', 'D08 R3E2', 'D09 T6H5', 'D10 Y7U9',
    'D11 W2E4', 'D12 R5T7', 'D13 Y8U2', 'D14 I3O5', 'D15 P6A8',
    'D16 S1D3', 'D17 F5G7', 'D18 H9J1', 'D20 K3L5', 'D22 Z7X9',
    'D24 C2V4', 'D06W F8P2', 'D08 T3E5', 'D04 H7N2'
]

CORK_EIRCODES = ['T12 A1B2', 'T23 C3D4', 'T45 E5F6', 'T12 X7Y8']
GALWAY_EIRCODES = ['H91 A2B3', 'H91 K4L5', 'H91 P6Q7']
LIMERICK_EIRCODES = ['V94 A1B2', 'V94 C3D4', 'V94 E5F6']

ALL_EIRCODES = DUBLIN_EIRCODES + CORK_EIRCODES + GALWAY_EIRCODES + LIMERICK_EIRCODES

# Franchise data - 20 unique businesses
FRANCHISES = [
    # Professional Tier (7)
    {"name": "Dublin Metro Fleet", "slug": "dublin-metro", "plan": "professional", "city": "Dublin", "industry": "taxi"},
    {"name": "Cork City Cabs", "slug": "cork-city-cabs", "plan": "professional", "city": "Cork", "industry": "taxi"},
    {"name": "Galway Bay Transport", "slug": "galway-bay", "plan": "professional", "city": "Galway", "industry": "transport"},
    {"name": "Limerick Logistics", "slug": "limerick-logistics", "plan": "professional", "city": "Limerick", "industry": "logistics"},
    {"name": "National Courier Services", "slug": "national-courier", "plan": "professional", "city": "Dublin", "industry": "courier"},
    {"name": "Executive Car Hire", "slug": "executive-hire", "plan": "professional", "city": "Dublin", "industry": "rental"},
    {"name": "Irish Medical Transport", "slug": "medical-transport", "plan": "professional", "city": "Dublin", "industry": "medical"},
    
    # Essential Tier (7)
    {"name": "Southside Shuttles", "slug": "southside-shuttles", "plan": "essential", "city": "Dublin", "industry": "shuttle"},
    {"name": "Northside Wheels", "slug": "northside-wheels", "plan": "essential", "city": "Dublin", "industry": "taxi"},
    {"name": "West Cork Delivery", "slug": "west-cork-delivery", "plan": "essential", "city": "Cork", "industry": "delivery"},
    {"name": "Connacht Carriers", "slug": "connacht-carriers", "plan": "essential", "city": "Galway", "industry": "logistics"},
    {"name": "Shannon Airport Transfer", "slug": "shannon-transfer", "plan": "essential", "city": "Limerick", "industry": "airport"},
    {"name": "Dublin Airport Express", "slug": "dublin-airport", "plan": "essential", "city": "Dublin", "industry": "airport"},
    {"name": "Midlands Movers", "slug": "midlands-movers", "plan": "essential", "city": "Dublin", "industry": "moving"},
    
    # Standard Tier (6)
    {"name": "Local Lads Delivery", "slug": "local-lads", "plan": "standard", "city": "Dublin", "industry": "delivery"},
    {"name": "Quick Drop Couriers", "slug": "quick-drop", "plan": "standard", "city": "Cork", "industry": "courier"},
    {"name": "City Centre Cabs", "slug": "city-centre-cabs", "plan": "standard", "city": "Dublin", "industry": "taxi"},
    {"name": "Suburban Services", "slug": "suburban-services", "plan": "standard", "city": "Dublin", "industry": "transport"},
    {"name": "Green Fleet Eco", "slug": "green-fleet", "plan": "standard", "city": "Dublin", "industry": "eco"},
    {"name": "Family Fleet Hire", "slug": "family-fleet", "plan": "standard", "city": "Galway", "industry": "rental"},
]

# Plan configurations
PLAN_LIMITS = {
    "standard": {"max_vehicles": 10, "max_users": 15, "customizations": 1},
    "essential": {"max_vehicles": 25, "max_users": 35, "customizations": 2},
    "professional": {"max_vehicles": 50, "max_users": 50, "customizations": 4},
}

# Vehicle types by industry
VEHICLE_TYPES = {
    "taxi": ["Toyota Prius", "Skoda Octavia", "Mercedes E-Class", "VW Passat", "Hyundai Ioniq"],
    "transport": ["Ford Transit", "Mercedes Sprinter", "VW Crafter", "Iveco Daily", "Renault Master"],
    "logistics": ["MAN TGE", "Mercedes Actros", "DAF XF", "Volvo FH", "Scania R500"],
    "courier": ["Ford Transit Connect", "VW Caddy", "Citroen Berlingo", "Peugeot Partner", "Renault Kangoo"],
    "rental": ["BMW 5 Series", "Audi A6", "Mercedes C-Class", "Range Rover Sport", "Tesla Model S"],
    "medical": ["Mercedes Vito", "VW Transporter", "Ford Transit Custom", "Renault Trafic", "Peugeot Expert"],
    "shuttle": ["Mercedes Sprinter 16", "Ford Transit 15", "VW Crafter 12", "Iveco Daily 14", "Toyota Hiace"],
    "airport": ["Mercedes V-Class", "VW Multivan", "Ford Tourneo", "Peugeot Traveller", "Citroen SpaceTourer"],
    "delivery": ["Ford Transit Courier", "VW Caddy Cargo", "Fiat Doblo", "Nissan NV200", "Toyota Proace City"],
    "moving": ["Luton Van", "7.5t Box Truck", "Ford Transit Luton", "Mercedes Luton", "Iveco Eurocargo"],
    "eco": ["Tesla Model 3", "Nissan Leaf", "VW ID.4", "BMW iX3", "Hyundai Kona Electric"],
}

# User roles
USER_ROLES = ["master_admin", "admin", "staff", "driver"]

# First and last names for generating users
FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Michael", "Jennifer", "David", "Linda", "William", "Elizabeth",
               "Sean", "Aoife", "Conor", "Siobhan", "Patrick", "Ciara", "Declan", "Niamh", "Brendan", "Orla",
               "Liam", "Emma", "Noah", "Olivia", "Cian", "Sophie", "Darragh", "Grace", "Fionn", "Emily"]
LAST_NAMES = ["Murphy", "Kelly", "O'Sullivan", "Walsh", "Smith", "O'Brien", "Byrne", "Ryan", "O'Connor", "O'Neill",
              "McCarthy", "O'Reilly", "Lynch", "O'Donnell", "Murray", "Quinn", "Moore", "McLoughlin", "Brennan", "Doyle"]

def generate_uuid():
    return str(uuid.uuid4())

def generate_registration(prefix, num):
    year = random.choice(["221", "222", "231", "232", "241", "242"])
    county = random.choice(["D", "C", "G", "L", "WX", "KE", "MH"])
    return f"{year}-{county}-{num:04d}"

def generate_phone():
    return f"+353 8{random.randint(1,9)} {random.randint(100,999)} {random.randint(1000,9999)}"

def hash_password(password):
    return pwd_context.hash(password)

def create_tenant(franchise_data):
    """Create a tenant document"""
    tenant_id = generate_uuid()
    plan = franchise_data["plan"]
    limits = PLAN_LIMITS[plan]
    
    tenant = {
        "id": tenant_id,
        "name": franchise_data["name"],
        "slug": franchise_data["slug"],
        "plan": plan,
        "status": "active",
        "max_vehicles": limits["max_vehicles"],
        "max_users": limits["max_users"],
        "customizations_per_month": limits["customizations"],
        "customizations_remaining": limits["customizations"],
        "feature_overrides": {},
        "branding": {
            "primary_color": random.choice(["#3B82F6", "#10B981", "#8B5CF6", "#EF4444", "#F59E0B"]),
            "logo_url": None
        },
        "contact_email": f"admin@{franchise_data['slug']}.ie",
        "contact_phone": generate_phone(),
        "address": f"{random.randint(1, 200)} {franchise_data['city']} Business Park, {franchise_data['city']}, Ireland",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return tenant, tenant_id

def create_users(tenant_id, tenant_slug, plan, count):
    """Create users for a tenant"""
    users = []
    password_hash = hash_password("Password123")
    
    # Role distribution based on plan
    if plan == "professional":
        role_counts = {"master_admin": 2, "admin": 5, "staff": 15, "driver": count - 22}
    elif plan == "essential":
        role_counts = {"master_admin": 1, "admin": 3, "staff": 10, "driver": count - 14}
    else:
        role_counts = {"master_admin": 1, "admin": 2, "staff": 5, "driver": count - 8}
    
    user_num = 0
    for role, role_count in role_counts.items():
        for i in range(max(0, role_count)):
            user_num += 1
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            
            user = {
                "id": generate_uuid(),
                "email": f"{first_name.lower()}.{last_name.lower()}{user_num}@{tenant_slug}.ie",
                "name": f"{first_name} {last_name}",
                "password_hash": password_hash,
                "role": role,
                "tenant_id": tenant_id,
                "phone": generate_phone() if role in ["driver", "admin", "master_admin"] else None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            users.append(user)
    
    return users

def create_vehicles(tenant_id, tenant_slug, industry, count):
    """Create vehicles for a tenant"""
    vehicles = []
    vehicle_models = VEHICLE_TYPES.get(industry, VEHICLE_TYPES["transport"])
    
    for i in range(count):
        vehicle_id = generate_uuid()
        model = random.choice(vehicle_models)
        
        vehicle = {
            "id": vehicle_id,
            "tenant_id": tenant_id,
            "name": f"{model} #{i+1}",
            "registration": generate_registration(tenant_slug[:3].upper(), i+1),
            "make": model.split()[0],
            "model": " ".join(model.split()[1:]) if len(model.split()) > 1 else model,
            "year": random.randint(2020, 2024),
            "color": random.choice(["White", "Black", "Silver", "Blue", "Red", "Grey"]),
            "fuel_type": random.choice(["Diesel", "Petrol", "Hybrid", "Electric"]),
            "status": random.choices(["available", "available", "available", "in_use", "maintenance"], weights=[50, 30, 10, 8, 2])[0],
            "current_mileage": random.randint(5000, 150000),
            "last_service_mileage": random.randint(1000, 50000),
            "service_due_mileage": random.randint(160000, 200000),
            "insurance_expiry": (datetime.now(timezone.utc) + timedelta(days=random.randint(30, 365))).isoformat(),
            "nct_expiry": (datetime.now(timezone.utc) + timedelta(days=random.randint(30, 730))).isoformat(),
            "tax_expiry": (datetime.now(timezone.utc) + timedelta(days=random.randint(30, 365))).isoformat(),
            "is_blocked": False,
            "block_reason": None,
            "notes": f"Fleet vehicle for {tenant_slug}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        vehicles.append(vehicle)
    
    return vehicles

def create_bookings(tenant_id, vehicles, users, count):
    """Create bookings for a tenant"""
    bookings = []
    drivers = [u for u in users if u["role"] == "driver"]
    staff = [u for u in users if u["role"] in ["staff", "admin", "master_admin"]]
    
    if not drivers:
        drivers = staff
    
    for i in range(count):
        vehicle = random.choice(vehicles)
        user = random.choice(drivers + staff)
        
        # Random date within last 30 days or next 14 days
        days_offset = random.randint(-30, 14)
        start_date = datetime.now(timezone.utc) + timedelta(days=days_offset)
        start_date = start_date.replace(hour=random.randint(6, 20), minute=random.choice([0, 15, 30, 45]))
        duration_hours = random.randint(1, 8)
        end_date = start_date + timedelta(hours=duration_hours)
        
        # Journey data (eircodes)
        start_eircode = random.choice(ALL_EIRCODES)
        end_eircode = random.choice([e for e in ALL_EIRCODES if e != start_eircode])
        
        # Optional stops
        num_stops = random.choices([0, 1, 2, 3], weights=[50, 30, 15, 5])[0]
        stops = random.sample([e for e in ALL_EIRCODES if e not in [start_eircode, end_eircode]], min(num_stops, len(ALL_EIRCODES)-2))
        
        booking = {
            "id": generate_uuid(),
            "tenant_id": tenant_id,
            "car_id": vehicle["id"],
            "user_id": user["id"],
            "user_name": user["name"],
            "start_time": start_date.isoformat(),
            "end_time": end_date.isoformat(),
            "purpose": random.choice(["Client meeting", "Delivery", "Airport run", "Site visit", "Patient transport", "Maintenance check", "Regular route"]),
            "status": "confirmed" if days_offset >= 0 else random.choice(["confirmed", "completed", "completed", "completed"]),
            "notes": random.choice([None, "Priority booking", "VIP client", "Recurring trip", "Handle with care"]),
            "is_recurring": random.choice([False, False, False, True]),
            "recurrence_pattern": None,
            "start_eircode": start_eircode,
            "end_eircode": end_eircode,
            "start_address": f"{random.randint(1, 200)} Main Street, Dublin",
            "end_address": f"{random.randint(1, 200)} High Street, Dublin",
            "journey_stops": [{"eircode": s, "address": f"Stop at {s}"} for s in stops],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        bookings.append(booking)
    
    return bookings

def create_mileage_logs(tenant_id, vehicles, users, count_per_vehicle=5):
    """Create mileage logs for vehicles"""
    logs = []
    
    for vehicle in vehicles:
        current_mileage = vehicle["current_mileage"]
        for i in range(count_per_vehicle):
            days_ago = (count_per_vehicle - i) * 7  # Weekly logs
            log_date = datetime.now(timezone.utc) - timedelta(days=days_ago)
            mileage_increase = random.randint(200, 1500)
            current_mileage -= mileage_increase  # Go backwards in time
            
            log = {
                "id": generate_uuid(),
                "tenant_id": tenant_id,
                "vehicle_id": vehicle["id"],
                "mileage": max(1000, current_mileage),
                "recorded_by": random.choice(users)["name"] if users else "System",
                "recorded_at": log_date.isoformat(),
                "notes": random.choice([None, "Weekly check", "After long trip", "Service log"]),
                "source": random.choice(["app", "qr_scan", "manual"]),
                "created_at": log_date.isoformat(),
            }
            logs.append(log)
    
    return logs

def create_announcements(tenant_id, count=3):
    """Create announcements for a tenant"""
    announcements = []
    titles = [
        "New Safety Protocol Update",
        "Holiday Schedule Changes",
        "Vehicle Maintenance Reminder",
        "Team Meeting This Friday",
        "New Client Onboarding",
        "System Update Notice",
        "Training Session Available",
        "Performance Bonus Announcement",
    ]
    
    for i in range(count):
        days_ago = random.randint(0, 30)
        announcement = {
            "id": generate_uuid(),
            "tenant_id": tenant_id,
            "title": random.choice(titles),
            "content": f"This is an important announcement for all team members. Please read carefully and acknowledge.",
            "priority": random.choice(["low", "normal", "high"]),
            "is_active": True,
            "created_by": "Admin",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=random.randint(7, 60))).isoformat(),
        }
        announcements.append(announcement)
    
    return announcements

def main():
    print("=" * 60)
    print("GENERATING 20 FULLY FITTED FRANCHISES")
    print("=" * 60)
    
    # Clear existing test data (keep super admin and existing core tenants)
    print("\nClearing old generated data...")
    
    # Get existing tenant slugs to preserve
    preserve_slugs = ['standard-fleet', 'essential-care', 'professional-transport']
    
    all_tenants = []
    all_users = []
    all_vehicles = []
    all_bookings = []
    all_mileage_logs = []
    all_announcements = []
    
    for idx, franchise in enumerate(FRANCHISES, 1):
        print(f"\n[{idx}/20] Creating: {franchise['name']} ({franchise['plan'].upper()})")
        
        # Create tenant
        tenant, tenant_id = create_tenant(franchise)
        all_tenants.append(tenant)
        
        # Determine counts based on plan (fill to capacity)
        limits = PLAN_LIMITS[franchise["plan"]]
        user_count = limits["max_users"]
        vehicle_count = limits["max_vehicles"]
        booking_count = vehicle_count * 3  # 3 bookings per vehicle average
        
        # Create users
        users = create_users(tenant_id, franchise["slug"], franchise["plan"], user_count)
        all_users.extend(users)
        print(f"   - Created {len(users)} users")
        
        # Create vehicles
        vehicles = create_vehicles(tenant_id, franchise["slug"], franchise["industry"], vehicle_count)
        all_vehicles.extend(vehicles)
        print(f"   - Created {len(vehicles)} vehicles")
        
        # Create bookings with journey data
        bookings = create_bookings(tenant_id, vehicles, users, booking_count)
        all_bookings.extend(bookings)
        print(f"   - Created {len(bookings)} bookings with journey data")
        
        # Create mileage logs
        logs = create_mileage_logs(tenant_id, vehicles, users, 5)
        all_mileage_logs.extend(logs)
        print(f"   - Created {len(logs)} mileage logs")
        
        # Create announcements
        announcements = create_announcements(tenant_id, 3)
        all_announcements.extend(announcements)
        print(f"   - Created {len(announcements)} announcements")
    
    # Insert all data into MongoDB
    print("\n" + "=" * 60)
    print("INSERTING DATA INTO DATABASE")
    print("=" * 60)
    
    # Insert tenants
    if all_tenants:
        db.tenants.insert_many(all_tenants)
        print(f"✓ Inserted {len(all_tenants)} tenants")
    
    # Insert users
    if all_users:
        db.users.insert_many(all_users)
        print(f"✓ Inserted {len(all_users)} users")
    
    # Insert vehicles
    if all_vehicles:
        db.vehicles.insert_many(all_vehicles)
        print(f"✓ Inserted {len(all_vehicles)} vehicles")
    
    # Insert bookings
    if all_bookings:
        db.bookings.insert_many(all_bookings)
        print(f"✓ Inserted {len(all_bookings)} bookings")
    
    # Insert mileage logs
    if all_mileage_logs:
        db.mileage_logs.insert_many(all_mileage_logs)
        print(f"✓ Inserted {len(all_mileage_logs)} mileage logs")
    
    # Insert announcements
    if all_announcements:
        db.announcements.insert_many(all_announcements)
        print(f"✓ Inserted {len(all_announcements)} announcements")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total Franchises: {len(all_tenants)}")
    print(f"  - Professional: {sum(1 for t in all_tenants if t['plan'] == 'professional')}")
    print(f"  - Essential: {sum(1 for t in all_tenants if t['plan'] == 'essential')}")
    print(f"  - Standard: {sum(1 for t in all_tenants if t['plan'] == 'standard')}")
    print(f"\nTotal Users: {len(all_users)}")
    print(f"Total Vehicles: {len(all_vehicles)}")
    print(f"Total Bookings: {len(all_bookings)}")
    print(f"Total Mileage Logs: {len(all_mileage_logs)}")
    print(f"Total Announcements: {len(all_announcements)}")
    
    print("\n" + "=" * 60)
    print("LOGIN CREDENTIALS")
    print("=" * 60)
    print("All users have password: Password123")
    print("\nSample logins per franchise:")
    for tenant in all_tenants[:5]:
        admin_email = f"james.murphy1@{tenant['slug']}.ie"
        print(f"  {tenant['name']}: {admin_email}")
    print("  ...")
    
    print("\n✅ GENERATION COMPLETE!")
    
    return all_tenants, all_users, all_vehicles, all_bookings

if __name__ == "__main__":
    main()
