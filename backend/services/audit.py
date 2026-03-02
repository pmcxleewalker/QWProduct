"""
Audit Service - Logs all sensitive actions for security and compliance
"""
from typing import Optional
from datetime import datetime, timezone
import uuid

from models.tenant import AuditEvent, AuditAction


class AuditService:
    def __init__(self, db):
        self.db = db
    
    async def log(
        self,
        actor_user_id: str,
        actor_email: str,
        action: AuditAction,
        tenant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        meta: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """
        Log an audit event.
        Call this for all sensitive operations.
        """
        event = {
            "id": str(uuid.uuid4()),
            "actor_user_id": actor_user_id,
            "actor_email": actor_email,
            "tenant_id": tenant_id,
            "action": action.value,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "meta": meta or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.audit_events.insert_one(event)
        return event
    
    async def log_tenant_action(
        self,
        actor_user_id: str,
        actor_email: str,
        action: AuditAction,
        tenant_id: str,
        meta: Optional[dict] = None,
        ip_address: Optional[str] = None
    ):
        """Log a tenant-related action"""
        return await self.log(
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            action=action,
            tenant_id=tenant_id,
            resource_type="tenant",
            resource_id=tenant_id,
            meta=meta,
            ip_address=ip_address
        )
    
    async def log_user_action(
        self,
        actor_user_id: str,
        actor_email: str,
        action: AuditAction,
        target_user_id: str,
        tenant_id: Optional[str] = None,
        meta: Optional[dict] = None,
        ip_address: Optional[str] = None
    ):
        """Log a user-related action"""
        return await self.log(
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            action=action,
            tenant_id=tenant_id,
            resource_type="user",
            resource_id=target_user_id,
            meta=meta,
            ip_address=ip_address
        )
    
    async def log_impersonation(
        self,
        actor_user_id: str,
        actor_email: str,
        tenant_id: str,
        action: AuditAction,
        meta: Optional[dict] = None,
        ip_address: Optional[str] = None
    ):
        """Log impersonation start/end"""
        return await self.log(
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            action=action,
            tenant_id=tenant_id,
            resource_type="impersonation",
            resource_id=tenant_id,
            meta=meta,
            ip_address=ip_address
        )
    
    async def log_security_event(
        self,
        actor_user_id: str,
        actor_email: str,
        action: AuditAction,
        meta: dict,
        tenant_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ):
        """Log a security-related event"""
        return await self.log(
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            action=action,
            tenant_id=tenant_id,
            resource_type="security",
            meta=meta,
            ip_address=ip_address
        )
    
    async def get_events(
        self,
        tenant_id: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        action: Optional[AuditAction] = None,
        resource_type: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ):
        """Get audit events with optional filters"""
        query = {}
        
        if tenant_id:
            query["tenant_id"] = tenant_id
        if actor_user_id:
            query["actor_user_id"] = actor_user_id
        if action:
            query["action"] = action.value
        if resource_type:
            query["resource_type"] = resource_type
        
        events = await self.db.audit_events.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        return events
    
    async def get_tenant_events(self, tenant_id: str, limit: int = 100):
        """Get all events for a specific tenant"""
        return await self.get_events(tenant_id=tenant_id, limit=limit)
    
    async def get_platform_events(self, limit: int = 100):
        """Get platform-level events (no tenant_id)"""
        events = await self.db.audit_events.find(
            {"tenant_id": None},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return events
