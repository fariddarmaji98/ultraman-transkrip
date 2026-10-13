"""Antrean in-process: fetch (unduh) dan transcribe jalan terpisah.

Fetch = I/O bound, boleh paralel dengan transcribe (CPU bound).
Transcribe = CPU bound, serial (concurrency=1) — CPU tidak bisa dibagi efisien
untuk model int8. Translate juga serial lewat antrean transcribe (ringan, async).

Item antrean = `(recording_id, kind)`; `kind` menentukan pipeline mana yang jalan.
Saat butuh durabilitas lintas-restart / worker terpisah, ganti ke Procrastinate-on-Postgres
tanpa mengubah pemanggil `enqueue`.
"""
import asyncio

from loguru import logger
from sqlalchemy import select

from constants import (
    ACTIVE_STATUSES,
    JOB_DOWNLOADING,
    JOB_KIND_FETCH,
    JOB_KIND_TRANSCRIBE,
    JOB_KIND_TRANSLATE,
    TRANSLATE_UNFINISHED,
)
from store import models
from store.db import SessionLocal
from worker.pipeline import run_fetch, run_transcribe, run_translate

_fetch_queue: "asyncio.Queue[tuple[int, str]]" = asyncio.Queue()
_work_queue: "asyncio.Queue[tuple[int, str]]" = asyncio.Queue()
_RUNNERS = {
    JOB_KIND_FETCH: run_fetch,
    JOB_KIND_TRANSCRIBE: run_transcribe,
    JOB_KIND_TRANSLATE: run_translate,
}


async def enqueue(recording_id: int, kind: str = JOB_KIND_TRANSCRIBE) -> None:
    q = _fetch_queue if kind == JOB_KIND_FETCH else _work_queue
    await q.put((recording_id, kind))


def pending_count() -> int:
    """Jumlah job menunggu di antrean (dipakai posC gerbang tol)."""
    return _fetch_queue.qsize() + _work_queue.qsize()


async def requeue_pending() -> None:
    """Startup: antre ulang yang belum selesai (antrean in-process hilang saat restart)."""
    async with SessionLocal() as db:
        result = await db.execute(
            select(models.Recording.id, models.Recording.status).where(
                models.Recording.status.in_(ACTIVE_STATUSES)
            )
        )
        for rid, status in result.all():
            await enqueue(rid, _kind_for(status))
        await _requeue_translations(db)


async def _requeue_translations(db) -> None:
    """Job terjemahan tidak terlihat dari `Recording.status` — ia sengaja tidak
    menyentuhnya (lihat `run_translate`). Jadi yang belum selesai harus dicari
    dari tabel `jobs` sendiri, kalau tidak ia menggantung selamanya di `queued`
    sementara transkripnya tampak sehat."""
    result = await db.execute(
        select(models.Job.recording_id).where(
            models.Job.kind == JOB_KIND_TRANSLATE,
            models.Job.status.in_(TRANSLATE_UNFINISHED),
        )
    )
    for (rid,) in result.all():
        await _work_queue.put((rid, JOB_KIND_TRANSLATE))


def _kind_for(status: str) -> str:
    return JOB_KIND_FETCH if status == JOB_DOWNLOADING else JOB_KIND_TRANSCRIBE


# ponytail: concurrency=1 untuk transcribe — CPU int8 tidak scale paralel.
# Saat GPU tersedia (CTranslate2 CUDA), naikkan ke 2-3.
async def _worker_loop(q: asyncio.Queue, name: str) -> None:
    logger.info("worker {} mulai", name)
    while True:
        recording_id, kind = await q.get()
        try:
            await _RUNNERS[kind](recording_id)
        finally:
            q.task_done()


async def worker_loop() -> None:
    """Compatibility: tetap dipanggil lifespan, sekarang start kedua worker."""
    await asyncio.gather(
        _worker_loop(_fetch_queue, "fetch"),
        _worker_loop(_work_queue, "transcribe"),
    )
