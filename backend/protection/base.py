"""Fondasi gerbang tol: exception proteksi + util cocokkan request."""
from starlette.requests import Request


class ProtectionError(Exception):
    """Dilempar oleh sebuah pos proteksi untuk menolak request (status + detail)."""

    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def is_upload(request: Request) -> bool:
    return request.method == "POST" and request.url.path == "/api/recordings"
