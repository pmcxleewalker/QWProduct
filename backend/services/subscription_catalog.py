"""New commercial catalogue. Legacy PLAN_CONFIG and stored prices stay untouched."""
VERSION = "per_vehicle_v1"
STANDARD = {"standard_reports", "csv_exports", "fleet_operations"}
ESSENTIAL = STANDARD | {"detailed_booking_reports", "gps", "gps_reports", "compliance_reports",
                        "daily_availability_reports", "pdf_exports", "fuel_card_benefit"}
PROFESSIONAL = ESSENTIAL | {"advanced_staff_usage", "advanced_vehicle_usage", "custom_documents", "branded_pdf_headers"}
CAPABILITIES = {"standard": STANDARD, "essential": ESSENTIAL, "professional": PROFESSIONAL}
PLANS = {
    "standard": {"id": "standard", "name": "QuickWing Standard", "unit_price_cents": 650,
                 "status": "available", "description": "Your day-to-day fleet, organised.",
                 "highlights": ["Vehicle bookings, scheduling & allocation", "Staff accounts & mobile app",
                                "Live fleet availability & booking history", "Incidents, compliance & maintenance reminders",
                                "Automated bookings & booking intelligence", "Standard operational reports & CSV downloads"]},
    "essential": {"id": "essential", "name": "QuickWing Essential", "unit_price_cents": 850,
                  "status": "available", "recommended": True, "description": "More visibility. More insight. Just €2 more.",
                  "highlights": ["Everything in Standard", "Live GPS locations, speed & movement",
                                 "GPS history, journey replay & event review", "Detailed booking & GPS reports",
                                 "Compliance & daily availability reports", "CSV & PDF report downloads",
                                 "Optional Radius/DCI fuel-card benefits for eligible customers"]},
    "professional": {"id": "professional", "name": "QuickWing Professional", "unit_price_cents": 1250,
                     "status": "coming_soon", "description": "A deeper view of your fleet. Coming soon.",
                     "highlights": ["Everything in Standard & Essential", "Planned: in-depth staff usage reports",
                                    "Planned: advanced most-used vehicle analysis", "Planned: custom document design",
                                    "Planned: PDF headers with Quick Wing & office/branch logos",
                                    "Planned: consolidated analytics & Excel management reports"]},
}
COMPARISON = [
    ("fleet_operations", "Bookings, allocation, staff accounts & mobile app", "Operations"),
    ("standard_reports", "Standard reports & existing basic vehicle rankings", "Reports"),
    ("csv_exports", "Standard CSV downloads", "Reports"),
    ("detailed_booking_reports", "Detailed booking reports", "Reports"),
    ("compliance_reports", "Detailed compliance reports", "Reports"),
    ("daily_availability_reports", "Daily availability reports", "Reports"),
    ("pdf_exports", "Operational PDF report downloads", "Reports"),
    ("gps", "Live GPS, locations, speed & movement", "GPS"),
    ("gps_reports", "GPS history, replay & existing behaviour event review", "GPS"),
    ("fuel_card_benefit", "Optional eligible Radius/DCI fuel-card access", "Benefits"),
    ("advanced_staff_usage", "In-depth staff usage reporting", "Planned Professional"),
    ("advanced_vehicle_usage", "Advanced most-used vehicle analysis & comparisons", "Planned Professional"),
    ("custom_documents", "Custom document design", "Planned Professional"),
    ("branded_pdf_headers", "Quick Wing + office/branch logo headers on PDFs", "Planned Professional"),
]


def catalog():
    return {"version": VERSION, "currency": "EUR", "billing_basis": "per_vehicle_month",
            "plans": list(PLANS.values()),
            "comparison": [{"id": key, "label": label, "group": group,
                            "included": {plan: key in caps for plan, caps in CAPABILITIES.items()}}
                           for key, label, group in COMPARISON],
            "terms": {"tax": "VAT treatment is confirmed in your quote.",
                      "hardware": "GPS needs compatible hardware and activation. Hardware, installation arrangements and any separate charges are confirmed before activation.",
                      "fuel": "Radius/DCI fuel cards are optional and subject to eligibility, provider approval and terms. Discounts are not guaranteed. No details are shared with the partner automatically.",
                      "legacy": "Existing customers keep their agreed prices, capacity and existing features unless they explicitly accept a change. Existing standard reports are not removed."}}


def inherited_capabilities(tenant):
    if tenant.get("subscription_catalogue") == VERSION:
        return sorted(STANDARD)
    # Existing APIs already provide these operations to authorised tenant admins.
    capabilities = (ESSENTIAL - {"gps", "gps_reports", "fuel_card_benefit"}) | {"custom_documents"}
    if tenant.get("gps_enabled"):
        capabilities |= {"gps", "gps_reports"}
    return sorted(capabilities)


def effective_capabilities(tenant, control):
    agreement = (control or {}).get("active_agreement")
    if not agreement:
        return STANDARD if tenant.get("subscription_catalogue") == VERSION else None
    if agreement.get("pricing_version") != VERSION or agreement.get("plan") not in ("standard", "essential"):
        return set()  # Unknown/unreleased agreements fail closed.
    result = CAPABILITIES[agreement["plan"]] | set((control or {}).get("grandfather_capabilities", []))
    for key, cap in {"pdf_exports": "pdf_exports", "daily_availability_reports": "daily_availability_reports",
                     "custom_documents": "custom_documents", "gps": "gps", "gps_reports": "gps_reports"}.items():
        if tenant.get("feature_overrides", {}).get(key) is False:
            result.discard(cap)
    return result


def required_capability(path, method):
    """Additional plan checks; existing role/tenant checks still apply."""
    if path.startswith(("/api/tracker/", "/api/behaviour/", "/api/tenant/gps/")) or path.endswith("/geofence"):
        return "gps"
    if path.startswith(("/api/tenant/daily-timeline", "/api/tenant/reports/daily-timeline")):
        return "daily_availability_reports"
    if path == "/api/tenant/reports/vehicle-utilization":
        return "detailed_booking_reports"
    if "compliance-audit" in path or "compliance-pack" in path:
        return "compliance_reports"
    if ("/reports/" in path or "/documents/submissions/" in path) and path.endswith(("/pdf", ".pdf")):
        return "pdf_exports"
    if path.startswith("/api/documents/templates") and method in {"POST", "PUT", "PATCH", "DELETE"}:
        return "custom_documents"
    return None


def plan_features(tenant, control, existing):
    caps = effective_capabilities(tenant, control)
    if caps is None:
        return existing
    result = dict(existing)
    for key in ["vehicle_booking", "fleet_compliance", "basic_reports", "staff_calendars",
                "admin_all_cars_calendar", "booking_admin_control", "recurring_bookings",
                "live_status_updates", "qr_codes", "block_vehicles", "request_lift",
                "show_map", "map_booking_pins", "status_history", "announcements", "mileage_tracking",
                "user_management", "booking_visibility_enhanced"]:
        result[key] = True
    result.update(enhanced_reports="detailed_booking_reports" in caps, detailed_reports=False,
                  cost_analytics=False, pdf_exports="pdf_exports" in caps,
                  daily_availability_reports="daily_availability_reports" in caps,
                  daily_timeline="daily_availability_reports" in caps,
                  custom_documents="custom_documents" in caps, gps="gps" in caps)
    # Preserve previously granted flags only for opt-ins from existing agreements.
    for key, value in (control or {}).get("legacy_feature_overrides", {}).items():
        if value is True:
            result[key] = True
    for key, value in tenant.get("feature_overrides", {}).items():
        if isinstance(value, bool):
            result[key] = value
    return result


async def enforce_capability(db, tenant, request):
    from fastapi import HTTPException
    capability = required_capability(request.url.path, request.method)
    if not capability:
        return
    control = await db.tenant_subscription_controls.find_one({"tenant_id": tenant["id"]}, {"_id": 0})
    capabilities = effective_capabilities(tenant, control)
    if capabilities is not None and capability not in capabilities:
        raise HTTPException(403, {"code": "plan_feature_required", "feature": capability,
                                  "message": "This feature is not included in your selected agreement. Existing records remain safe."})