"""API transkrip programatik: satu request masuk, hasil transkrip keluar.

Berbeda dari `/api/recordings` (yang asinkron: buat job, balas id, UI memantau),
endpoint ini SINKRON — pemanggil menunggu sampai transkrip selesai, karena
pemakainya mesin, bukan orang yang bisa melihat bilah progres.

Alur: url → unduh (atau file → simpan) → transkrip → (opsional) ringkasan → balas.

Rekamannya tetap tercatat penuh di DB dengan `source_kind="api"`, jadi muncul di
aplikasi seperti unduhan biasa. Membersihkan berkasnya setelah balasan terkirim
menyusul; untuk sekarang berkas dibiarkan agar alurnya sama persis dengan
unduhan manual dan mudah diperiksa.
"""
import asyncio
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from loguru import logger
from sqlalchemy import select
from starlette.datastructures import UploadFile as StarletteUploadFile

import analysis
from app.naming import clean_title
from app.routes import recordings as recs
from app.schemas import ApiTranscribeIn, ApiTranscribeOut, SegmentOut
from constants import (
    API_POLL_INTERVAL_S,
    API_WAIT_TIMEOUT_S,
    CONTENT_TYPES,
    CONTENT_VIDEO,
    DEFAULT_AI_LANGUAGE,
    JOB_DONE,
    JOB_DOWNLOADED,
    JOB_FAILED,
    JOB_KIND_FETCH,
    JOB_KIND_TRANSCRIBE,
    LANGUAGE_AUTO,
    LANGUAGE_BY_ID,
    SOURCE_API,
)
from store import models
from store.db import SessionLocal
from worker.queue import enqueue

router = APIRouter()

_FAILED = JOB_FAILED
_FETCH_DONE = (JOB_DOWNLOADED, _FAILED)
_TRANSCRIBE_DONE = (JOB_DONE, _FAILED)


@router.post("/transcribe", response_model=ApiTranscribeOut)
async def api_transcribe(request: Request) -> ApiTranscribeOut:
    """Terima `url` atau `file`, balas transkrip (dan ringkasan bila diminta).

    Mendukung dua bentuk body supaya pemanggil tidak dipaksa mengunggah berkas
    kosong hanya untuk mengirim URL:
      - `application/json`   : `{url, content_type, summary, language}`
      - `multipart/form-data`: field yang sama, `file` menggantikan `url`
    """
    body, upload = await _parse(request)
    _validate(body, upload)

    async with SessionLocal() as db:
        rec, needs_fetch = await _ingest(db, body, upload)

    if needs_fetch:
        status = await _wait(rec.id, _FETCH_DONE)
        if status is None:
            raise HTTPException(504, f"unduhan melebihi batas waktu (recording {rec.id})")
        if status == _FAILED:
            raise HTTPException(502, await _error_of(rec.id))
        async with SessionLocal() as db:
            await recs._create_job(db, rec.id, JOB_KIND_TRANSCRIBE)
            await enqueue(rec.id, JOB_KIND_TRANSCRIBE)

    status = await _wait(rec.id, _TRANSCRIBE_DONE)
    if status is None:
        raise HTTPException(504, f"transkrip melebihi batas waktu (recording {rec.id})")
    return await _result(rec.id, body, status)


async def _parse(request: Request) -> tuple[ApiTranscribeIn, StarletteUploadFile | None]:
    """Baca body JSON atau multipart menjadi satu bentuk yang sama.

    Tipe `UploadFile` di sini WAJIB dari starlette, bukan `fastapi.UploadFile`:
    parser form mengembalikan yang starlette, dan keduanya kelas berbeda —
    `isinstance` terhadap yang fastapi selalu False, sehingga berkasnya
    diam-diam dianggap tidak ada dan permintaan ditolak 422.
    """
    ctype = request.headers.get("content-type", "")
    if ctype.startswith("application/json"):
        return ApiTranscribeIn.model_validate(await request.json()), None
    form = await request.form()
    upload = form.get("file")
    if not isinstance(upload, StarletteUploadFile):
        upload = None
    return ApiTranscribeIn(
        url=(form.get("url") or None),
        content_type=form.get("content_type") or CONTENT_VIDEO,
        summary=_as_bool(form.get("summary")),
        language=form.get("language") or LANGUAGE_AUTO,
    ), upload


def _as_bool(value) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _validate(body: ApiTranscribeIn, upload: StarletteUploadFile | None) -> None:
    if bool(body.url) == bool(upload):
        raise HTTPException(422, "isi tepat salah satu: `url` atau `file`")
    if body.content_type not in CONTENT_TYPES:
        raise HTTPException(422, f"content_type harus salah satu dari {CONTENT_TYPES}")
    if body.language != LANGUAGE_AUTO and body.language not in LANGUAGE_BY_ID:
        raise HTTPException(422, f"bahasa tidak dikenal: {body.language}")


async def _ingest(db, body: ApiTranscribeIn, upload: StarletteUploadFile | None):
    """Simpan berkas / siapkan unduhan, lalu antrekan pekerjaan pertama.

    Balikkan `needs_fetch` sebagai BOOL, bukan `kind`: `JOB_KIND_TRANSCRIBE`
    adalah string tak-kosong dan karena itu truthy — memakainya sebagai penanda
    "perlu unduh dulu" membuat jalur berkas ikut menunggu status `downloaded`
    yang tak akan pernah datang, dan requestnya menggantung sampai timeout.
    """
    if upload is not None:
        recs._reject_bad_suffix(upload.filename)
        path = await recs._stream_to_disk(upload)
        duration_ms = await recs._probe_or_reject(path)
        rec = models.Recording(
            title=clean_title(upload.filename), source_filename=upload.filename,
            source_kind=SOURCE_API, content_type=body.content_type,
            upload_path=str(path), language=body.language, duration_ms=duration_ms,
            status=recs.JOB_DOWNLOADED,
        )
        db.add(rec)
        await db.commit()
        await db.refresh(rec)
        # Berkas sudah lokal — tak ada tahap unduh, langsung transkrip.
        await recs._create_job(db, rec.id, JOB_KIND_TRANSCRIBE)
        await enqueue(rec.id, JOB_KIND_TRANSCRIBE)
        return rec, False

    info = await recs._probe_url_or_reject(body.url)
    rec = models.Recording(
        title=info.title[:255], source_filename="", source_kind=SOURCE_API,
        source_url=body.url, content_type=body.content_type, upload_path="",
        language=body.language, duration_ms=info.duration_ms,
        status=recs.JOB_DOWNLOADING,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    await recs._create_job(db, rec.id, JOB_KIND_FETCH)
    await enqueue(rec.id, JOB_KIND_FETCH)
    return rec, True


async def _wait(rid: int, terminal: tuple[str, ...], timeout: int = API_WAIT_TIMEOUT_S) -> str | None:
    """Tunggu status terminal. Sesi DB dibuka per-poll, bukan ditahan selama
    menunggu — transkrip bisa berjalan puluhan menit."""
    deadline = time.monotonic() + timeout
    while True:
        await asyncio.sleep(API_POLL_INTERVAL_S)
        async with SessionLocal() as db:
            status = await db.scalar(
                select(models.Recording.status).where(models.Recording.id == rid)
            )
        if status in terminal:
            return status
        if status is None:
            return _FAILED
        if time.monotonic() > deadline:
            return None


async def _error_of(rid: int) -> str:
    async with SessionLocal() as db:
        err = await db.scalar(
            select(models.Job.error)
            .where(models.Job.recording_id == rid)
            .order_by(models.Job.id.desc())
        )
    return err or "pemrosesan gagal"


async def _result(rid: int, body: ApiTranscribeIn, status: str) -> ApiTranscribeOut:
    async with SessionLocal() as db:
        rec = await db.get(models.Recording, rid)
        segments = await recs._segments_of(db, rid)
        error = None
        if status == JOB_FAILED:
            error = await db.scalar(
                select(models.Job.error)
                .where(models.Job.recording_id == rid)
                .order_by(models.Job.id.desc())
            )
        summary = None
        if status == JOB_DONE and body.summary:
            summary = await _summarize(db, rid, segments)

    return ApiTranscribeOut(
        recording_id=rid,
        status=status,
        title=rec.title,
        language=rec.language,
        detected_language=rec.detected_language,
        duration_ms=rec.duration_ms,
        source="url" if body.url else "file",
        text=" ".join(s.text for s in segments if s.text).strip(),
        segments=[SegmentOut.model_validate(s) for s in segments],
        summary=summary,
        error=error,
    )


async def _summarize(db, rid: int, segments) -> str | None:
    """Ringkasan pakai mesin AI aktif. Gagal meringkas TIDAK menggagalkan
    transkrip — teksnya sudah jadi, dan itu bagian yang diminta."""
    if not segments:
        return None
    cfg = analysis.resolve()
    recs._reject_if_llm_unset(cfg)
    try:
        text = await recs._run_summary(segments, cfg, DEFAULT_AI_LANGUAGE)
    except HTTPException as exc:
        logger.warning("ringkasan API gagal recording={}: {}", rid, exc.detail)
        return None
    await recs._save_summary(db, rid, text, cfg, DEFAULT_AI_LANGUAGE)
    return text
