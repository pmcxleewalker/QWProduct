"""Atomic resource reservations shared by bulk setup and existing tracker writes."""
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError


def device_keys(imei=None, iccid=None, msisdn=None, car_id=None):
    return [f"{kind}:{value}" for kind, value in (
        ("tracker", imei), ("iccid", iccid),
        ("msisdn", (msisdn or "").lstrip("+")), ("vehicle", car_id)) if value]


async def claim_assets(db, owner, keys):
    inserted = []
    try:
        for key in sorted(set(keys)):
            try:
                await db.tracker_setup_claims.insert_one({"_id": key, "owner": owner})
                inserted.append(key)
            except DuplicateKeyError:
                current = await db.tracker_setup_claims.find_one({"_id": key}, {"_id": 0})
                if not current or current["owner"] != owner:
                    raise HTTPException(409, "Tracker, SIM or vehicle is already used or reserved")
    except Exception:
        if inserted:
            await db.tracker_setup_claims.delete_many({"_id": {"$in": inserted}, "owner": owner})
        raise


async def release_assets(db, owner, keep=()):
    await db.tracker_setup_claims.delete_many({"owner": owner, "_id": {"$nin": list(keep)}})