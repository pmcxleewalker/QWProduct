"""
Driver's Licence Reminder Cron

Runs once a day and emails every staff/admin whose `driver_licence_expiry`
is exactly 14 days or 3 days away.

Idempotency: each send is logged in `licence_reminder_sends` with a unique
key (`user_id + expiry_date + days_before`). Duplicate runs on the same day
short-circuit so nobody is spammed if the scheduler fires twice under
supervisor reload.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from services.email_service import send_licence_reminder_email

logger = logging.getLogger(__name__)

# Days before expiry that trigger a reminder. Order matters only for logs.
REMINDER_OFFSETS = (14, 3)

_scheduler: Optional[AsyncIOScheduler] = None
_db = None


def _get_public_login_url(tenant_slug: Optional[str]) -> str:
    import os
    base = os.environ.get("FRONTEND_URL", "https://quick-wing.com").rstrip("/")
    if tenant_slug:
        return f"{base}/{tenant_slug}/login"
    return f"{base}/login"


async def _process_offset(target_date_iso: str, days_before: int) -> dict:
    """Find every user with driver_licence_expiry == target_date and email
    each, once. Returns a small summary dict for logging."""
    assert _db is not None
    cursor = _db.users.find(
        {"driver_licence_expiry": target_date_iso, "is_active": {"$ne": False}},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "driver_licence_expiry": 1},
    )
    users = await cursor.to_list(length=2000)

    sent = 0
    skipped = 0
    failed = 0

    for user in users:
        user_id = user.get("id")
        email = user.get("email")
        if not email:
            continue

        # Idempotency guard — one send per (user, expiry, days_before)
        dedupe_key = f"{user_id}|{target_date_iso}|{days_before}"
        existing = await _db.licence_reminder_sends.find_one(
            {"key": dedupe_key}, {"_id": 0, "key": 1}
        )
        if existing:
            skipped += 1
            continue

        # Find any tenant this user belongs to (for branding). If they belong
        # to several, first hit is fine — reminder is personal.
        membership = await _db.memberships.find_one(
            {"user_id": user_id}, {"_id": 0, "tenant_id": 1}
        )
        tenant_name = "Your team"
        tenant_slug = None
        if membership:
            tenant = await _db.tenants.find_one(
                {"id": membership["tenant_id"]},
                {"_id": 0, "name": 1, "slug": 1},
            )
            if tenant:
                tenant_name = tenant.get("name") or tenant_name
                tenant_slug = tenant.get("slug")

        result = await send_licence_reminder_email(
            recipient_email=email,
            staff_name=user.get("name"),
            days_before=days_before,
            expiry_date_iso=target_date_iso,
            tenant_name=tenant_name,
            login_url=_get_public_login_url(tenant_slug),
        )

        # Persist a record either way — even a failure is logged so we don't
        # retry on the next poll (admins can inspect the collection).
        await _db.licence_reminder_sends.insert_one({
            "key": dedupe_key,
            "user_id": user_id,
            "user_email": email,
            "days_before": days_before,
            "expiry_date": target_date_iso,
            "success": bool(result.get("success")),
            "email_id": result.get("email_id"),
            "error": result.get("error"),
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })

        if result.get("success"):
            sent += 1
        else:
            failed += 1

    return {
        "target_date": target_date_iso,
        "days_before": days_before,
        "candidates": len(users),
        "sent": sent,
        "skipped": skipped,
        "failed": failed,
    }


async def _run_once() -> None:
    """Fire reminders for every configured offset."""
    if _db is None:
        return
    today = date.today()
    for days_before in REMINDER_OFFSETS:
        target = today.fromordinal(today.toordinal() + days_before).isoformat()
        try:
            summary = await _process_offset(target, days_before)
            logger.info("[licence-reminders] %s", summary)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "[licence-reminders] error processing %d-day offset: %s",
                days_before, exc,
            )


def start(db) -> None:
    """Start the daily licence-reminder scheduler. Idempotent."""
    global _scheduler, _db
    _db = db
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    # Runs every day at 08:00 UTC (early morning in Ireland).
    _scheduler.add_job(
        _run_once,
        trigger=CronTrigger(hour=8, minute=0),
        id="licence_reminders_daily",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "[licence-reminders] scheduler started (daily 08:00 UTC, offsets=%s)",
        REMINDER_OFFSETS,
    )


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


async def run_now() -> list[dict]:
    """Manual trigger — useful for admin diagnostics or tests."""
    if _db is None:
        return []
    today = date.today()
    out = []
    for days_before in REMINDER_OFFSETS:
        target = today.fromordinal(today.toordinal() + days_before).isoformat()
        out.append(await _process_offset(target, days_before))
    return out
