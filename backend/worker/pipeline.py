"""Pipeline per recording.

- `run_fetch`     : unduh dari URL (yt-dlp) -> file di upload_path
- `run_transcribe`: extract (ffmpeg) -> transcribe (ASR) -> simpan segmen

Keduanya idempoten: unduhan yang filenya sudah ada dilewati, segmen lama dihapus
sebelum ditulis ulang — jadi requeue setelah restart aman.
"""
import asyncio
import random
import time
from pathlib import Path
from uuid import uuid4

from loguru import logger
from sqlalchemy import delete, select

import analysis
from analysis.translate import translate_segments
from app.config import settings
from asr import get_provider
from capture import get_source
from constants import (
    FETCH_GAP_MAX_S,
    FETCH_GAP_MIN_S,
    JOB_DONE,
    JOB_DOWNLOADED,
    JOB_DOWNLOADING,
    JOB_EXTRACTING,
    JOB_FAILED,
    JOB_KIND_FETCH,
    JOB_KIND_TRANSCRIBE,
    JOB_KIND_TRANSLATE,
    JOB_TRANSCRIBING,
    JOB_TRANSLATING,
    LANGUAGE_AUTO,
)
from media.ffmpeg import extract_audio
from store import models
from store.db import SessionLocal


async def run_fetch(recording_id: int) -> None:
    async with SessionLocal() as db:
        rec, job = await _load(db, recording_id, JOB_KIND_FETCH)
        if rec is None or job is None:
            return
        try:
            await _fetch(db, rec, job)
            await _set(db, rec, job, JOB_DOWNLOADED, 100)
        except Exception as exc:  # noqa: BLE001 — semua kegagalan job -> failed
            logger.exception("unduh gagal recording={}", recording_id)
            await _set(db, rec, job, JOB_FAILED, job.progress, str(exc)[:500])


async def run_transcribe(recording_id: int) -> None:
    async with SessionLocal() as db:
        rec, job = await _load(db, recording_id, JOB_KIND_TRANSCRIBE)
        if rec is None or job is None:
            return
        try:
            await _extract(db, rec, job)
            await _transcribe(db, rec, job)
            await _set(db, rec, job, JOB_DONE, 100)
        except Exception as exc:  # noqa: BLE001 — semua kegagalan job -> failed
            logger.exception("transkrip gagal recording={}", recording_id)
            await _set(db, rec, job, JOB_FAILED, job.progress, str(exc)[:500])


async def run_translate(recording_id: int) -> None:
    """Terjemahkan segmen ke `job.lang`. `Recording.status` sengaja tidak disentuh.

    Transkripnya sudah selesai dan tersimpan; terjemahan adalah pekerjaan
    sampingan. Kegagalannya tidak boleh membuat rekaman yang baik-baik saja
    tampak gagal di daftar riwayat.
    """
    async with SessionLocal() as db:
        rec, job = await _load(db, recording_id, JOB_KIND_TRANSLATE)
        if rec is None or job is None or not job.lang:
            return
        try:
            await _set_job(db, job, JOB_TRANSLATING, 0)
            await _translate(db, rec, job)
            await _set_job(db, job, JOB_DONE, 100)
        except Exception as exc:  # noqa: BLE001 — semua kegagalan job -> failed
            logger.exception("terjemahan gagal recording={} lang={}", recording_id, job.lang)
            await _set_job(db, job, JOB_FAILED, job.progress, str(exc)[:500])


async def _translate(db, rec, job) -> None:
    segments = await _ordered_segments(db, rec.id)
    if not segments:
        raise RuntimeError("belum ada transkrip untuk diterjemahkan")
    source = rec.detected_language if rec.language == LANGUAGE_AUTO else rec.language
    total = len(segments)

    # Ditulis langsung tiap blok, bukan lewat poller: penerjemahnya async, jadi
    # tidak ada thread yang perlu dijembatani seperti pada ASR.
    async def lapor(n: int) -> None:
        await _set_job(db, job, JOB_TRANSLATING, min(99, n * 100 // total))

    texts = await translate_segments(
        [s.text for s in segments], analysis.get_llm(), job.lang, source, lapor
    )
    await _save_translations(db, rec.id, job.lang, segments, texts)
    logger.info("terjemahan selesai recording={} lang={} segmen={}", rec.id, job.lang, total)


async def _ordered_segments(db, recording_id: int):
    result = await db.execute(
        select(models.Segment)
        .where(models.Segment.recording_id == recording_id)
        .order_by(models.Segment.idx)
    )
    return list(result.scalars().all())


async def _save_translations(db, recording_id: int, lang: str, segments, texts) -> None:
    """Hapus-lalu-tulis dalam satu transaksi, sepola `_save_segments`."""
    await db.execute(
        delete(models.SegmentTranslation).where(
            models.SegmentTranslation.recording_id == recording_id,
            models.SegmentTranslation.lang == lang,
        )
    )
    db.add_all([
        models.SegmentTranslation(
            recording_id=recording_id, lang=lang, idx=s.idx, text=text
        )
        for s, text in zip(segments, texts)
    ])
    await db.commit()


async def _set_job(db, job, status: str, progress: int, error: str | None = None) -> None:
    """Seperti `_set`, tapi TIDAK menyentuh `Recording.status` (lihat `run_translate`)."""
    job.status = status
    job.progress = progress
    job.error = error
    await db.commit()


async def _load(db, recording_id: int, kind: str):
    """Satu recording kini bisa punya dua job (fetch lalu transcribe) — pilih per-kind."""
    rec = await db.get(models.Recording, recording_id)
    if rec is None:
        return None, None
    result = await db.execute(
        select(models.Job)
        .where(models.Job.recording_id == recording_id, models.Job.kind == kind)
        .order_by(models.Job.id.desc())
    )
    return rec, result.scalars().first()


_last_fetch_end = 0.0


async def _throttle() -> None:
    """Jeda acak sejak unduhan terakhir selesai.

    Antrean sudah serial (concurrency=1), tapi tanpa jeda dua URL yang dikirim
    beruntun tetap terbaca sebagai burst oleh platform.
    """
    gap = random.uniform(FETCH_GAP_MIN_S, FETCH_GAP_MAX_S)
    wait = _last_fetch_end + gap - time.monotonic()
    if wait > 0:
        logger.info("jeda {:.1f} dtk sebelum unduhan berikutnya", wait)
        await asyncio.sleep(wait)


async def _fetch(db, rec, job) -> None:
    global _last_fetch_end
    if rec.upload_path and Path(rec.upload_path).exists():
        return  # unduhan sebelumnya sudah tuntas (requeue setelah restart)
    await _throttle()
    await _set(db, rec, job, JOB_DOWNLOADING, 1)
    holder = {"pct": 1}
    poller = asyncio.create_task(_poll(db, rec, job, holder, JOB_DOWNLOADING))
    try:
        path = await asyncio.to_thread(
            get_source().fetch_video, rec.source_url, settings.upload_dir,
            uuid4().hex, lambda p: holder.__setitem__("pct", p),
        )
    finally:
        poller.cancel()
        await _await_cancel(poller)
    rec.upload_path, rec.source_filename = str(path), path.name
    _last_fetch_end = time.monotonic()
    await db.commit()


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
    poller = asyncio.create_task(_poll(db, rec, job, holder, JOB_TRANSCRIBING))
    try:
        result = await asyncio.to_thread(
            provider.transcribe, Path(rec.media_path), rec.language,
            lambda p: holder.__setitem__("pct", p),
        )
    finally:
        poller.cancel()
        await _await_cancel(poller)
    # Jangan menimpa nilai lama dengan None: transkrip ulang dengan bahasa yang
    # dipilih manual tidak melaporkan deteksi, dan itu bukan alasan menghapus
    # fakta yang sudah pernah diketahui.
    if result.language:
        rec.detected_language = result.language
    await _save_segments(db, rec.id, result.segments)


async def _poll(db, rec, job, holder, status: str) -> None:
    """Progress datang dari thread (yt-dlp / faster-whisper); tulis ke DB dari loop."""
    while True:
        await asyncio.sleep(1)
        if holder["pct"] != job.progress:
            await _set(db, rec, job, status, holder["pct"])


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
