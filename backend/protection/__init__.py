"""Gerbang tol proteksi — rantai pos yang WAJIB dilewati request sebelum masuk fitur.

    request -> posA(rate global) -> posB(throttle upload) -> posC(antrean) -> router -> fitur

Tambah pos baru (mis. cek API-key, blokir IP) = tambah satu entri di build_protections();
endpoint & fitur tak perlu diubah.
"""
from fastapi import FastAPI

from constants import (
    QUEUE_MAX_PENDING,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_S,
    UPLOAD_LIMIT_MAX,
    UPLOAD_LIMIT_WINDOW_S,
)
from protection.base import is_upload
from protection.middleware import ProtectionMiddleware
from protection.queue_guard import QueueGuard
from protection.rate_limit import RateLimit


def build_protections() -> list:
    return [
        RateLimit(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_S),  # posA: rate global per IP
        RateLimit(  # posB: throttle jalur mahal (upload)
            UPLOAD_LIMIT_MAX, UPLOAD_LIMIT_WINDOW_S, match=is_upload,
            detail="terlalu banyak unggahan, coba lagi nanti",
        ),
        QueueGuard(QUEUE_MAX_PENDING),  # posC: tolak bila antrean penuh
    ]


def install_protection(app: FastAPI) -> None:
    app.add_middleware(ProtectionMiddleware, protections=build_protections())
