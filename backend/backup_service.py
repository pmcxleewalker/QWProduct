"""
Quick Wing Backup Service
Provides full database backup and restore functionality for disaster recovery.
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

logger = logging.getLogger(__name__)

class BackupService:
    """Service for creating and restoring database backups."""
    
    # Collections to backup (in order of dependencies)
    BACKUP_COLLECTIONS = [
        "tenants",
        "users", 
        "tenant_memberships",
        "vehicles",
        "bookings",
        "mileage_logs",
        "status_updates",
        "lift_requests",
        "announcements",
        "audit_logs",
        "tenant_settings",
        "providers",
        "locations",
        "messages",
        "todos",
        "content_assets",
        "content_drafts"
    ]
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def create_full_backup(self) -> Dict[str, Any]:
        """
        Create a full backup of all collections.
        Returns a JSON-serializable dictionary with all data.
        """
        backup_data = {
            "backup_info": {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "backup_type": "full",
                "version": "1.0",
                "platform": "Quick Wing Fleet Management"
            },
            "collections": {}
        }
        
        total_documents = 0
        
        for collection_name in self.BACKUP_COLLECTIONS:
            try:
                collection = self.db[collection_name]
                documents = await collection.find({}, {"_id": 0}).to_list(length=None)
                backup_data["collections"][collection_name] = documents
                total_documents += len(documents)
                logger.info(f"Backed up {len(documents)} documents from {collection_name}")
            except Exception as e:
                logger.error(f"Error backing up {collection_name}: {e}")
                backup_data["collections"][collection_name] = []
        
        backup_data["backup_info"]["total_documents"] = total_documents
        backup_data["backup_info"]["collections_count"] = len(self.BACKUP_COLLECTIONS)
        
        return backup_data
    
    async def create_tenant_backup(self, tenant_id: str) -> Dict[str, Any]:
        """
        Create a backup for a specific tenant/franchise.
        """
        backup_data = {
            "backup_info": {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "backup_type": "tenant",
                "tenant_id": tenant_id,
                "version": "1.0",
                "platform": "Quick Wing Fleet Management"
            },
            "collections": {}
        }
        
        # Get tenant info first
        tenant = await self.db.tenants.find_one({"id": tenant_id}, {"_id": 0})
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")
        
        backup_data["tenant_info"] = tenant
        
        # Collections that are tenant-scoped
        tenant_scoped_collections = [
            ("vehicles", "tenant_id"),
            ("bookings", "tenant_id"),
            ("mileage_logs", "tenant_id"),
            ("status_updates", "tenant_id"),
            ("lift_requests", "tenant_id"),
            ("announcements", "tenant_id"),
            ("audit_logs", "tenant_id"),
            ("tenant_settings", "tenant_id"),
            ("providers", "tenant_id"),
            ("locations", "tenant_id"),
            ("messages", "tenant_id"),
            ("todos", "tenant_id"),
            ("content_assets", "tenant_id"),
            ("content_drafts", "tenant_id")
        ]
        
        total_documents = 0
        
        for collection_name, tenant_field in tenant_scoped_collections:
            try:
                collection = self.db[collection_name]
                documents = await collection.find(
                    {tenant_field: tenant_id}, 
                    {"_id": 0}
                ).to_list(length=None)
                backup_data["collections"][collection_name] = documents
                total_documents += len(documents)
            except Exception as e:
                logger.error(f"Error backing up {collection_name}: {e}")
                backup_data["collections"][collection_name] = []
        
        # Get users associated with this tenant
        memberships = await self.db.tenant_memberships.find(
            {"tenant_id": tenant_id}, 
            {"_id": 0}
        ).to_list(length=None)
        backup_data["collections"]["tenant_memberships"] = memberships
        
        user_ids = [m.get("user_id") for m in memberships if m.get("user_id")]
        if user_ids:
            users = await self.db.users.find(
                {"id": {"$in": user_ids}},
                {"_id": 0, "password_hash": 0}  # Exclude sensitive data
            ).to_list(length=None)
            backup_data["collections"]["users"] = users
            total_documents += len(users)
        
        backup_data["backup_info"]["total_documents"] = total_documents
        
        return backup_data
    
    async def get_backup_stats(self) -> Dict[str, Any]:
        """Get statistics about current database state."""
        stats = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "collections": {}
        }
        
        total_docs = 0
        for collection_name in self.BACKUP_COLLECTIONS:
            try:
                count = await self.db[collection_name].count_documents({})
                stats["collections"][collection_name] = count
                total_docs += count
            except:
                stats["collections"][collection_name] = 0
        
        stats["total_documents"] = total_docs
        
        # Get tenant counts
        tenants = await self.db.tenants.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=None)
        stats["tenants"] = len(tenants)
        stats["tenant_list"] = [{"id": t.get("id"), "name": t.get("name")} for t in tenants]
        
        return stats
    
    async def restore_tenant_backup(self, backup_data: Dict[str, Any], overwrite: bool = False) -> Dict[str, Any]:
        """
        Restore a tenant from backup data.
        
        WARNING: If overwrite=True, existing data will be replaced.
        """
        if backup_data.get("backup_info", {}).get("backup_type") != "tenant":
            raise ValueError("Invalid backup type. Expected 'tenant' backup.")
        
        tenant_id = backup_data.get("backup_info", {}).get("tenant_id")
        if not tenant_id:
            raise ValueError("Backup missing tenant_id")
        
        results = {
            "tenant_id": tenant_id,
            "restored_at": datetime.now(timezone.utc).isoformat(),
            "collections_restored": {},
            "errors": []
        }
        
        collections = backup_data.get("collections", {})
        
        for collection_name, documents in collections.items():
            if not documents:
                continue
                
            try:
                collection = self.db[collection_name]
                
                if overwrite:
                    # Delete existing tenant data first
                    if collection_name == "users":
                        user_ids = [d.get("id") for d in documents]
                        await collection.delete_many({"id": {"$in": user_ids}})
                    else:
                        await collection.delete_many({"tenant_id": tenant_id})
                
                # Insert backup data
                if documents:
                    await collection.insert_many(documents)
                    results["collections_restored"][collection_name] = len(documents)
                    
            except Exception as e:
                results["errors"].append(f"{collection_name}: {str(e)}")
        
        return results


def serialize_backup(backup_data: Dict[str, Any]) -> str:
    """Convert backup data to JSON string with proper datetime handling."""
    def json_serializer(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")
    
    return json.dumps(backup_data, default=json_serializer, indent=2)
