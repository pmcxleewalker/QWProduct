"""Consent-first changes. All mutations target ONE separate Mongo document."""
import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from services.subscription_catalog import PLANS, VERSION, inherited_capabilities, effective_capabilities
from models.tenant import TenantPlan, get_plan_default_features


def now():
    return datetime.now(timezone.utc).isoformat()


def fingerprint(body):
    return hashlib.sha256(json.dumps(body.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()


def event(action, request_id, context, body):
    return {"id": str(uuid4()), "action": action, "request_id": request_id,
            "actor_id": context.user_id, "at": now(), "idempotency_key": body.idempotency_key,
            "fingerprint": fingerprint(body)}


def retry(control, body):
    for entry in (control or {}).get("audit_events", []):
        if entry.get("idempotency_key") == body.idempotency_key:
            if entry.get("fingerprint") != fingerprint(body):
                raise HTTPException(409, "This retry key was already used for different terms.")
            return True
    return False


def available(plan):
    if plan not in PLANS or PLANS[plan]["status"] != "available":
        raise HTTPException(409, "Professional is coming soon. Register interest instead; it cannot be activated.")


async def tenant_document(db, tenant_id):
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    return tenant


async def view(db, tenant_id):
    tenant = await tenant_document(db, tenant_id)
    control = await db.tenant_subscription_controls.find_one({"tenant_id": tenant_id}, {"_id": 0}) or {}
    caps = effective_capabilities(tenant, control)
    # Never return a Mongo document directly; this is an explicit public projection.
    audit = [{k: e.get(k) for k in ("id", "action", "request_id", "actor_id", "at")}
             for e in control.get("audit_events", [])]
    return {"tenant_id": tenant_id, "tenant_name": tenant.get("name", ""),
            "revision": control.get("revision", 0), "legacy": caps is None,
            "legacy_agreement": {"plan": tenant.get("plan"), "monthly_price": tenant.get("monthly_price"),
                                 "max_vehicles": tenant.get("max_vehicles"), "max_users": tenant.get("max_users"),
                                 "gps_enabled": bool(tenant.get("gps_enabled"))},
            "active_agreement": control.get("active_agreement"), "capabilities": sorted(caps) if caps is not None else None,
            "grandfather_capabilities": control.get("grandfather_capabilities", []),
            "requests": [{k: v for k, v in r.items() if k != "idempotency_key"} for r in control.get("requests", [])],
            "audit_events": audit, "vehicle_count": await db.vehicles.count_documents({"tenant_id": tenant_id}),
            "billing_unchanged": True}


async def create_request(db, context, body):
    tenant = await tenant_document(db, context.tenant_id)
    available(body.plan)
    if not body.acknowledged:
        raise HTTPException(400, "Please acknowledge that no billing or GPS change is automatic.")
    if body.effective_date < datetime.now(timezone.utc).date():
        raise HTTPException(400, "Choose today or a future effective date.")
    control = await db.tenant_subscription_controls.find_one({"tenant_id": context.tenant_id}, {"_id": 0})
    if retry(control, body):
        return await view(db, context.tenant_id)
    if (control or {}).get("revision", 0) != body.revision:
        raise HTTPException(409, "Agreement changed. Reload and review the latest terms.")
    if any(r["status"] in {"requested", "quoted", "accepted"} for r in (control or {}).get("requests", [])):
        raise HTTPException(409, "An open plan request already exists. Complete or cancel it first.")
    if len((control or {}).get("requests", [])) >= 200:
        raise HTTPException(409, "Agreement history needs an administrative archive before another change.")
    rid = str(uuid4())
    request = {"id": rid, "plan": body.plan, "requested_effective_date": body.effective_date.isoformat(),
               "reason": body.reason.strip(), "status": "requested", "requested_at": now(),
               "requested_by": context.user_id, "idempotency_key": body.idempotency_key,
               "consent_version": "plan-request-v1", "acknowledged": True}
    entry = event("requested", rid, context, body)
    if not control:
        legacy_features = {}
        if tenant.get("subscription_catalogue") != VERSION:
            try:
                legacy_features = get_plan_default_features(TenantPlan(tenant.get("plan", "standard")))
            except ValueError:
                legacy_features = get_plan_default_features(TenantPlan.STANDARD)
            legacy_features.update({key: value for key, value in tenant.get("feature_overrides", {}).items() if isinstance(value, bool)})
        document = {"_id": context.tenant_id, "tenant_id": context.tenant_id, "revision": 1,
                    "active_agreement": None, "grandfather_capabilities": inherited_capabilities(tenant),
                    "legacy_feature_overrides": legacy_features,
                    "requests": [request], "audit_events": [entry]}
        try:
            await db.tenant_subscription_controls.insert_one(document)
        except DuplicateKeyError:
            existing = await db.tenant_subscription_controls.find_one({"tenant_id": context.tenant_id}, {"_id": 0})
            if not retry(existing, body):
                raise HTTPException(409, "Another request was created. Reload before continuing.")
    else:
        updated = await db.tenant_subscription_controls.update_one(
            {"tenant_id": context.tenant_id, "revision": body.revision},
            {"$push": {"requests": request, "audit_events": entry}, "$inc": {"revision": 1}})
        if not updated.modified_count:
            raise HTTPException(409, "Agreement changed. Reload before continuing.")
    return await view(db, context.tenant_id)


async def transition(db, tenant_id, rid, action, context, body):
    await tenant_document(db, tenant_id)
    control = await db.tenant_subscription_controls.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not control:
        raise HTTPException(404, "Request not found")
    if retry(control, body):
        return await view(db, tenant_id)
    if control["revision"] != body.revision:
        raise HTTPException(409, "This request has changed. Reload before continuing.")
    request = next((r for r in control["requests"] if r["id"] == rid), None)
    if not request:
        raise HTTPException(404, "Request not found")
    available(request["plan"])
    updates = {}
    if action == "review":
        if not body.notes.strip():
            raise HTTPException(400, "Review notes cannot be blank.")
        if request["status"] != "requested":
            raise HTTPException(409, "Only a new request can be reviewed.")
        if body.decision == "reject":
            request.update(status="rejected", review_notes=body.notes.strip())
        else:
            if not body.vehicle_quantity or not body.tax_treatment or not body.effective_date:
                raise HTTPException(400, "A vehicle quantity, VAT treatment and effective date are required.")
            if body.effective_date < datetime.now(timezone.utc).date():
                raise HTTPException(400, "The effective date cannot be in the past.")
            if request["plan"] == "essential" and not body.hardware_terms.strip():
                raise HTTPException(400, "Confirm the hardware/installation arrangements in the quote.")
            plan = PLANS[request["plan"]]
            request.update(status="quoted", quote={"plan": request["plan"], "name": plan["name"],
                "unit_price_cents": plan["unit_price_cents"], "currency": "EUR",
                "vehicle_quantity": body.vehicle_quantity,
                "reference_monthly_cents": plan["unit_price_cents"] * body.vehicle_quantity,
                "tax_treatment": body.tax_treatment, "effective_date": body.effective_date.isoformat(),
                "hardware_terms": body.hardware_terms.strip(), "notes": body.notes.strip(),
                "retained_capabilities": control.get("grandfather_capabilities", []),
                "billing_notice": "No automatic charges, invoice changes or GPS activation. Existing billing is handled separately."})
        request.update(reviewed_by=context.user_id, reviewed_at=now())
    elif action == "accept":
        if request["status"] != "quoted" or not body.accepted:
            raise HTTPException(400, "Explicit acceptance of the current quote is required.")
        request.update(status="accepted", accepted_by=context.user_id, accepted_at=now(), consent_version="quoted-plan-v1")
    elif action == "cancel":
        if request["status"] not in {"requested", "quoted", "accepted"}:
            raise HTTPException(409, "This request can no longer be cancelled.")
        request.update(status="cancelled", cancelled_by=context.user_id, cancelled_at=now())
    elif action == "apply":
        if request["status"] != "accepted" or not body.confirmed:
            raise HTTPException(400, "Customer acceptance and explicit platform confirmation are required.")
        quote = request["quote"]
        if quote["effective_date"] > datetime.now(timezone.utc).date().isoformat():
            raise HTTPException(409, "The agreed effective date has not arrived. Application is manual.")
        request.update(status="applied", applied_by=context.user_id, applied_at=now())
        updates["active_agreement"] = {**quote, "pricing_version": VERSION, "request_id": rid,
                                       "effective_at": now(), "billing_managed_separately": True}
    else:
        raise HTTPException(400, "Unknown transition")
    # Request status, agreement, revision and append-only audit are ONE atomic write.
    updates["requests"] = control["requests"]
    result = await db.tenant_subscription_controls.find_one_and_update(
        {"tenant_id": tenant_id, "revision": body.revision},
        {"$set": updates, "$inc": {"revision": 1}, "$push": {"audit_events": event(action, rid, context, body)}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not result:
        raise HTTPException(409, "Another change was saved first. Reload before continuing.")
    return await view(db, tenant_id)