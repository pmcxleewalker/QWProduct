from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from middleware.tenant import require_admin, require_super_admin
from models.subscriptions import Mutation, PlanRequest, PlanReview, PlanConsent, PlanApply, SubscriptionView, SubscriptionIndex
from services.subscription_catalog import catalog
from services.subscription_workflow import view, create_request, transition


def build_router(db):
    router = APIRouter(tags=["subscriptions"])

    async def customer_actor(context, write=True):
        platform_owner = not context.is_demo and context.platform_role == "super_admin"
        if not context.tenant_id:
            raise HTTPException(400, "Choose a tenant first")
        if not write and (platform_owner or context.is_impersonating):
            return
        if write and (context.is_demo or context.is_impersonating or platform_owner):
            raise HTTPException(403, "A real tenant administrator must make this decision directly.")
        member = await db.memberships.find_one({"tenant_id": context.tenant_id, "user_id": context.user_id,
            "role": {"$in": ["admin", "master_admin"]}, "is_active": {"$ne": False}}, {"_id": 0, "id": 1})
        if not member:
            raise HTTPException(403, "Tenant administrator membership is required.")

    @router.get("/public/subscription-catalog")
    async def public_catalog():
        return catalog()

    @router.get("/tenant/subscription", response_model=SubscriptionView)
    async def current(context=Depends(require_admin)):
        await customer_actor(context, write=False)
        return await view(db, context.tenant_id)

    @router.get("/tenant/subscription/reports/{kind}/{fmt}")
    async def report(kind: str, fmt: str, start: date, end: date, context=Depends(require_admin)):
        from services.operational_exports import build_export
        await customer_actor(context, write=False)
        return await build_export(db, context.tenant_id, kind, fmt, start, end)

    @router.post("/tenant/subscription/requests", response_model=SubscriptionView)
    async def request_change(body: PlanRequest, context=Depends(require_admin)):
        await customer_actor(context)
        return await create_request(db, context, body)

    @router.post("/tenant/subscription/requests/{rid}/accept", response_model=SubscriptionView)
    async def accept(rid: str, body: PlanConsent, context=Depends(require_admin)):
        await customer_actor(context)
        return await transition(db, context.tenant_id, rid, "accept", context, body)

    @router.post("/tenant/subscription/requests/{rid}/cancel", response_model=SubscriptionView)
    async def cancel(rid: str, body: Mutation, context=Depends(require_admin)):
        await customer_actor(context)
        return await transition(db, context.tenant_id, rid, "cancel", context, body)

    @router.get("/platform/subscriptions", response_model=SubscriptionIndex)
    async def index(context=Depends(require_super_admin)):
        ids = await db.tenant_subscription_controls.find({}, {"_id": 0, "tenant_id": 1}).to_list(1000)
        return {"items": [await view(db, item["tenant_id"]) for item in ids]}

    @router.post("/platform/subscriptions/{tenant_id}/requests/{rid}/review", response_model=SubscriptionView)
    async def review(tenant_id: str, rid: str, body: PlanReview, context=Depends(require_super_admin)):
        return await transition(db, tenant_id, rid, "review", context, body)

    @router.post("/platform/subscriptions/{tenant_id}/requests/{rid}/apply", response_model=SubscriptionView)
    async def apply(tenant_id: str, rid: str, body: PlanApply, context=Depends(require_super_admin)):
        return await transition(db, tenant_id, rid, "apply", context, body)

    return router