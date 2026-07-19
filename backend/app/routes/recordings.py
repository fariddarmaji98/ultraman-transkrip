"""Endpoint recordings: upload (streaming), list, detail+transkrip, delete, media, export."""
from pathlib import Path
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.config import settings
from app.deps import DbDep
from app.naming import clean_title
from app.schemas import (
    RecordingDetail,
    RecordingOut,
    RenameIn,
    SegmentOut,
    UploadResponse,
)
from constants import (
    ACCEPTED_SUFFIXES,
    JOB_QUEUED,
    MAX_UPLOAD_BYTES,
    UPLOAD_CHUNK_BYTES,
)
from export.render import render_export
from media.ffmpeg import MediaError, probe_duration_ms
from store import models
from worker.queue import enqueue

router = APIRouter()


@router.post("/recordings", response_model=UploadResponse, status_code=201)
async def upload_recording(
    db: DbDep,
    file: UploadFile,
    language: str = Form(default=settings.default_language),
    title: str | None = Form(default=None),
) -> UploadResponse:
    _reject_bad_suffix(file.filename)
    upload_path = await _stream_to_disk(file)
    duration_ms = await _probe_or_reject(upload_path)
    rec = await _create_recording(db, file, title, language, upload_path, duration_ms)
    job = await _create_job(db, rec.id)
    await enqueue(rec.id)
    return UploadResponse(recording=RecordingOut.model_validate(rec), job_id=job.id)


@router.get("/recordings", response_model=list[RecordingOut])
async def list_recordings(db: DbDep) -> list[models.Recording]:
    result = await db.execute(
        select(models.Recording).order_by(models.Recording.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/recordings/{rid}", response_model=RecordingDetail)
async def get_recording(rid: int, db: DbDep) -> RecordingDetail:
    rec = await _get_or_404(db, rid)
    segments = await _segments_of(db, rid)
    progress = await _progress_of(db, rid)
    return _to_detail(rec, segments, progress)


@router.patch("/recordings/{rid}", response_model=RecordingOut)
async def rename_recording(rid: int, body: RenameIn, db: DbDep) -> models.Recording:
    rec = await _get_or_404(db, rid)
    title = body.title.strip()
    if title:
        rec.title = title
        await db.commit()
        await db.refresh(rec)
    return rec


@router.delete("/recordings/{rid}", status_code=204)
async def delete_recording(rid: int, db: DbDep) -> None:
    rec = await _get_or_404(db, rid)
    _remove_files(rec)
    await db.delete(rec)
    await db.commit()


@router.get("/recordings/{rid}/media")
async def get_media(rid: int, db: DbDep) -> FileResponse:
    rec = await _get_or_404(db, rid)
    if not rec.media_path or not Path(rec.media_path).exists():
        raise HTTPException(404, "media tidak tersedia")
    return FileResponse(rec.media_path, media_type="audio/wav")


@router.get("/recordings/{rid}/source")
async def get_source(rid: int, db: DbDep) -> FileResponse:
    rec = await _get_or_404(db, rid)
    if not rec.upload_path or not Path(rec.upload_path).exists():
        raise HTTPException(404, "sumber tidak tersedia")
    return FileResponse(rec.upload_path, filename=rec.source_filename)


@router.get("/recordings/{rid}/export")
async def export_transcript(rid: int, db: DbDep, fmt: str = "txt") -> Response:
    await _get_or_404(db, rid)
    segments = await _segments_of(db, rid)
    body, media_type = render_export(segments, fmt)
    disposition = f'attachment; filename="transkrip-{rid}.{fmt}"'
    return Response(body, media_type=media_type,
                    headers={"Content-Disposition": disposition})


# --- helpers ---------------------------------------------------------------

def _reject_bad_suffix(filename: str) -> None:
    if Path(filename).suffix.lower() not in ACCEPTED_SUFFIXES:
        raise HTTPException(422, "format file tidak didukung")


async def _stream_to_disk(file: UploadFile) -> Path:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename).suffix.lower()
    dst = settings.upload_dir / f"{uuid4().hex}{suffix}"
    try:
        await _copy_chunks(file, dst)
    except Exception:
        dst.unlink(missing_ok=True)
        raise
    return dst


async def _copy_chunks(file: UploadFile, dst: Path) -> None:
    written = 0
    async with aiofiles.open(dst, "wb") as out:
        while chunk := await file.read(UPLOAD_CHUNK_BYTES):
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "file melebihi batas 2 GB")
            await out.write(chunk)


async def _probe_or_reject(path: Path) -> int:
    try:
        return await probe_duration_ms(path)
    except MediaError as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(422, "file bukan media yang valid") from exc


async def _create_recording(db, file, title, language, path, duration_ms):
    rec = models.Recording(
        title=title or clean_title(file.filename), source_filename=file.filename,
        upload_path=str(path), language=language, duration_ms=duration_ms,
        status=JOB_QUEUED,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


async def _create_job(db, recording_id: int):
    job = models.Job(recording_id=recording_id, kind="transcribe", status=JOB_QUEUED)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def _get_or_404(db, rid: int) -> models.Recording:
    rec = await db.get(models.Recording, rid)
    if rec is None:
        raise HTTPException(404, "recording tidak ditemukan")
    return rec


async def _segments_of(db, rid: int) -> list[models.Segment]:
    result = await db.execute(
        select(models.Segment)
        .where(models.Segment.recording_id == rid)
        .order_by(models.Segment.idx)
    )
    return list(result.scalars().all())


async def _progress_of(db, rid: int) -> int:
    result = await db.execute(
        select(models.Job.progress).where(models.Job.recording_id == rid)
    )
    return result.scalars().first() or 0


def _to_detail(rec, segments, progress: int) -> RecordingDetail:
    return RecordingDetail(
        id=rec.id, title=rec.title, source_filename=rec.source_filename,
        status=rec.status, duration_ms=rec.duration_ms, language=rec.language,
        created_at=rec.created_at, progress=progress,
        source_available=bool(rec.upload_path and Path(rec.upload_path).exists()),
        media_available=bool(rec.media_path and Path(rec.media_path).exists()),
        segments=[SegmentOut.model_validate(s) for s in segments],
    )


def _remove_files(rec) -> None:
    for attr in ("upload_path", "media_path"):
        value = getattr(rec, attr)
        if value:
            Path(value).unlink(missing_ok=True)
