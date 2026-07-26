"""Idempotent-ish seed for Phase 5 test alerts.

Creates 5 open (unacknowledged) tracker_alerts for the Test Fleet tenant:
  - speeding (critical) — Ford Focus
  - speeding (warning)  — Hyundai i30
  - unplug   (critical) — Ford Focus
  - offline  (warning)  — Hyundai i30
  - geofence_exit (warning) — Ford Focus

Safe to re-run — deletes existing open alerts for these fingerprints first.
Run: `cd /app/backend && python -m tests.seed_phase5_alerts`
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

TENANT_ID = "f95fbe53-46cc-4f29-af6b-b9ea51758cbd"
FORD_FOCUS = "2f028b73-b82e-427e-992c-ccc99857e52d"
HYUNDAI_I30 = "39faf6ff-0e95-4be8-a24b-30b2b433cb4c"


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


ALERTS = [
    {"type": "speeding", "severity": "critical", "car_id": FORD_FOCUS,
     "message": "Speed 158 km/h exceeds limit 120 km/h"},
    {"type": "speeding", "severity": "warning",  "car_id": HYUNDAI_I30,
     "message": "Speed 133 km/h exceeds limit 120 km/h"},
    {"type": "unplug",   "severity": "critical", "car_id": FORD_FOCUS,
     "message": "Tracker unplugged (voltage 12.6 V \u2192 3.2 V)"},
    {"type": "offline",  "severity": "warning",  "car_id": HYUNDAI_I30,
     "message": "Tracker offline for 15 min"},
    {"type": "geofence_exit", "severity": "warning", "car_id": FORD_FOCUS,
     "message": "Left base \u2014 61.3 km from centre (radius 50 km)"},
]


async def seed():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Wipe existing OPEN alerts for the tenant to keep counts deterministic.
    await db.tracker_alerts.delete_many({
        "tenant_id": TENANT_ID,
        "acknowledged": False,
    })

    docs = []
    for a in ALERTS:
        docs.append({
            "id": str(uuid.uuid4()),
            "tenant_id": TENANT_ID,
            "car_id": a["car_id"],
            "type": a["type"],
            "severity": a["severity"],
            "message": a["message"],
            "timestamp": _now_iso(),
            "acknowledged": False,
        })
    await db.tracker_alerts.insert_many(docs)
    print(f"Seeded {len(docs)} alerts for tenant {TENANT_ID}")


if __name__ == "__main__":
    asyncio.run(seed())
