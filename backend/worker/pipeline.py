"""Pipeline transkripsi satu recording: extract (ffmpeg) -> transcribe (ASR) -> simpan segmen.

Idempoten: segmen lama dihapus sebelum tulis ulang, jadi retry aman.
"""
import asyncio
from pathlib import Path

from loguru import logger
from sqlalchemy import delete, select

from app.config import settings
from asr import get_provider
from constants import JOB_DONE, JOB_EXTRACTING, JOB_FAILED, JOB_TRANSCRIBING
from media.ffmpeg import extract_audio
from store import models
from store.db import SessionLocal


async def run_transcribe(recording_id: int) -> None:
    async with SessionLocal() as db:
        rec, job = await _load(db, recording_id)
        if rec is None or job is None:
            return
        try:
            await _extract(db, rec, job)
            await _transcribe(db, rec, job)
            await _set(db, rec, job, JOB_DONE, 100)
        except Exception as exc:  # noqa: BLE001 — semua kegagalan job -> failed
            logger.exception("transkrip gagal recording={}", recording_id)
            await _set(db, rec, job, JOB_FAILED, job.progress, str(exc)[:500])


async def _load(db, recording_id: int):
    rec = await db.get(models.Recording, recording_id)
    if rec is None:
        return None, None
    result = await db.execute(
        select(models.Job).where(models.Job.recording_id == recording_id)
    )
    return rec, result.scalars().first()


async def _extract(db, rec, job) -> None:
    await _set(db, rec, job, JOB_EXTRACTING, 5)
    media_path = settings.media_dir / f"{rec.id}.wav"
    await extract_audio(Path(rec.upload_path), media_path)
    rec.media_path = str(media_path)
    await db.commit()


async def _transcribe(db, rec, job) -> None:
    await _set(db, rec, job, JOB_TRANSCRIBING, 30)
    provider = get_provider()
    holder = {"pct": 30}
    poller = asyncio.create_task(_poll_progress(db, rec, job, holder))
    try:
        segments = await asyncio.to_thread(
            provider.transcribe, Path(rec.media_path), rec.language,
            lambda p: holder.__setitem__("pct", p),
        )
    finally:
        poller.cancel()
        await _await_cancel(poller)
    await _save_segments(db, rec.id, segments)


async def _poll_progress(db, rec, job, holder) -> None:
    while True:
        await asyncio.sleep(1)
        if holder["pct"] != job.progress:
            await _set(db, rec, job, JOB_TRANSCRIBING, holder["pct"])


async def _await_cancel(task) -> None:
    try:
        await task
    except asyncio.CancelledError:
        pass


async def _save_segments(db, recording_id: int, segments) -> None:
    await db.execute(
        delete(models.Segment).where(models.Segment.recording_id == recording_id)
    )
    db.add_all([
        models.Segment(
            recording_id=recording_id, idx=s.idx, start_ms=s.start_ms,
            end_ms=s.end_ms, text=s.text, speaker=s.speaker,
        )
        for s in segments
    ])
    await db.commit()


async def _set(db, rec, job, status: str, progress: int, error: str | None = None) -> None:
    rec.status = status
    job.status = status
    job.progress = progress
    job.error = error
    await db.commit()
