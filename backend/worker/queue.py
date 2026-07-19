"""Antrean in-process, satu konsumen (concurrency=1 — hemat RAM VPS).

Untuk MVP transkrip-saja. Saat butuh durabilitas lintas-restart / worker terpisah,
ganti ke Procrastinate-on-Postgres tanpa mengubah pemanggil `enqueue`.
"""
import asyncio

from loguru import logger
from sqlalchemy import select

from constants import JOB_EXTRACTING, JOB_QUEUED, JOB_TRANSCRIBING
from store import models
from store.db import SessionLocal
from worker.pipeline import run_transcribe

_queue: "asyncio.Queue[int]" = asyncio.Queue()


async def enqueue(recording_id: int) -> None:
    await _queue.put(recording_id)


def pending_count() -> int:
    """Jumlah job menunggu di antrean (dipakai posC gerbang tol)."""
    return _queue.qsize()


async def requeue_pending() -> None:
    """Startup: antre ulang recording yang belum selesai (antrean in-process hilang saat restart)."""
    unfinished = (JOB_QUEUED, JOB_EXTRACTING, JOB_TRANSCRIBING)
    async with SessionLocal() as db:
        result = await db.execute(
            select(models.Recording.id).where(models.Recording.status.in_(unfinished))
        )
        for rid in result.scalars().all():
            await _queue.put(rid)


async def worker_loop() -> None:
    logger.info("worker transkrip mulai")
    while True:
        recording_id = await _queue.get()
        try:
            await run_transcribe(recording_id)
        finally:
            _queue.task_done()
