"""CSV validation and persistent review batches; existing vehicles/trackers stay authoritative."""
import csv
import hashlib
import io
import json
import re
import uuid
from collections import Counter
from datetime import datetime, timezone

from fastapi import HTTPException
from services.tracker_asset_claims import device_keys

FIELDS = ("registration", "tracker_id", "sim_iccid", "sim_msisdn", "tracker_model")
COMMANDS = ("8030000 sensor.net", "8040000 45.112.204.245 8090", "7100000", "8960000E00")
MAX_BYTES = 512 * 1024
MAX_ROWS = 200


def now():
    return datetime.now(timezone.utc).isoformat()


def normal_registration(value):
    return re.sub(r"[\s-]+", "", value).upper()


def parse_csv(content):
    try:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text), strict=True)
        if not reader.fieldnames or len(reader.fieldnames) != len(FIELDS) or set(reader.fieldnames) != set(FIELDS):
            raise HTTPException(400, "CSV headers must be exactly: " + ",".join(FIELDS)
                                + ". Franchise columns are not allowed.")
        rows = []
        for line, raw in enumerate(reader, 2):
            if None in raw or any(value is None for value in raw.values()):
                raise HTTPException(400, f"Row {line} has the wrong number of columns")
            row = {key: raw[key].strip() for key in FIELDS}
            if not any(row.values()):
                continue
            if any(len(value) > 120 for value in row.values()):
                raise HTTPException(400, f"Row {line} contains a field longer than 120 characters")
            row["registration"] = row["registration"].upper()
            row["sim_msisdn"] = row["sim_msisdn"].lstrip("+")
            rows.append(row)
            if len(rows) > MAX_ROWS:
                raise HTTPException(400, f"Maximum {MAX_ROWS} rows per CSV")
        if not rows:
            raise HTTPException(400, "CSV contains no tracker rows")
        return rows
    except (UnicodeDecodeError, csv.Error):
        raise HTTPException(400, "Upload a valid UTF-8 CSV file") from None


async def row_conflicts(db, tenant_id, row, owner=None):
    errors = []
    car = await db.vehicles.find_one({"id": row.get("car_id"), "tenant_id": tenant_id}, {"_id": 0})
    if not car or normal_registration(car["registration"]) != normal_registration(row["registration"]):
        errors.append("Vehicle not found for the selected franchise")
    tracker = await db.tracker_devices.find_one({"imei": row["tracker_id"]}, {"_id": 0})
    if tracker and tracker.get("id") != row.get("device_id"):
        errors.append("Tracker ID already used")
    sim = await db.tracker_devices.find_one({"$or": [
        {"sim_iccid": row["sim_iccid"]}, {"sim_number": {"$in": [row["sim_msisdn"], "+" + row["sim_msisdn"]]}}
    ], "id": {"$ne": row.get("device_id")}}, {"_id": 0})
    if sim:
        errors.append("SIM ICCID or MSISDN already used")
    vehicle_tracker = await db.tracker_devices.find_one({
        "car_id": row.get("car_id"), "is_active": True, "id": {"$ne": row.get("device_id")}
    }, {"_id": 0}) if row.get("car_id") else None
    if vehicle_tracker:
        errors.append("Vehicle already has an active tracker")
    keys = device_keys(row["tracker_id"], row["sim_iccid"], row["sim_msisdn"], row.get("car_id"))
    if await db.tracker_setup_claims.find_one({"_id": {"$in": keys}, "owner": {"$ne": owner}}, {"_id": 0}):
        errors.append("Tracker, SIM or vehicle reserved by another setup")
    return errors


async def validate_rows(db, tenant_id, rows):
    vehicles = await db.vehicles.find({"tenant_id": tenant_id}, {"_id": 0, "id": 1, "registration": 1}).to_list(None)
    by_reg = {}
    for vehicle in vehicles:
        by_reg.setdefault(normal_registration(vehicle["registration"]), []).append(vehicle)
    counts = {key: Counter(normal_registration(r[key]) if key == "registration" else r[key]
                           for r in rows) for key in ("tracker_id", "sim_iccid", "sim_msisdn", "registration")}
    result = []
    for index, source in enumerate(rows):
        row = dict(source, id=str(index), device_id=str(uuid.uuid4()), errors=[])
        for key in FIELDS:
            if not row[key]:
                row["errors"].append(f"Missing {key}")
        for key, label in (("tracker_id", "tracker ID"), ("sim_iccid", "ICCID"),
                           ("sim_msisdn", "MSISDN"), ("registration", "vehicle registration")):
            value = normal_registration(row[key]) if key == "registration" else row[key]
            if value and counts[key][value] > 1:
                row["errors"].append(f"Duplicate {label} in CSV")
        for key, pattern, label in (("tracker_id", r"[0-9]{10,20}", "Tracker ID must be 10–20 digits"),
                                    ("sim_iccid", r"[0-9]{18,22}", "ICCID must be 18–22 digits"),
                                    ("sim_msisdn", r"[0-9]{6,15}", "MSISDN must be 6–15 digits")):
            if row[key] and not re.fullmatch(pattern, row[key]):
                row["errors"].append(label)
        matches = by_reg.get(normal_registration(row["registration"]), [])
        row["car_id"] = matches[0]["id"] if len(matches) == 1 else None
        if not matches:
            # Check only existence; never import another franchise's vehicle.
            reg_pattern = r"^[\s-]*" + r"[\s-]*".join(re.escape(c) for c in normal_registration(row["registration"])) + r"[\s-]*$"
            foreign = await db.vehicles.find_one({"registration": {"$regex": reg_pattern, "$options": "i"},
                                                  "tenant_id": {"$ne": tenant_id}}, {"_id": 0, "id": 1})
            row["errors"].append("Vehicle belongs to another franchise" if foreign else "Vehicle not found")
        elif len(matches) > 1:
            row["errors"].append("Multiple vehicles match this registration")
        if not row["errors"]:
            row["errors"].extend(await row_conflicts(db, tenant_id, row))
        row.update(status="Failed" if row["errors"] else "Ready to start", delivered=0,
                   activation={}, messages=[{"payload": command, "state": "planned", "attempts": []} for command in COMMANDS],
                   error="", autorun=False, retry_requested=False, lease_until=0)
        result.append(row)
    return result


async def create_review(db, tenant_id, content, context):
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Franchise not found")
    rows = parse_csv(content)
    batch_id = hashlib.sha256(json.dumps([tenant_id, rows], sort_keys=True).encode()).hexdigest()[:32]
    existing = await db.tracker_setup_batches.find_one({"id": batch_id}, {"_id": 0})
    if existing and existing.get("started_at"):
        return existing
    reviewed = await validate_rows(db, tenant_id, rows)
    batch = {"id": batch_id, "tenant_id": tenant_id, "tenant_name": tenant["name"],
             "created_at": now(), "created_by": context.user_id, "created_by_email": context.user_email,
             "rows": reviewed, "valid": not any(row["errors"] for row in reviewed)}
    # A second upload must not overwrite a batch that another request already started.
    await db.tracker_setup_batches.update_one({"id": batch_id}, {"$setOnInsert": batch}, upsert=True)
    if existing:
        await db.tracker_setup_batches.update_one({"id": batch_id, "started_at": {"$exists": False}},
                                                  {"$set": {"rows": reviewed, "valid": batch["valid"]}})
    return await db.tracker_setup_batches.find_one({"id": batch_id}, {"_id": 0})