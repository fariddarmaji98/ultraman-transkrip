"""Gerbang tol: satu middleware ASGI menjalankan rantai proteksi SEBELUM router.

Hanya membaca header/method/path (tak menyentuh body) → aman untuk upload streaming besar.
"""
from starlette.requests import Request
from starlette.responses import JSONResponse

from protection.base import ProtectionError


class ProtectionMiddleware:
    def __init__(self, app, protections):
        self.app = app
        self.protections = protections

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request = Request(scope, receive)
        try:
            for gate in self.protections:
                await gate.check(request)
        except ProtectionError as exc:
            response = JSONResponse({"detail": exc.detail}, status_code=exc.status)
            return await response(scope, receive, send)
        await self.app(scope, receive, send)
