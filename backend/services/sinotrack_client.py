"""
SinoTrack Cloud Client
======================

Reverse-engineered client for SinoTrack's cloud API used by ST-902L-4GE
(and similar) OBD GPS trackers. Firmware is locked and only reports to
`https://246.sinotrack.com` — this module lets Quick Wing pull positions
server-side every 30 s and write them into tenant-scoped collections.

The protocol details (base64-wrapped tokens, MD5 signing, stored-procedure
style calls like `Proc_LoginIMEI`, `Proc_GetLastPosition`) are copied
VERBATIM from the working production spec at
/app/memory/SINOTRACK_MULTI_TENANT_PROMPT.md. Do not change unless SinoTrack
themselves change their API.

Public functions:
    login(imei, password)     -> True/False (verifies device credentials)
    fetch_position(imei, password) -> position dict or None

Position dict shape:
    {
      "latitude":   float,
      "longitude":  float,
      "speed":      int,     # km/h
      "direction":  int,     # 0-359
      "gps_signal": int,     # 0-4
      "gsm_signal": int,     # 0-4
      "mileage":    int,     # km reported by device
      "voltage":    float,   # V, parsed from strOther "Voltages=XX.X"
      "timestamp":  int,     # unix epoch (seconds)
    }
"""
from __future__ import annotations

import base64
import hashlib
import logging
import random
import re
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SINOTRACK_SERVER = "https://246.sinotrack.com"
APP_ID = base64.b64encode(b"246.sinotrack.com/").decode()
_HTTP_TIMEOUT = 10.0

# Reusable client — httpx keeps the connection pool warm across calls.
_client: Optional[httpx.Client] = None


def _get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(timeout=_HTTP_TIMEOUT)
    return _client


def _call_sinotrack(token_raw: str, user: str = "", app_id: str = APP_ID) -> dict:
    """Low-level call to SinoTrack's AppJson.asp with the reverse-engineered
    signing scheme. `token_raw` is the stored-procedure string (already
    delimited); this wraps it in base64 + adds nonce/timestamp/MD5."""
    token = base64.b64encode(token_raw.encode()).decode()
    ts = str(int(time.time() * 1000))
    rand = str(random.randint(10000000000000, 99999999999999))
    sign_input = f"{ts}{rand}{user}{app_id}{token}"
    sign = hashlib.md5(sign_input.encode()).hexdigest()
    try:
        r = _get_client().post(
            f"{SINOTRACK_SERVER}/APP/AppJson.asp",
            data={
                "strAppID": app_id,
                "strUser": user,
                "nTimeStamp": ts,
                "strRandom": rand,
                "strSign": sign,
                "strToken": token,
            },
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.warning(f"SinoTrack HTTP error for token={token_raw[:40]}...: {e}")
        return {}


def login(imei: str, password: str = "123456") -> bool:
    """Verify the device credentials. Returns True if SinoTrack recognises
    the pair. This is not strictly required before every position fetch —
    it's called by the register-device endpoint to sanity-check the IMEI."""
    token_raw = f"Proc_LoginIMEI\x11N'{imei}',N'{password}'\x11\x11\x1b3"
    resp = _call_sinotrack(token_raw)
    if not resp or resp.get("m_isResultOk") != 1:
        return False
    row = _first_record(resp)
    if not row:
        return False
    # `Result` column returns "1" on success, "0" on invalid credentials.
    result = row.get("Result") or row.get("result") or row.get("nResult")
    return str(result).strip() == "1"


def _parse_voltage(str_other: str) -> Optional[float]:
    """SinoTrack packs extras into a `strOther` string like
    `"...;Voltages=12.6;..."`. Pull the voltage out if present."""
    if not str_other:
        return None
    m = re.search(r"Voltages?\s*=\s*([\d.]+)", str_other, re.IGNORECASE)
    if not m:
        return None
    try:
        v = float(m.group(1))
        # SinoTrack occasionally returns "Voltages=0.0" as a placeholder when
        # the OBD hasn't reported yet — treat that as None so we don't fire
        # bogus unplug alerts.
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def _first_record(resp: dict) -> Optional[dict]:
    """SinoTrack returns column-oriented JSON:
        {"m_arrField": ["col1","col2",...], "m_arrRecord": [[v1,v2,...]]}
    Zip the first row with the field names to reconstruct a dict. Also
    handle a few legacy record-oriented shapes as a safety net."""
    if not isinstance(resp, dict):
        return None
    fields = resp.get("m_arrField")
    records = resp.get("m_arrRecord")
    if isinstance(fields, list) and isinstance(records, list) and records:
        row = records[0]
        if isinstance(row, list) and len(row) == len(fields):
            return dict(zip(fields, row))
    # Legacy shapes (kept for defence in depth)
    for key in ("Recordset", "Recordsets", "rows", "Rows", "data"):
        val = resp.get(key)
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return val[0]
        if isinstance(val, dict):
            inner = val.get("Row") or val.get("row")
            if isinstance(inner, list) and inner and isinstance(inner[0], dict):
                return inner[0]
            if isinstance(inner, dict):
                return inner
    if "dbLat" in resp or "dbLon" in resp:
        return resp
    return None


def fetch_position(imei: str, password: str = "123456") -> Optional[dict]:
    """Fetch the last known position for a single tracker. Returns None on
    any error / no fix / empty response so callers can skip cleanly."""
    token_raw = f"Proc_GetLastPosition\x11N'{imei}'\x11\x11\x1b58"
    resp = _call_sinotrack(token_raw)
    row = _first_record(resp)
    if not row:
        return None
    try:
        lat = float(row.get("dbLat") or 0)
        lon = float(row.get("dbLon") or 0)
    except (TypeError, ValueError):
        return None
    if lat == 0 and lon == 0:
        return None  # no GPS fix yet

    def _num(key, default=0):
        try:
            return int(float(row.get(key) or default))
        except (TypeError, ValueError):
            return default

    voltage = _parse_voltage(row.get("strOther") or row.get("strOther1") or "")

    return {
        "latitude": lat,
        "longitude": lon,
        "speed": _num("nSpeed"),
        "direction": _num("nDirection"),
        "gps_signal": _num("nGPSSignal"),
        "gsm_signal": _num("nGSMSignal"),
        "mileage": _num("nMileage"),
        "voltage": voltage,
        "timestamp": _num("nTime", int(time.time())),
    }
