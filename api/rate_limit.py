"""
SecureShare Rate Limiter
Simple in-memory sliding-window limiter keyed by client IP.

Design notes:
- A sliding window records request timestamps per (bucket, key).
- Old timestamps are pruned on every hit, so memory stays bounded by
  the configured limit, not by total requests.
- Thread-safe via a single lock; fine for a single-process Flask app.
- Behind a reverse proxy, the caller resolves the real client IP from
  X-Forwarded-For before calling `is_allowed`.

For horizontal scaling this would move to Redis, but for a single
process it is fast, dependency-free, and easy to understand.
"""

import threading
import time
from collections import defaultdict

from api.config import RATE_LIMITS
from api.errors import RateLimitError


class RateLimiter:
    def __init__(self, limits: dict = None):
        # bucket name -> (max_requests, window_seconds)
        self.limits = limits or RATE_LIMITS
        self._hits = defaultdict(list)
        self._lock = threading.Lock()

    def is_allowed(self, bucket: str, key: str) -> bool:
        """Returns True if the request should be allowed."""
        limit = self.limits.get(bucket)
        if not limit:
            return True

        max_requests, window_seconds = limit
        now = time.monotonic()

        with self._lock:
            key_name = bucket + ":" + key
            timestamps = self._hits[key_name]
            cutoff = now - window_seconds

            # Prune expired timestamps (keeps memory bounded)
            while timestamps and timestamps[0] < cutoff:
                timestamps.pop(0)

            if len(timestamps) >= max_requests:
                return False

            if not timestamps:
                # If list became empty after pruning and not adding, clean up
                pass

            timestamps.append(now)
            return True

    def check(self, bucket: str, key: str):
        """Raise RateLimitError when the request is not allowed."""
        if not self.is_allowed(bucket, key):
            limit = self.limits.get(bucket)
            retry_after = limit[1] if limit else 60
            raise RateLimitError(headers={"Retry-After": str(retry_after)})
