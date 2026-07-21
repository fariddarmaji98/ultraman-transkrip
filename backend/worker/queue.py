"""Antrean in-process, satu konsumen (concurrency=1 — hemat RAM VPS).

Item antrean = `(recording_id, kind)`; `kind` menentukan pipeline mana yang jalan.
Saat butuh durabilitas lintas-restart / worker terpisah, ganti ke Procrastinate-on-Postgres
tanpa mengubah pemanggil `enqueue`.
"""
import asyncio

from loguru import logger
from sqlalchemy import select

from constants import ACTIVE_STATUSES, JOB_DOWNLOADING, JOB_KIND_FETCH, JOB_KIND_TRANSCRIBE
from store import models
from store.db import SessionLocal
from worker.pipeline import run_fetch, run_transcribe

_queue: "asyncio.Queue[tuple[int, str]]" = asyncio.Queue()
_RUNNERS = {JOB_KIND_FETCH: run_fetch, JOB_KIND_TRANSCRIBE: run_transcribe}


async def enqueue(recording_id: int, kind: str = JOB_KIND_TRANSCRIBE) -> None:
    await _queue.put((recording_id, kind))


def pending_count() -> int:
    """Jumlah job menunggu di antrean (dipakai posC gerbang tol)."""
    return _queue.qsize()


async def requeue_pending() -> None:
    """Startup: antre ulang yang belum selesai (antrean in-process hilang saat restart)."""
    async with SessionLocal() as db:
        result = await db.execute(
            select(models.Recording.id, models.Recording.status).where(
                models.Recording.status.in_(ACTIVE_STATUSES)
            )
        )
        for rid, status in result.all():
            await _queue.put((rid, _kind_for(status)))


def _kind_for(status: str) -> str:
    return JOB_KIND_FETCH if status == JOB_DOWNLOADING else JOB_KIND_TRANSCRIBE


async def worker_loop() -> None:
    logger.info("worker mulai")
    while True:
        recording_id, kind = await _queue.get()
        try:
            await _RUNNERS[kind](recording_id)
        finally:
            _queue.task_done()
