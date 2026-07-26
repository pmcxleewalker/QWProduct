"""
GPS History Service — trip grouping + demo backfill
====================================================

Two responsibilities:

1. `get_car_journeys(db, tenant_id, car_id, ymd)` — read tenant-scoped
   history for a specific day, filter out stationary GPS noise, and group
   points into trips (gap > 3 min between fixes = new trip). Returns a
   list of trip dicts each with:
       {
         "id":          str,
         "start_time":  ISO,
         "end_time":    ISO,
         "duration_min": float,
         "max_speed":   int,
         "avg_speed":   float,
         "point_count": int,
         "points": [ {timestamp, lat, lon, speed, direction, voltage}, ... ],
       }
   Trips whose max_speed is 0 (i.e. pure noise) are dropped.

2. `seed_demo_journeys(db, tenant_id, tracker_device, days=3)` — generate
   realistic multi-trip days for a demo tracker so the Journey Playback UI
   looks convincing during development. Idempotent — refuses to backfill a
   date that already has >20 rows for the given device.

Every read + write goes through `tenant_id + car_id` — no cross-tenant
leakage. See /app/memory/SINOTRACK_MULTI_TENANT_PROMPT.md.
"""
from __future__ import annotations

import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from services.gps_demo_simulator import CITY_LOOPS, _pick_loop, _haversine_km, _bearing

TRIP_GAP_MINUTES = 3  # gap > this = new trip
MIN_MAX_SPEED = 1     # drop trips whose max_speed is 0 (stationary noise)


def _parse_iso(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        # tracker_history stores `datetime.now(timezone.utc).isoformat()`
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _summarise_trip(points: list) -> dict:
    speeds = [int(p.get("speed") or 0) for p in points]
    max_speed = max(speeds) if speeds else 0
    avg_speed = round(sum(speeds) / len(speeds), 1) if speeds else 0.0
    start_dt = _parse_iso(points[0]["timestamp"])
    end_dt = _parse_iso(points[-1]["timestamp"])
    duration_min = 0.0
    if start_dt and end_dt:
        duration_min = round((end_dt - start_dt).total_seconds() / 60.0, 1)
    return {
        "id": str(uuid.uuid4()),
        "start_time": points[0]["timestamp"],
        "end_time": points[-1]["timestamp"],
        "duration_min": duration_min,
        "max_speed": max_speed,
        "avg_speed": avg_speed,
        "point_count": len(points),
        "points": points,
    }


async def get_car_journeys(db, tenant_id: str, car_id: str, ymd: str) -> list:
    """Return the list of trips for a single car on a single day.

    `ymd` is YYYY-MM-DD in UTC. History points are queried with a UTC day
    window against the ISO `timestamp` field.
    """
    try:
        day = datetime.strptime(ymd, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return []

    day_start = day.isoformat()
    day_end = (day + timedelta(days=1)).isoformat()

    rows = await db.tracker_history.find(
        {
            "tenant_id": tenant_id,
            "car_id": car_id,
            "timestamp": {"$gte": day_start, "$lt": day_end},
        },
        {"_id": 0},
    ).sort("timestamp", 1).to_list(20000)

    if not rows:
        return []

    trips: list = []
    current: list = []
    last_dt: Optional[datetime] = None
    gap = timedelta(minutes=TRIP_GAP_MINUTES)

    for r in rows:
        dt = _parse_iso(r.get("timestamp"))
        if dt is None:
            continue
        point = {
            "timestamp": r["timestamp"],
            "lat": r.get("lat"),
            "lon": r.get("lon"),
            "speed": int(r.get("speed") or 0),
            "direction": int(r.get("direction") or 0),
            "voltage": r.get("voltage"),
        }
        if last_dt is None or (dt - last_dt) <= gap:
            current.append(point)
        else:
            if current:
                trips.append(current)
            current = [point]
        last_dt = dt

    if current:
        trips.append(current)

    # Summarise + drop trips whose max_speed is 0 (pure noise from old
    # always-record data). We still keep the transitional stop point at
    # the end of a real trip because it has a moving point preceding it.
    summaries = [_summarise_trip(t) for t in trips if len(t) >= 2]
    summaries = [t for t in summaries if t["max_speed"] >= MIN_MAX_SPEED]
    return summaries


# =========================================================================
# Demo history backfill
# =========================================================================

def _bearing_between(a, b) -> int:
    return _bearing(a, b)


def _build_demo_trip_points(
    imei: str,
    car_id: str,
    tenant_id: str,
    tracker_id: str,
    trip_start: datetime,
    duration_minutes: int,
    loop: list,
    start_wp_ix: int,
) -> list:
    """Simulate a single realistic trip along the assigned city loop.
    Emits ~one point every 30 s (matches the live poller cadence)."""
    points = []
    tick_seconds = 30
    total_ticks = max(2, int((duration_minutes * 60) / tick_seconds))

    wp_ix = start_wp_ix
    progress = 0.0
    n = len(loop)
    mileage_start = 20000 + (abs(hash((imei, trip_start.strftime("%Y%m%d")))) % 90000)
    mileage = mileage_start

    # 24h wall-clock affects nothing — we're building historical rows
    for tick in range(total_ticks):
        current_wp = loop[wp_ix]
        next_wp = loop[(wp_ix + 1) % n]

        # Speed profile: ramp up first ~2 ticks, cruise, brake final 2 ticks
        if tick < 2:
            speed_kmh = 15 + tick * 10
        elif tick > total_ticks - 3:
            speed_kmh = max(5, 45 - (tick - (total_ticks - 3)) * 15)
        else:
            base = 30 + (abs(hash((imei, tick))) % 30)
            # Occasional slow-down for corner
            if progress > 0.85:
                base = max(15, base - 12)
            speed_kmh = base

        step_km = speed_kmh * (tick_seconds / 3600.0)
        seg_km = max(0.05, _haversine_km(current_wp, next_wp))
        progress += step_km / seg_km
        while progress >= 1.0:
            progress -= 1.0
            wp_ix = (wp_ix + 1) % n
            current_wp = loop[wp_ix]
            next_wp = loop[(wp_ix + 1) % n]
            seg_km = max(0.05, _haversine_km(current_wp, next_wp))

        lat = current_wp[0] + (next_wp[0] - current_wp[0]) * progress
        lon = current_wp[1] + (next_wp[1] - current_wp[1]) * progress
        mileage += step_km

        ts = (trip_start + timedelta(seconds=tick * tick_seconds)).isoformat()

        points.append({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "tracker_id": tracker_id,
            "car_id": car_id,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "speed": int(speed_kmh),
            "direction": _bearing(current_wp, next_wp),
            "voltage": 12.6,
            "ignition": True,
            "timestamp": ts,
        })

    # Append one final "stop" point so the trip has a clean end marker
    last = points[-1]
    stop_ts = (trip_start + timedelta(seconds=total_ticks * tick_seconds)).isoformat()
    points.append({
        **last,
        "id": str(uuid.uuid4()),
        "speed": 0,
        "voltage": 12.4,
        "ignition": False,
        "timestamp": stop_ts,
    })

    return points, wp_ix


async def seed_demo_journeys(
    db,
    tenant_id: str,
    tracker_device: dict,
    days: int = 3,
) -> int:
    """Backfill `days` of historical journeys for a demo tracker so the
    Journey Playback UI has convincing data to render.

    Returns the total number of rows inserted. Idempotent — for each day
    checks the existing history row count and skips if there are already
    more than 20 rows for that (car_id, date) window.
    """
    imei = tracker_device.get("imei", "")
    car_id = tracker_device.get("car_id")
    tracker_id = tracker_device.get("id")
    if not (imei and car_id and tracker_id):
        return 0

    loop = _pick_loop(imei)
    n = len(loop)
    wp_ix = abs(hash(imei)) % n
    rand = random.Random(hash((tenant_id, car_id)))

    inserted_total = 0
    now = datetime.now(timezone.utc)

    for day_offset in range(days):
        day = (now - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
        ymd = day.strftime("%Y-%m-%d")

        # Idempotency: skip if we already have solid data for this day
        existing = await db.tracker_history.count_documents({
            "tenant_id": tenant_id,
            "car_id": car_id,
            "timestamp": {
                "$gte": day.isoformat(),
                "$lt": (day + timedelta(days=1)).isoformat(),
            },
        })
        if existing > 20:
            continue

        # Build 3-5 trips scattered through the day
        trip_count = rand.randint(3, 5)
        # Time-of-day slots (avoid overlap)
        candidate_starts = [8, 10, 12, 14, 16, 18]
        rand.shuffle(candidate_starts)
        start_hours = sorted(candidate_starts[:trip_count])

        rows: list = []
        for hour in start_hours:
            minute = rand.randint(0, 45)
            trip_start = day.replace(hour=hour, minute=minute)
            duration_min = rand.randint(8, 25)
            points, wp_ix = _build_demo_trip_points(
                imei=imei,
                car_id=car_id,
                tenant_id=tenant_id,
                tracker_id=tracker_id,
                trip_start=trip_start,
                duration_minutes=duration_min,
                loop=loop,
                start_wp_ix=wp_ix,
            )
            rows.extend(points)

        if rows:
            await db.tracker_history.insert_many(rows)
            inserted_total += len(rows)

    return inserted_total
