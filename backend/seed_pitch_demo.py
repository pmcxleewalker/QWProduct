"""One-off seed: populate the test-fleet tenant with clean, professional
demo data for pitch-deck screenshots. Safe to re-run (idempotent wipe+seed)."""
import os
import uuid
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
c = MongoClient(os.environ["MONGO_URL"])
db = c[os.environ["DB_NAME"]]

SLUG = "test-fleet"
tenant = db.tenants.find_one({"slug": SLUG})
TID = tenant["id"]
admin = db.users.find_one({"email": "admin.test-fleet@quickwing.com"})
ADMIN_ID = admin["id"]
ADMIN_EMAIL = admin["email"]

# Give the tenant a professional display name
db.tenants.update_one({"id": TID}, {"$set": {"name": "Bluebird Care — Dublin Fleet"}})

now = datetime.now(timezone.utc)
today = now.strftime("%Y-%m-%d")


def fut(days):
    return (now + timedelta(days=days)).strftime("%Y-%m-%d")


# ---------------- Vehicles ----------------
db.vehicles.delete_many({"tenant_id": TID})

vehicles = [
    dict(name="Ford Transit Custom", registration="231-D-18420", base_location="Dublin North Depot",
         current_mileage=48210, service_due_mileage=52000, tax_due_date=fut(58), nct_due_date=fut(122),
         insurance_due_date=fut(201), inspection_frequency_days=30,
         current_location_eircode="D09 K2X6", current_location_label="Beaumont Client"),
    dict(name="Toyota Corolla Hybrid", registration="232-D-9037", base_location="Dublin North Depot",
         current_mileage=22140, service_due_mileage=30000, tax_due_date=fut(11), nct_due_date=fut(240),
         insurance_due_date=fut(88), inspection_frequency_days=30,
         current_location_eircode="D03 F5P8", current_location_label="Clontarf"),
    dict(name="Volkswagen Caddy Maxi", registration="231-D-7712", base_location="Dublin South Depot",
         current_mileage=61455, service_due_mileage=64000, tax_due_date=fut(140), nct_due_date=fut(29),
         insurance_due_date=fut(310), inspection_frequency_days=14),
    dict(name="Renault Kangoo", registration="222-D-4498", base_location="Dublin South Depot",
         current_mileage=73980, service_due_mileage=75000, tax_due_date=fut(75), nct_due_date=fut(6),
         insurance_due_date=fut(150), inspection_frequency_days=30,
         current_location_eircode="D14 Y2T0", current_location_label="Rathfarnham"),
    dict(name="Nissan Leaf", registration="232-D-1155", base_location="Dublin North Depot",
         current_mileage=15320, service_due_mileage=25000, tax_due_date=fut(190), nct_due_date=fut(300),
         insurance_due_date=fut(45), inspection_frequency_days=30),
    dict(name="Peugeot Partner", registration="221-D-8830", base_location="Dublin South Depot",
         current_mileage=88240, service_due_mileage=90000, tax_due_date=fut(33), nct_due_date=fut(95),
         insurance_due_date=fut(260), inspection_frequency_days=14),
    dict(name="Hyundai Tucson", registration="232-D-6621", base_location="Dublin West Depot",
         current_mileage=34110, service_due_mileage=40000, tax_due_date=fut(160), nct_due_date=fut(210),
         insurance_due_date=fut(120), inspection_frequency_days=30,
         current_location_eircode="D15 XW90", current_location_label="Blanchardstown"),
    dict(name="Citroën Berlingo", registration="222-D-2043", base_location="Dublin West Depot",
         current_mileage=57600, service_due_mileage=60000, tax_due_date=fut(80), nct_due_date=fut(70),
         insurance_due_date=fut(180), inspection_frequency_days=30),
]

veh_ids = []
for i, v in enumerate(vehicles):
    vid = str(uuid.uuid4())
    veh_ids.append(vid)
    blocked = (i == 7)  # last one blocked for realism
    doc = {
        "id": vid, "tenant_id": TID, "current_status": "Free",
        "is_blocked": blocked,
        "blocked_reason": "In for annual service" if blocked else None,
        "blocked_by": ADMIN_ID if blocked else None,
        "blocked_at": now.isoformat() if blocked else None,
        "created_at": now.isoformat(), "updated_at": now.isoformat(),
        **v,
    }
    db.vehicles.insert_one(doc)

# ---------------- Bookings ----------------
db.bookings.delete_many({"tenant_id": TID})

drivers = ["Aoife Byrne", "Sean Murphy", "Niamh O'Connor", "Liam Kelly",
           "Emma Doyle", "Cathal Walsh", "Grace Fitzgerald", "Darragh Nolan"]
purposes = [
    ("School run — Marino", "Marino School"),
    ("Client visit — Mrs. O'Brien", "Beaumont"),
    ("Medical appointment", "Mater Hospital"),
    ("Grocery collection", "Fairview SuperValu"),
    ("Day-centre transfer", "Northside Day Centre"),
    ("Airport transfer", "Dublin Airport T1"),
    ("Physio appointment", "Clontarf Clinic"),
    ("Home care visit", "Raheny"),
]


def mk_booking(car_idx, start_dt, end_dt, driver, purpose, location, status="approved"):
    return {
        "id": str(uuid.uuid4()), "tenant_id": TID, "car_id": veh_ids[car_idx],
        "user_name": driver, "start_time": start_dt, "end_time": end_dt,
        "purpose": purpose, "location": location, "notes": "",
        "is_double_up_call": False, "status": status,
        "created_by_email": ADMIN_EMAIL, "created_by_user_id": ADMIN_ID,
        "created_at": now.isoformat(),
    }


# Today's bookings across the timeline (local naive YYYY-MM-DDTHH:mm)
today_slots = [
    (0, "08:00", "10:30"), (0, "13:00", "15:00"),
    (1, "09:00", "12:00"), (1, "16:00", "18:30"),
    (2, "07:30", "09:30"),
    (3, "10:00", "13:00"), (3, "15:30", "17:00"),
    (4, "08:30", "11:00"), (4, "14:00", "16:30"),
    (5, "11:00", "14:30"),
    (6, "09:30", "11:30"), (6, "13:30", "16:00"), (6, "18:00", "20:00"),
]
for i, (ci, s, e) in enumerate(today_slots):
    d = drivers[i % len(drivers)]
    p, loc = purposes[i % len(purposes)]
    db.bookings.insert_one(mk_booking(ci, f"{today}T{s}", f"{today}T{e}", d, p, loc))

# A couple of pending bookings (so approvals + reports show real numbers)
db.bookings.insert_one(mk_booking(2, f"{today}T16:00", f"{today}T18:00",
                                  "Emma Doyle", "Evening client visit", "Rathmines", status="pending"))
db.bookings.insert_one(mk_booking(5, f"{fut(1)}T09:00", f"{fut(1)}T11:00",
                                  "Liam Kelly", "Hospital discharge", "St. Vincent's", status="pending"))

# Historical bookings over the last 30 days for reports / most-booked ranking
import random
random.seed(7)
for day in range(1, 31):
    dt = now - timedelta(days=day)
    ds = dt.strftime("%Y-%m-%d")
    n = random.randint(3, 7)
    for _ in range(n):
        ci = random.randint(0, 6)
        sh = random.randint(7, 17)
        dur = random.randint(1, 3)
        d = random.choice(drivers)
        p, loc = random.choice(purposes)
        b = mk_booking(ci, f"{ds}T{sh:02d}:00", f"{ds}T{sh+dur:02d}:00", d, p, loc)
        b["created_at"] = dt.isoformat()
        db.bookings.insert_one(b)

vcount = db.vehicles.count_documents({"tenant_id": TID})
bcount = db.bookings.count_documents({"tenant_id": TID})
print(f"Seeded {vcount} vehicles and {bcount} bookings for {SLUG}")
