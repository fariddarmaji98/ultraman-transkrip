"""Antrean in-process, satu konsumen (concurrency=1 — hemat RAM VPS).

Untuk MVP transkrip-saja. Saat butuh durabilitas lintas-restart / worker terpisah,
ganti ke Procrastinate-on-Postgres tanpa mengubah pemanggil `enqueue`.
"""
import asyncio

from loguru import logger

from worker.pipeline import run_transcribe

_queue: "asyncio.Queue[int]" = asyncio.Queue()


async def enqueue(recording_id: int) -> None:
    await _queue.put(recording_id)


async def worker_loop() -> None:
    logger.info("worker transkrip mulai")
    while True:
        recording_id = await _queue.get()
        try:
            await run_transcribe(recording_id)
        finally:
            _queue.task_done()
