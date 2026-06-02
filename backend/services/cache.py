"""Lightweight async-safe in-memory TTL cache.

Used to cut latency on hot read endpoints (e.g. /api/tenant/settings,
/api/vehicles, /api/locations) without introducing a Redis dependency.

Cache is process-local, so each uvicorn worker keeps its own store. When the
deployment is scaled to multiple workers/pods, swap this module for a Redis
client implementing the same get / set / invalidate_prefix interface.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Callable, Dict, Optional, Tuple


class TTLCache:
    """Simple in-memory cache with per-key TTL and prefix invalidation."""

    def __init__(self) -> None:
        # value tuple = (expires_at_monotonic, value)
        self._store: Dict[str, Tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            expires_at, value = entry
            if time.monotonic() > expires_at:
                self._store.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any, ttl: float) -> None:
        async with self._lock:
            self._store[key] = (time.monotonic() + ttl, value)

    async def get_or_set(
        self,
        key: str,
        ttl: float,
        fetcher: Callable[[], Any],
    ) -> Any:
        """Return cached value if present, otherwise await `fetcher()` and cache it."""
        cached = await self.get(key)
        if cached is not None:
            return cached
        value = await fetcher()
        await self.set(key, value, ttl)
        return value

    async def invalidate(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def invalidate_prefix(self, prefix: str) -> None:
        """Drop every key starting with `prefix`. Used for tenant-scoped invalidation."""
        async with self._lock:
            for k in [k for k in self._store if k.startswith(prefix)]:
                self._store.pop(k, None)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()

    def size(self) -> int:
        return len(self._store)


# Singleton used across the app
cache = TTLCache()


# ---------------- Key helpers ----------------
# Keep these in one place so invalidation and reads can't disagree.

def tenant_settings_key(tenant_id: str) -> str:
    return f"tenant:{tenant_id}:settings"


def vehicles_key(tenant_id: str, skip: int, limit: int) -> str:
    return f"tenant:{tenant_id}:vehicles:{skip}:{limit}"


def locations_key(tenant_id: str) -> str:
    return f"tenant:{tenant_id}:locations"


def tenant_prefix(tenant_id: str) -> str:
    return f"tenant:{tenant_id}:"
