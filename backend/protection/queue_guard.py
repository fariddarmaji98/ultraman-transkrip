"""Pos antrean: tolak unggahan baru bila antrean transkrip sudah penuh (lindungi resource)."""
from starlette.requests import Request

from protection.base import ProtectionError, is_upload
from worker.queue import pending_count


class QueueGuard:
    """Tolak unggahan baru bila antrean transkrip sudah penuh (lindungi resource).

    `/api/transcribe` sengaja TIDAK digerbang di sini: pemanggilnya menunggu
    balasan, jadi menolak di depan berarti membuang pekerjaan yang sudah
    setengah jalan tanpa manfaat. Ia tetap kena throttle unggahan (posB).
    """
    def __init__(self, max_pending: int):
        self.max = max_pending

    async def check(self, request: Request) -> None:
        if is_upload(request) and pending_count() >= self.max:
            raise ProtectionError(429, "antrean transkrip penuh, coba lagi nanti")
