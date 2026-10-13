import csv
import io
from datetime import datetime, time, timedelta, timezone
from html import escape
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from services.subscription_catalog import effective_capabilities

REPORTS = {"bookings": ("Booking details", "detailed_booking_reports"),
           "gps": ("GPS recorded samples", "gps_reports"),
           "compliance": ("Current compliance records", "compliance_reports"),
           "availability": ("Daily calendar availability", "daily_availability_reports")}


def parsed(value):
    try:
        result = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return result.astimezone(timezone.utc) if result.tzinfo else result.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


async def build_export(db, tenant_id, kind, fmt, start, end):
    if kind not in REPORTS or fmt not in {"csv", "pdf"}:
        raise HTTPException(404, "Report not found")
    if end < start or (end - start).days > 31:
        raise HTTPException(400, "Choose a report window of up to 32 calendar days.")
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    control = await db.tenant_subscription_controls.find_one({"tenant_id": tenant_id}, {"_id": 0})
    caps = effective_capabilities(tenant, control)
    if caps is not None and (REPORTS[kind][1] not in caps or (fmt == "pdf" and "pdf_exports" not in caps)):
        raise HTTPException(403, "This report is included in Essential or retained existing agreements.")
    limit = 5000 if fmt == "csv" else 500
    vehicles = await db.vehicles.find({"tenant_id": tenant_id}, {"_id": 0}).limit(5001).to_list(5001)
    if len(vehicles) > 5000:
        raise HTTPException(413, "This fleet exceeds the export size limit. Request a scoped report.")
    cars = {v["id"]: v for v in vehicles}
    first = datetime.combine(start, time.min, timezone.utc)
    stop = datetime.combine(end + timedelta(days=1), time.min, timezone.utc)
    note = "Dates and times are UTC. Missing values are left blank. These are operational records, not estimated savings."
    rows = []
    if kind in {"bookings", "availability"}:
        records = await db.bookings.find({"tenant_id": tenant_id, "start_time": {"$lt": stop.isoformat()},
                                         "end_time": {"$gt": first.isoformat()}}, {"_id": 0}).sort("start_time", 1).limit(10001).to_list(10001)
        if len(records) > 10000:
            raise HTTPException(413, "Too many bookings. Narrow the date range; no records have been silently omitted.")
        if kind == "bookings":
            headers = ["Vehicle", "Booking ID", "Start UTC", "End UTC", "Status", "Assigned staff ID"]
            rows = [[cars.get(b.get("car_id"), {}).get("registration", ""), b.get("id", ""), b.get("start_time", ""), b.get("end_time", ""), b.get("status", ""), b.get("assigned_to_user_id", "")] for b in records]
            note += " All recorded booking statuses are shown. An assigned staff ID is not proof of who drove."
        else:
            headers = ["Date UTC", "Vehicle", "Bookings", "Scheduled hours", "Unbooked calendar hours /24", "Blocked"]
            note += " Approved/in-progress/completed bookings only; overlapping intervals are counted once. Calendar hours are not working hours or measured driving/engine-idle time."
            for day in range((end-start).days+1):
                day_start = first + timedelta(days=day); day_end = day_start + timedelta(days=1)
                for vid, vehicle in cars.items():
                    intervals = []
                    for b in records:
                        if b.get("car_id") != vid or b.get("status") not in {"approved", "confirmed", "in_progress", "completed", "active"}:
                            continue
                        a, z = parsed(b.get("start_time")), parsed(b.get("end_time"))
                        if a and z and a < day_end and z > day_start:
                            intervals.append((max(a, day_start), min(z, day_end)))
                    merged = []
                    for a, z in sorted(intervals):
                        if merged and a <= merged[-1][1]:
                            merged[-1] = (merged[-1][0], max(z, merged[-1][1]))
                        else:
                            merged.append((a, z))
                    hours = sum((z-a).total_seconds()/3600 for a,z in merged)
                    blocked = bool(vehicle.get("is_blocked"))
                    rows.append([day_start.date().isoformat(), vehicle.get("registration", ""), len(intervals), round(hours,2), "" if blocked else round(24-hours,2), "Yes" if blocked else "No"])
                    if len(rows) > limit:
                        raise HTTPException(413, "Report is too large. Narrow the dates or select CSV instead of PDF.")
    elif kind == "gps":
        devices = await db.tracker_devices.find({"tenant_id": tenant_id}, {"_id": 0, "id": 1, "is_demo": 1}).to_list(10000)
        sources = {d["id"]: ("DEMO" if d.get("is_demo") else "Device") for d in devices}
        records = await db.tracker_history.find({"tenant_id": tenant_id, "timestamp": {"$gte": first.isoformat(), "$lt": stop.isoformat()}}, {"_id": 0}).sort("timestamp", 1).limit(limit+1).to_list(limit+1)
        headers = ["Vehicle", "Timestamp UTC", "Latitude", "Longitude", "Speed km/h", "Source"]
        rows = [[cars.get(p.get("car_id"), {}).get("registration", ""), p.get("timestamp", ""), p.get("lat", ""), p.get("lon", ""), p.get("speed", ""), sources.get(p.get("tracker_id"), "Unverified device")] for p in records]
        note += " GPS is sampled data, not continuous tracking. DEMO rows are simulated. No engine-idling or driver-risk estimates are included."
    else:
        headers = ["Vehicle", "Tax due", "Insurance due", "NCT due", "Service mileage due", "Recorded mileage"]
        rows = [[v.get("registration", ""), v.get("tax_due_date", ""), v.get("insurance_due_date", ""), v.get("nct_due_date", ""), v.get("service_due_mileage", ""), v.get("current_mileage", "")] for v in vehicles]
        note += " Current snapshot at generation, not historical compliance for the selected dates."
    if not rows:
        raise HTTPException(404, "No recorded data is available for this report and date range.")
    if len(rows) > limit:
        raise HTTPException(413, "Report is too large. Narrow the date range or select CSV instead of PDF.")
    filename = f"quickwing-{kind}-{start}-{end}.{fmt}"
    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["QuickWing", REPORTS[kind][0], "Generated UTC", datetime.now(timezone.utc).isoformat()])
        writer.writerow([note]); writer.writerow(headers)
        for row in rows:
            writer.writerow([("'"+v if isinstance(v,str) and v.startswith(("=", "+", "-", "@")) else v) for v in row])
        stream, mime = io.BytesIO(output.getvalue().encode("utf-8-sig")), "text/csv"
    else:
        stream = io.BytesIO(); styles = getSampleStyleSheet()
        doc = SimpleDocTemplate(stream, pagesize=landscape(A4), rightMargin=26, leftMargin=26, topMargin=26, bottomMargin=26)
        table_data = [[Paragraph(escape(str(v if v is not None else "")), styles['BodyText']) for v in row] for row in [headers]+rows]
        table = Table(table_data, colWidths=[doc.width/len(headers)]*len(headers), repeatRows=1, hAlign="LEFT")
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e8ebdf')),('GRID',(0,0),(-1,-1),.3,colors.HexColor('#ccd3c5')),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
        doc.build([Paragraph("QuickWing — "+REPORTS[kind][0], styles['Title']), Paragraph(escape(tenant.get('name','')),styles['Heading2']), Paragraph(f"{start} to {end} · UTC · Generated {datetime.now(timezone.utc).isoformat()}",styles['BodyText']), Spacer(1,10), Paragraph(escape(note),styles['BodyText']), Spacer(1,15), table])
        stream.seek(0); mime = "application/pdf"
    return StreamingResponse(stream, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{filename}"'})