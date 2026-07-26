"""
GPS Poller — SinoTrack Bridge (Phase 2)
========================================

APScheduler-driven background loop that pulls positions from SinoTrack's
cloud for every tenant with `gps_enabled: true` and writes them into
tenant-scoped collections. See /app/memory/SINOTRACK_MULTI_TENANT_PROMPT.md.

Behaviour matches the spec:
    - `tracker_positions`  : upserted per (tenant_id, car_id) with the latest fix
    - `tracker_history`    : appended ONLY when speed > 0, OR one final "stop"
                             point when transitioning moving → stopped
    - `tracker_alerts`     : written when speed exceeds tenant's speed_limit_kmh,
                             or when voltage drops from >10 V to <5 V (unplug)
    - Offline detection    : if fetch returns None but previous status was
                             "online", flip status to "offline" in the current
                             position row

Every DB write MUST include `tenant_id` — no cross-tenant leakage allowed.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.sinotrack_client import fetch_position

logger = logging.getLogger(__name__)

# APScheduler ticks the master job every 30 s. Per-tenant poll_interval is
# read but is currently used only as an informational hint to the poller;
# for simplicity all tenants share the master 30 s cadence.
MASTER_TICK_SECONDS = 30

_scheduler: Optional[AsyncIOScheduler] = None
_db = None  # motor db, injected via start()


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _process_device(tenant: dict, device: dict, speed_limit: int, device_password: str):
    """Fetch one device's position and update all downstream collections."""
    tenant_id = tenant["id"]
    imei = device.get("imei")
    car_id = device.get("car_id")
    if not imei or not car_id:
        return

    # Blocking network call — run in a thread so we don't stall the event loop.
    position = await asyncio.to_thread(fetch_position, imei, device_password)

    # Previous position (used for movement + voltage delta detection)
    prev = await _db.tracker_positions.find_one(
        {"tenant_id": tenant_id, "car_id": car_id}, {"_id": 0}
    )

    if not position:
        # No fix / API error — mark as offline if we previously had one
        if prev and prev.get("status") == "online":
            await _db.tracker_positions.update_one(
                {"tenant_id": tenant_id, "car_id": car_id},
                {"$set": {"status": "offline", "last_update": _iso_now()}},
            )
        return

    speed = int(position.get("speed") or 0)
    voltage = position.get("voltage")
    ignition = speed > 0 or (voltage is not None and voltage > 13.0)
    status = "online"

    now_iso = _iso_now()
    pos_doc = {
        "tenant_id": tenant_id,
        "car_id": car_id,
        "tracker_id": device["id"],
        "imei": imei,
        "lat": position["latitude"],
        "lon": position["longitude"],
        "speed": speed,
        "direction": position.get("direction", 0),
        "gps_signal": position.get("gps_signal", 0),
        "gsm_signal": position.get("gsm_signal", 0),
        "mileage": position.get("mileage", 0),
        "voltage": voltage,
        "ignition": ignition,
        "status": status,
        "device_timestamp": position.get("timestamp"),
        "last_update": now_iso,
    }
    await _db.tracker_positions.update_one(
        {"tenant_id": tenant_id, "car_id": car_id},
        {"$set": pos_doc},
        upsert=True,
    )

    # ---- Journey history (moving-only, plus one transitional stop) ----
    prev_speed = int((prev or {}).get("speed") or 0)
    should_record = speed > 0 or (prev_speed > 0 and speed == 0)
    if should_record:
        await _db.tracker_history.insert_one({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "tracker_id": device["id"],
            "car_id": car_id,
            "lat": pos_doc["lat"],
            "lon": pos_doc["lon"],
            "speed": speed,
            "direction": pos_doc["direction"],
            "voltage": voltage,
            "ignition": ignition,
            "timestamp": now_iso,
        })

    # ---- Speed alert ----
    if speed_limit and speed > speed_limit:
        await _db.tracker_alerts.insert_one({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "tracker_id": device["id"],
            "car_id": car_id,
            "type": "speeding",
            "speed": speed,
            "limit": speed_limit,
            "lat": pos_doc["lat"],
            "lon": pos_doc["lon"],
            "timestamp": now_iso,
            "acknowledged": False,
        })

    # ---- Unplug detection (voltage drop) ----
    prev_voltage = (prev or {}).get("voltage")
    if (
        voltage is not None
        and prev_voltage is not None
        and prev_voltage > 10.0
        and voltage < 5.0
    ):
        await _db.tracker_alerts.insert_one({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "tracker_id": device["id"],
            "car_id": car_id,
            "type": "unplug",
            "voltage": voltage,
            "prev_voltage": prev_voltage,
            "lat": pos_doc["lat"],
            "lon": pos_doc["lon"],
            "timestamp": now_iso,
            "acknowledged": False,
        })


async def _sync_tenant(tenant: dict):
    """Sync all active trackers for a single tenant. Fully isolated — the
    only cross-tenant safety guarantee is that every query below includes
    `tenant_id`."""
    tenant_id = tenant["id"]
    gs = tenant.get("gps_settings") or {}
    speed_limit = int(gs.get("speed_limit_kmh") or 120)
    device_password = gs.get("device_password") or "123456"

    devices = await _db.tracker_devices.find(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0},
    ).to_list(500)

    if not devices:
        return

    for device in devices:
        try:
            await _process_device(tenant, device, speed_limit, device_password)
        except Exception as e:
            logger.warning(f"[gps-poller] device {device.get('imei')} in tenant {tenant_id}: {e}")


async def sinotrack_bridge_job():
    """Master polling loop. Runs every MASTER_TICK_SECONDS."""
    try:
        tenants = await _db.tenants.find(
            {"gps_enabled": True},
            {"_id": 0},
        ).to_list(500)
    except Exception as e:
        logger.error(f"[gps-poller] failed to list gps-enabled tenants: {e}")
        return

    if not tenants:
        return

    logger.debug(f"[gps-poller] tick — syncing {len(tenants)} tenant(s)")
    for tenant in tenants:
        try:
            await _sync_tenant(tenant)
        except Exception as e:
            logger.error(f"[gps-poller] tenant {tenant.get('id')}: {e}")


def start(db):
    """Attach the scheduler to the running event loop. Idempotent."""
    global _scheduler, _db
    if _scheduler is not None:
        return _scheduler
    _db = db
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        sinotrack_bridge_job,
        trigger=IntervalTrigger(seconds=MASTER_TICK_SECONDS),
        id="sinotrack_bridge_master",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(f"[gps-poller] SinoTrack bridge started, tick={MASTER_TICK_SECONDS}s")
    return _scheduler


def stop():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("[gps-poller] stopped")
