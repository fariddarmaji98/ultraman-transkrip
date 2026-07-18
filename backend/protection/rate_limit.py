"""Pos rate-limit: sliding window per IP. `match` opsional membatasi ke request tertentu."""
import time
from collections import defaultdict, deque

from starlette.requests import Request

from protection.base import ProtectionError, client_ip


class RateLimit:
    def __init__(self, max_hits, window_s, match=None, detail="terlalu banyak permintaan"):
        self.max = max_hits
        self.window = window_s
        self.match = match
        self.detail = detail
        self._hits: dict[str, deque] = defaultdict(deque)

    async def check(self, request: Request) -> None:
        if self.match and not self.match(request):
            return
        now = time.monotonic()
        hits = self._hits[client_ip(request)]
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        if len(hits) >= self.max:
            raise ProtectionError(429, self.detail)
        hits.append(now)
