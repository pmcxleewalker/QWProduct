"""
Driver Behaviour Service (Phase 6)
===================================

Detects and records driving events for admin review — NOT a scoring system.
Events are appended to the `driver_behaviour_events` collection and later
surfaced on the /behaviour dashboard.

Event types
-----------
- speeding            : point speed exceeds tenant speed_limit_kmh
- harsh_braking       : speed drops >=15 km/h between polls AND prev speed >10 km/h
- harsh_acceleration  : speed rises >=20 km/h between polls
- disconnection       : tracker offline >=10 min OR voltage drop >10 V -> <5 V

Every write is scoped by tenant_id. Each event is linked to the staff
member who had an active booking for that car at that timestamp — falls
back to "Unbooked" when no booking overlaps.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

# Detection thresholds
HARSH_BRAKING_DROP_KMH = 15
HARSH_BRAKING_MIN_PREV_KMH = 10
HARSH_ACCEL_RISE_KMH = 20

VALID_EVENT_TYPES = {"speeding", "harsh_braking", "harsh_acceleration", "disconnection"}


async def _find_active_booking(db, tenant_id: str, car_id: str, ts_iso: str):
    """Return {user_name, user_id, booking_id} for the booking whose
    [start_time, end_time] window contains `ts_iso`. Timestamps are ISO
    strings in this app so lexicographic compare works.

    Returns None when no booking is active at that moment.
    """
    booking = await db.bookings.find_one(
        {
            "tenant_id": tenant_id,
            "car_id": car_id,
            "start_time": {"$lte": ts_iso},
            "end_time": {"$gte": ts_iso},
        },
        {"_id": 0, "id": 1, "user_name": 1, "assigned_to_user_id": 1, "created_by_user_id": 1},
    )
    if not booking:
        return None
    return {
        "booking_id": booking.get("id"),
        "staff_id": booking.get("assigned_to_user_id") or booking.get("created_by_user_id"),
        "staff_name": booking.get("user_name") or "Unknown",
    }


async def log_event(
    db,
    tenant_id: str,
    car: dict,
    event_type: str,
    timestamp_iso: str,
    details: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    extra: Optional[dict] = None,
):
    """Insert a driver_behaviour_events row. Booking linkage is resolved
    at insert time so the staff member snapshot never drifts if bookings
    are later edited/deleted."""
    if event_type not in VALID_EVENT_TYPES:
        return  # silently ignore — never crash the poller

    booking = await _find_active_booking(db, tenant_id, car.get("id"), timestamp_iso)

    doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "car_id": car.get("id"),
        "car_name": car.get("name"),
        "registration": car.get("registration"),
        "type": event_type,
        "timestamp": timestamp_iso,
        "lat": lat,
        "lon": lon,
        "details": details,
        "booking_id": booking["booking_id"] if booking else None,
        "staff_id": booking["staff_id"] if booking else None,
        "staff_name": booking["staff_name"] if booking else "Unbooked",
        "created_at": datetime.now(timezone.utc).isoformat(),
        **(extra or {}),
    }
    await db.driver_behaviour_events.insert_one(doc)


async def detect_speeding(db, tenant_id, car, speed, limit, timestamp, lat, lon):
    if not limit or speed <= limit:
        return
    over_by = speed - limit
    await log_event(
        db, tenant_id, car,
        event_type="speeding",
        timestamp_iso=timestamp,
        details=f"{speed} km/h ({over_by} km/h over the {limit} km/h limit)",
        lat=lat, lon=lon,
        extra={"speed": speed, "limit": limit, "over_by": over_by},
    )


async def detect_harsh_braking(db, tenant_id, car, prev_speed, new_speed, timestamp, lat, lon):
    if prev_speed <= HARSH_BRAKING_MIN_PREV_KMH:
        return
    drop = prev_speed - new_speed
    if drop < HARSH_BRAKING_DROP_KMH:
        return
    await log_event(
        db, tenant_id, car,
        event_type="harsh_braking",
        timestamp_iso=timestamp,
        details=f"Braked from {prev_speed} km/h to {new_speed} km/h (-{drop} km/h)",
        lat=lat, lon=lon,
        extra={"prev_speed": prev_speed, "new_speed": new_speed, "delta": -drop},
    )


async def detect_harsh_acceleration(db, tenant_id, car, prev_speed, new_speed, timestamp, lat, lon):
    rise = new_speed - prev_speed
    if rise < HARSH_ACCEL_RISE_KMH:
        return
    await log_event(
        db, tenant_id, car,
        event_type="harsh_acceleration",
        timestamp_iso=timestamp,
        details=f"Accelerated from {prev_speed} km/h to {new_speed} km/h (+{rise} km/h)",
        lat=lat, lon=lon,
        extra={"prev_speed": prev_speed, "new_speed": new_speed, "delta": rise},
    )


async def detect_disconnection(db, tenant_id, car, reason: str, timestamp, lat=None, lon=None, extra=None):
    """Called when the poller sees an unplug (voltage drop) or a tracker
    going offline for the first time (>=10 min silent)."""
    await log_event(
        db, tenant_id, car,
        event_type="disconnection",
        timestamp_iso=timestamp,
        details=reason,
        lat=lat, lon=lon,
        extra=extra or {},
    )
