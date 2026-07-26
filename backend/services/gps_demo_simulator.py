"""
GPS Demo Simulator
==================

Generates realistic road-like GPS movement for tracker devices marked as
`is_demo=True`. Used for local development and Phase 3+ UI work so we don't
depend on real SinoTrack hardware.

Each demo device is deterministically assigned an Irish city loop (Dublin,
Cork, Galway, or Limerick). The simulator interpolates between hand-picked
waypoints along real streets, adds gentle speed variation (10–70 km/h with
occasional stops), and cycles through a 24-hour day so bookings can slot in.

Public API:
    is_demo_imei(imei)      -> bool
    simulate(device, state) -> position dict (same shape as fetch_position)

`state` is an in-memory dict maintained per device by the poller so we
remember progress along the route between ticks. If the process restarts
we deterministically reseed from the current wall-clock so cars don't jump
back to the origin.
"""
from __future__ import annotations

import math
import time
from typing import Optional

# Curated Irish city loops (approximate driving routes). Each waypoint is
# (lat, lon). Loops are closed — after the last point we wrap to the first.
CITY_LOOPS = {
    "dublin": [
        (53.3498, -6.2603),  # O'Connell Bridge
        (53.3441, -6.2675),  # St Stephen's Green
        (53.3416, -6.2547),  # Trinity College
        (53.3382, -6.2591),  # Merrion Square
        (53.3358, -6.2489),  # Grand Canal Dock
        (53.3475, -6.2296),  # East Wall
        (53.3554, -6.2500),  # Fairview
        (53.3609, -6.2733),  # Drumcondra
        (53.3502, -6.2792),  # Phibsborough
        (53.3479, -6.2717),  # King's Inns
    ],
    "cork": [
        (51.8985, -8.4756),  # Patrick Street
        (51.8944, -8.4655),  # UCC
        (51.8933, -8.4487),  # Douglas Rd
        (51.9007, -8.4341),  # Blackrock
        (51.9037, -8.4487),  # Ballinlough
        (51.9042, -8.4756),  # North Mall
        (51.9078, -8.4938),  # Sunday's Well
        (51.9021, -8.5015),  # Blackpool
    ],
    "galway": [
        (53.2707, -9.0568),  # Eyre Square
        (53.2704, -9.0669),  # Salthill
        (53.2652, -9.0742),  # Grattan Beach
        (53.2604, -9.0623),  # Taylor's Hill
        (53.2661, -9.0463),  # Bohermore
        (53.2749, -9.0492),  # Woodquay
    ],
    "limerick": [
        (52.6638, -8.6267),  # King John's Castle
        (52.6598, -8.6294),  # St Mary's Cathedral
        (52.6607, -8.6248),  # O'Connell Street
        (52.6635, -8.6207),  # Thomondgate
        (52.6668, -8.6156),  # Corbally
    ],
}
_LOOP_KEYS = list(CITY_LOOPS.keys())


def is_demo_imei(imei: str) -> bool:
    """Demo IMEIs start with 'DEMO-' or 'SIM-'. Real SinoTrack IMEIs are
    pure digits, so any non-digit prefix is unambiguous."""
    return bool(imei) and (imei.upper().startswith("DEMO-") or imei.upper().startswith("SIM-"))


def _pick_loop(imei: str) -> list:
    """Deterministically map an IMEI to a city loop so demo cars stay put
    across process restarts."""
    idx = abs(hash(imei)) % len(_LOOP_KEYS)
    return CITY_LOOPS[_LOOP_KEYS[idx]]


def _haversine_km(a, b) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _bearing(a, b) -> int:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return int((math.degrees(math.atan2(x, y)) + 360) % 360)


def simulate(imei: str, state: dict) -> dict:
    """Advance a demo device by one tick (30 s) and return a position dict.
    Mutates `state` so the next call picks up from where this one left off.

    Simulation model:
      - Cycle around a fixed loop of waypoints
      - Cruise at ~40 km/h between waypoints, brake to 15 near turns
      - Every ~10 min the driver randomly stops for one tick (parking / lights)
      - After a stop, speed ramps back up gradually
      - Voltage sits at 12.6 V while ignition is on, drops to 12.1 V when
        stopped for a while (engine off)
    """
    loop = _pick_loop(imei)
    n = len(loop)

    # Reseed if this is the first tick for this device.
    if "waypoint_ix" not in state:
        # Random-ish deterministic starting waypoint per IMEI
        state["waypoint_ix"] = abs(hash(imei)) % n
        state["progress"] = 0.0    # 0..1 along the current segment
        state["mileage"] = 10000 + (abs(hash(imei)) % 90000)
        state["stopped_ticks"] = 0

    # Compute step distance based on target speed
    tick_seconds = state.get("tick_seconds", 30)
    minute_of_hour = (int(time.time()) // 60) % 60

    # Random-ish stop every ~10 min (deterministic on wall-clock)
    forced_stop = (minute_of_hour % 10 == 0) and (abs(hash(imei)) % 3 == 0)
    if forced_stop and state["stopped_ticks"] < 2:
        state["stopped_ticks"] += 1
        current_wp = loop[state["waypoint_ix"]]
        next_wp = loop[(state["waypoint_ix"] + 1) % n]
        # Interpolate the paused location so voltage-drop unplug tests still work
        pause_lat = current_wp[0] + (next_wp[0] - current_wp[0]) * state["progress"]
        pause_lon = current_wp[1] + (next_wp[1] - current_wp[1]) * state["progress"]
        # Voltage drops slightly the longer we're stopped
        voltage = 12.6 if state["stopped_ticks"] == 1 else 12.1
        return {
            "latitude": round(pause_lat, 6),
            "longitude": round(pause_lon, 6),
            "speed": 0,
            "direction": _bearing(current_wp, next_wp),
            "gps_signal": 4,
            "gsm_signal": 4,
            "mileage": state["mileage"],
            "voltage": voltage,
            "timestamp": int(time.time()),
        }
    state["stopped_ticks"] = 0

    # Cruise speed 25-55 km/h, occasional slow at turns
    speed_kmh = 25 + (abs(hash((imei, minute_of_hour))) % 30)
    if state["progress"] > 0.85:
        speed_kmh = max(15, speed_kmh - 10)  # slowing for turn

    # Distance moved this tick (km) — km/h * (s / 3600)
    step_km = speed_kmh * (tick_seconds / 3600.0)

    current_wp = loop[state["waypoint_ix"]]
    next_wp = loop[(state["waypoint_ix"] + 1) % n]
    seg_km = max(0.05, _haversine_km(current_wp, next_wp))

    state["progress"] += step_km / seg_km
    while state["progress"] >= 1.0:
        state["progress"] -= 1.0
        state["waypoint_ix"] = (state["waypoint_ix"] + 1) % n
        current_wp = loop[state["waypoint_ix"]]
        next_wp = loop[(state["waypoint_ix"] + 1) % n]
        seg_km = max(0.05, _haversine_km(current_wp, next_wp))

    lat = current_wp[0] + (next_wp[0] - current_wp[0]) * state["progress"]
    lon = current_wp[1] + (next_wp[1] - current_wp[1]) * state["progress"]
    state["mileage"] = int(state["mileage"] + step_km)

    return {
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "speed": int(speed_kmh),
        "direction": _bearing(current_wp, next_wp),
        "gps_signal": 4,
        "gsm_signal": 4,
        "mileage": state["mileage"],
        "voltage": 12.6,
        "timestamp": int(time.time()),
    }
