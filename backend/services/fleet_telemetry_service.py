"""
Fleet Telemetry Service (Phase 6)
==================================

Aggregates live telemetry for every tracked car in a tenant into a single
compact payload. The FleetBoard renders one card per car and re-polls
every 30 s.

Also provides a lazy reverse-geocode helper that hits OpenStreetMap
Nominatim on cache miss, storing results in the `geocode_cache` collection
keyed by lat/lon rounded to 4 decimal places (~11 m). Nominatim's
free-tier policy caps us at 1 req/sec — respected via httpx timeout and
a courteous User-Agent header.
"""
from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_HEADERS = {
    "User-Agent": "QuickWing-FleetTracker/1.0 (support@quickwing.com)",
    "Accept-Language": "en",
}

# Consider a car "Live" if we heard from it in the last 5 min, "Idle" if
# 5-60 min, "Offline" past 60 min. Mirrors the badge in the UI.
LIVE_MAX_MIN = 5
IDLE_MAX_MIN = 60


def _round_key(lat: float, lon: float) -> str:
    """~11 m precision to keep the cache from exploding in-place."""
    return f"{round(float(lat), 4)},{round(float(lon), 4)}"


def _connection_status(minutes_since: Optional[float]) -> str:
    if minutes_since is None:
        return "offline"
    if minutes_since <= LIVE_MAX_MIN:
        return "live"
    if minutes_since <= IDLE_MAX_MIN:
        return "idle"
    return "offline"


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


async def _mileage_today(db, tenant_id: str, car_id: str, day_start_iso: str) -> float:
    """Sum haversine distance between consecutive history points from
    `day_start_iso` onward. Rough but fine for the fleet card summary."""
    points = await db.tracker_history.find(
        {
            "tenant_id": tenant_id,
            "car_id": car_id,
            "timestamp": {"$gte": day_start_iso},
        },
        {"_id": 0, "lat": 1, "lon": 1, "timestamp": 1},
    ).sort("timestamp", 1).to_list(5000)

    if len(points) < 2:
        return 0.0
    total = 0.0
    for a, b in zip(points, points[1:]):
        total += _haversine_km(a["lat"], a["lon"], b["lat"], b["lon"])
    return round(total, 2)


async def _cached_address(db, lat: float, lon: float) -> Optional[str]:
    key = _round_key(lat, lon)
    row = await db.geocode_cache.find_one({"key": key}, {"_id": 0, "address": 1})
    return row.get("address") if row else None


async def _fetch_nominatim(lat: float, lon: float) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(
                NOMINATIM_URL,
                params={"lat": lat, "lon": lon, "format": "json", "zoom": 16},
                headers=NOMINATIM_HEADERS,
            )
            if res.status_code == 200:
                data = res.json()
                return data.get("display_name")
    except Exception as e:
        logger.warning(f"[nominatim] {e}")
    return None


async def resolve_address(db, lat: float, lon: float) -> Optional[str]:
    """Return the cached address, or fetch from Nominatim and cache. Safe
    to call inline — bounded by the 6 s httpx timeout."""
    cached = await _cached_address(db, lat, lon)
    if cached:
        return cached
    addr = await _fetch_nominatim(lat, lon)
    if addr:
        await db.geocode_cache.update_one(
            {"key": _round_key(lat, lon)},
            {"$set": {
                "key": _round_key(lat, lon),
                "lat": lat, "lon": lon,
                "address": addr,
                "cached_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    return addr


async def build_telemetry(db, tenant_id: str) -> list:
    """Return the telemetry payload used by the /alerts nav badge + the
    FleetBoard cards. One entry per tracked car (has an active tracker
    device row)."""
    # Active trackers for this tenant
    devices = await db.tracker_devices.find(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0},
    ).to_list(500)
    if not devices:
        return []
    car_ids = [d["car_id"] for d in devices if d.get("car_id")]
    if not car_ids:
        return []

    cars = await db.vehicles.find(
        {"tenant_id": tenant_id, "id": {"$in": car_ids}},
        {"_id": 0, "id": 1, "name": 1, "registration": 1},
    ).to_list(500)
    car_by_id = {c["id"]: c for c in cars}

    positions = await db.tracker_positions.find(
        {"tenant_id": tenant_id, "car_id": {"$in": car_ids}},
        {"_id": 0},
    ).to_list(500)
    pos_by_car = {p["car_id"]: p for p in positions}

    day_start_iso = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    now_utc = datetime.now(timezone.utc)

    rows: list = []
    for d in devices:
        car_id = d.get("car_id")
        if not car_id:
            continue
        car = car_by_id.get(car_id) or {}
        pos = pos_by_car.get(car_id)

        # Freshness → connection badge
        last_update_iso = pos.get("last_update") if pos else None
        minutes_since: Optional[float] = None
        if last_update_iso:
            try:
                last_dt = datetime.fromisoformat(last_update_iso.replace("Z", "+00:00"))
                minutes_since = (now_utc - last_dt).total_seconds() / 60.0
            except ValueError:
                minutes_since = None
        status = _connection_status(minutes_since)

        mileage_today = await _mileage_today(db, tenant_id, car_id, day_start_iso)

        # Cache-only address (fast path). The dedicated geocode endpoint
        # can fetch + cache lazily so the telemetry request stays snappy.
        address = None
        if pos and pos.get("lat") is not None and pos.get("lon") is not None:
            address = await _cached_address(db, pos["lat"], pos["lon"])

        rows.append({
            "car_id": car_id,
            "car_name": car.get("name"),
            "registration": car.get("registration"),
            "tracker_id": d.get("id"),
            "is_demo": bool(d.get("is_demo")),
            "connection_status": status,  # 'live' | 'idle' | 'offline'
            "minutes_since_update": (
                round(minutes_since, 1) if minutes_since is not None else None
            ),
            "last_update": last_update_iso,
            "position": (
                {
                    "lat": pos["lat"],
                    "lon": pos["lon"],
                    "speed": int(pos.get("speed") or 0),
                    "direction": int(pos.get("direction") or 0),
                    "voltage": pos.get("voltage"),
                    "ignition": bool(pos.get("ignition")),
                    "gps_signal": int(pos.get("gps_signal") or 0),
                    "gsm_signal": int(pos.get("gsm_signal") or 0),
                    "mileage": pos.get("mileage"),
                }
                if pos
                else None
            ),
            "mileage_today_km": mileage_today,
            "address": address,
        })

    # Sort: live first, then idle, then offline
    rank = {"live": 0, "idle": 1, "offline": 2}
    rows.sort(key=lambda r: (rank.get(r["connection_status"], 9), r.get("car_name") or ""))
    return rows
