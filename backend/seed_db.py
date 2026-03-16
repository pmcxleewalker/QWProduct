"""
Database Seeding Script for Quick Wing Fleet Management
This script ensures the super admin user exists on startup.
"""
import asyncio
import os
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from uuid import uuid4
from datetime import datetime, timezone

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'quick_wing_db')

# Default Super Admin Credentials
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"
SUPER_ADMIN_NAME = "Super Admin"


async def seed_database():
    """Seed the database with required initial data."""
    print(f"Connecting to MongoDB: {MONGO_URL}/{DB_NAME}")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Check if super admin exists
        existing_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL})
        
        if existing_admin:
            print(f"Super admin already exists: {SUPER_ADMIN_EMAIL}")
            user_id = existing_admin["id"]
            
            # Update password to ensure it matches
            password_hash = bcrypt.hashpw(SUPER_ADMIN_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            await db.users.update_one(
                {"email": SUPER_ADMIN_EMAIL},
                {"$set": {"password_hash": password_hash, "is_active": True}}
            )
            print("Super admin password updated.")
            
            # CRITICAL: Ensure super_admin membership exists
            existing_membership = await db.memberships.find_one({
                "user_id": user_id,
                "role": "super_admin"
            })
            
            if not existing_membership:
                # Check if any membership exists for this user
                any_membership = await db.memberships.find_one({"user_id": user_id})
                
                if any_membership:
                    # Update existing membership to super_admin role
                    await db.memberships.update_one(
                        {"user_id": user_id},
                        {"$set": {"role": "super_admin", "tenant_id": None}}
                    )
                    print(f"Updated existing membership to super_admin role")
                else:
                    # Create new super_admin membership
                    membership = {
                        "id": str(uuid4()),
                        "user_id": user_id,
                        "tenant_id": None,
                        "role": "super_admin",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.memberships.insert_one(membership)
                    print(f"Created super_admin membership for existing user")
            else:
                print("Super admin membership already exists")
        else:
            # Create super admin user
            password_hash = bcrypt.hashpw(SUPER_ADMIN_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            user_id = str(uuid4())
            super_admin = {
                "id": user_id,
                "email": SUPER_ADMIN_EMAIL,
                "name": SUPER_ADMIN_NAME,
                "password_hash": password_hash,
                "role": "super_admin",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.users.insert_one(super_admin)
            print(f"Created super admin: {SUPER_ADMIN_EMAIL}")
            
            # Create super_admin membership
            membership = {
                "id": str(uuid4()),
                "user_id": user_id,
                "tenant_id": None,
                "role": "super_admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.memberships.insert_one(membership)
            print(f"Created super_admin membership")
        
        # Ensure indexes exist
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.tenants.create_index("slug", unique=True)
        await db.tenants.create_index("id", unique=True)
        await db.memberships.create_index([("user_id", 1), ("tenant_id", 1)], unique=True)
        await db.vehicles.create_index("tenant_id")
        await db.bookings.create_index("tenant_id")
        await db.invoices.create_index("tenant_id")
        print("Database indexes created/verified.")
        
        print("\n" + "="*50)
        print("DATABASE SEEDING COMPLETE")
        print("="*50)
        print(f"\nSuper Admin Credentials:")
        print(f"  Email: {SUPER_ADMIN_EMAIL}")
        print(f"  Password: {SUPER_ADMIN_PASSWORD}")
        print(f"\nLogin URL: {os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/login")
        print("="*50 + "\n")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(seed_database())
