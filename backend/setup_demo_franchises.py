"""
Setup Demo Franchises - Creates one franchise for each tier with demo data
Run this script to reset the demo environment with properly tiered franchises
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# Demo franchise configurations
DEMO_FRANCHISES = [
    {
        "name": "Standard Fleet Co",
        "slug": "standard-fleet",
        "plan": "standard",
        "max_vehicles": 10,
        "max_users": 20,
        "customizations_remaining": 1,
        "admin_email": "admin@standardfleet.com",
        "admin_name": "Standard Admin",
        "admin_password": "Standard123",
        "vehicles": [
            {"name": "Van 1", "registration": "STD-001", "current_status": "Free"},
            {"name": "Van 2", "registration": "STD-002", "current_status": "In Use"},
            {"name": "Van 3", "registration": "STD-003", "current_status": "Free"},
        ],
        "staff": [
            {"name": "John Standard", "email": "john@standardfleet.com", "password": "John123"},
            {"name": "Sarah Standard", "email": "sarah@standardfleet.com", "password": "Sarah123"},
        ]
    },
    {
        "name": "Essential Care Fleet",
        "slug": "essential-care",
        "plan": "essential",
        "max_vehicles": 25,
        "max_users": 35,
        "customizations_remaining": 2,
        "admin_email": "admin@essentialcare.com",
        "admin_name": "Essential Admin",
        "admin_password": "Essential123",
        "vehicles": [
            {"name": "Ambulance Alpha", "registration": "ESS-001", "current_status": "Free"},
            {"name": "Ambulance Bravo", "registration": "ESS-002", "current_status": "In Use"},
            {"name": "Ambulance Charlie", "registration": "ESS-003", "current_status": "Free"},
            {"name": "Support Van", "registration": "ESS-004", "current_status": "Free"},
            {"name": "Wheelchair Van", "registration": "ESS-005", "current_status": "In Use"},
        ],
        "staff": [
            {"name": "Mike Essential", "email": "mike@essentialcare.com", "password": "Mike123"},
            {"name": "Emma Essential", "email": "emma@essentialcare.com", "password": "Emma123"},
            {"name": "David Essential", "email": "david@essentialcare.com", "password": "David123"},
        ]
    },
    {
        "name": "Professional Transport Group",
        "slug": "pro-transport",
        "plan": "professional",
        "max_vehicles": 50,
        "max_users": 50,
        "customizations_remaining": 4,
        "admin_email": "admin@protransport.com",
        "admin_name": "Pro Admin",
        "admin_password": "Pro123",
        "vehicles": [
            {"name": "Executive 1", "registration": "PRO-001", "current_status": "Free"},
            {"name": "Executive 2", "registration": "PRO-002", "current_status": "In Use"},
            {"name": "Executive 3", "registration": "PRO-003", "current_status": "Free"},
            {"name": "Medical Unit A", "registration": "PRO-004", "current_status": "Free"},
            {"name": "Medical Unit B", "registration": "PRO-005", "current_status": "In Use"},
            {"name": "Medical Unit C", "registration": "PRO-006", "current_status": "Free"},
            {"name": "Logistics Van 1", "registration": "PRO-007", "current_status": "Free"},
            {"name": "Logistics Van 2", "registration": "PRO-008", "current_status": "Out of Service"},
        ],
        "staff": [
            {"name": "Alex Pro", "email": "alex@protransport.com", "password": "Alex123"},
            {"name": "Beth Pro", "email": "beth@protransport.com", "password": "Beth123"},
            {"name": "Charlie Pro", "email": "charlie@protransport.com", "password": "Charlie123"},
            {"name": "Diana Pro", "email": "diana@protransport.com", "password": "Diana123"},
            {"name": "Edward Pro", "email": "edward@protransport.com", "password": "Edward123"},
        ]
    }
]

async def setup_demo_franchises():
    """Delete existing franchises and create demo franchises for each tier"""
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("\n" + "="*60)
    print("QUICK WING - DEMO FRANCHISE SETUP")
    print("="*60)
    
    # Get all existing tenants (except we'll keep the super admin)
    existing_tenants = await db.tenants.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    print(f"\n🗑️  Deleting {len(existing_tenants)} existing franchise(s)...")
    
    for tenant in existing_tenants:
        tenant_id = tenant["id"]
        # Delete tenant's vehicles
        del_vehicles = await db.vehicles.delete_many({"tenant_id": tenant_id})
        # Delete tenant's bookings
        del_bookings = await db.bookings.delete_many({"tenant_id": tenant_id})
        # Delete tenant's memberships
        del_memberships = await db.memberships.delete_many({"tenant_id": tenant_id})
        # Delete tenant
        await db.tenants.delete_one({"id": tenant_id})
        print(f"   ✓ Deleted '{tenant['name']}' (vehicles: {del_vehicles.deleted_count}, bookings: {del_bookings.deleted_count})")
    
    # Delete non-admin users (keep super admin)
    await db.users.delete_many({"role": {"$ne": "super_admin"}})
    
    print(f"\n✨ Creating 3 demo franchises (one per tier)...\n")
    
    # Get super admin ID
    super_admin = await db.users.find_one({"role": "super_admin"}, {"_id": 0, "id": 1, "email": 1})
    super_admin_id = super_admin["id"] if super_admin else None
    
    created_franchises = []
    
    for config in DEMO_FRANCHISES:
        tenant_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Create tenant
        tenant_doc = {
            "id": tenant_id,
            "name": config["name"],
            "slug": config["slug"],
            "status": "active",
            "plan": config["plan"],
            "max_vehicles": config["max_vehicles"],
            "max_users": config["max_users"],
            "customizations_remaining": config["customizations_remaining"],
            "created_at": now,
            "updated_at": now,
            "settings": {
                "company_name": config["name"],
                "primary_color": "#2563eb" if config["plan"] == "essential" else "#7c3aed" if config["plan"] == "professional" else "#4b5563"
            }
        }
        await db.tenants.insert_one(tenant_doc)
        
        # Create master admin user
        admin_user_id = str(uuid.uuid4())
        admin_user = {
            "id": admin_user_id,
            "email": config["admin_email"],
            "name": config["admin_name"],
            "password_hash": get_password_hash(config["admin_password"]),
            "role": None,  # Role is per-tenant
            "created_at": now,
            "updated_at": now
        }
        await db.users.insert_one(admin_user)
        
        # Create master admin membership
        await db.memberships.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": admin_user_id,
            "tenant_id": tenant_id,
            "role": "master_admin",
            "created_at": now
        })
        
        # Add super admin membership to this tenant
        if super_admin_id:
            await db.memberships.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": super_admin_id,
                "tenant_id": tenant_id,
                "role": "admin",
                "created_at": now
            })
        
        # Create vehicles
        for vehicle in config["vehicles"]:
            await db.vehicles.insert_one({
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "name": vehicle["name"],
                "registration": vehicle["registration"],
                "current_status": vehicle["current_status"],
                "created_at": now,
                "updated_at": now
            })
        
        # Create staff users
        for staff in config["staff"]:
            staff_user_id = str(uuid.uuid4())
            await db.users.insert_one({
                "id": staff_user_id,
                "email": staff["email"],
                "name": staff["name"],
                "password_hash": get_password_hash(staff["password"]),
                "role": None,
                "created_at": now,
                "updated_at": now
            })
            await db.memberships.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": staff_user_id,
                "tenant_id": tenant_id,
                "role": "staff",
                "created_at": now
            })
        
        # Create some demo bookings
        vehicles_list = await db.vehicles.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(10)
        users_list = await db.memberships.find({"tenant_id": tenant_id, "role": "staff"}, {"_id": 0}).to_list(10)
        
        for i, vehicle in enumerate(vehicles_list[:3]):
            if users_list:
                user_membership = users_list[i % len(users_list)]
                user = await db.users.find_one({"id": user_membership["user_id"]}, {"_id": 0})
                if user:
                    booking_date = datetime.now(timezone.utc) + timedelta(days=i+1)
                    await db.bookings.insert_one({
                        "id": str(uuid.uuid4()),
                        "tenant_id": tenant_id,
                        "vehicle_id": vehicle["id"],
                        "vehicle_name": vehicle["name"],
                        "user_id": user["id"],
                        "user_name": user["name"],
                        "date": booking_date.strftime("%Y-%m-%d"),
                        "start_time": "09:00",
                        "end_time": "17:00",
                        "status": "confirmed",
                        "created_at": now
                    })
        
        tier_emoji = "🚗" if config["plan"] == "standard" else "⭐" if config["plan"] == "essential" else "👑"
        print(f"{tier_emoji} {config['plan'].upper()}: {config['name']}")
        print(f"   URL: /{config['slug']}")
        print(f"   Admin: {config['admin_email']} / {config['admin_password']}")
        print(f"   Vehicles: {len(config['vehicles'])} | Staff: {len(config['staff'])}")
        print()
        
        created_franchises.append({
            "name": config["name"],
            "slug": config["slug"],
            "plan": config["plan"],
            "admin_email": config["admin_email"],
            "admin_password": config["admin_password"]
        })
    
    print("="*60)
    print("✅ DEMO SETUP COMPLETE!")
    print("="*60)
    print("\nLogin URLs:")
    for f in created_franchises:
        tier_emoji = "🚗" if f["plan"] == "standard" else "⭐" if f["plan"] == "essential" else "👑"
        print(f"  {tier_emoji} {f['plan'].upper()}: /{f['slug']}/login")
        print(f"     Email: {f['admin_email']}")
        print(f"     Password: {f['admin_password']}")
        print()
    
    print("Super Admin: superadmin@quickwing.com / Super123")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(setup_demo_franchises())
