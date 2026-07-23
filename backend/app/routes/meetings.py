"""Sesi rekaman meeting dari ekstensi Chrome (planning meeting-capture.md, Fase A).

Tiga langkah: mulai sesi → kirim potongan berkali-kali → tutup sesi. Setelah
ditutup, berkasnya masuk pipeline transkrip yang sudah ada tanpa perubahan —
asal audionya saja yang berbeda.
"""
import secrets
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import select

from app.config import settings
from app.deps import DbDep
from app.schemas import MeetingSessionOut, MeetingStartIn, RecordingOut
from capture import meeting
from constants import (
    JOB_KIND_TRANSCRIBE,
    JOB_QUEUED,
    JOB_RECORDING,
    MEETING_CHUNK_MAX_BYTES,
    MEETING_CONTAINER_SUFFIX,
    MEETING_MAX_BYTES,
    MEETING_PLATFORMS,
    MEETING_TOKEN_BYTES,
    SOURCE_MEETING,
)
from media.ffmpeg import MediaError, probe_duration_ms, remux
from store import models
from worker.queue import enqueue

router = APIRouter()


@router.post("/recordings/meeting", response_model=MeetingSessionOut, status_code=201)
async def start_meeting(body: MeetingStartIn, db: DbDep) -> MeetingSessionOut:
    _reject_bad_platform(body.platform)
    rec = await _create_session(db, body)
    return MeetingSessionOut(recording_id=rec.id, upload_token=rec.upload_token)


@router.put("/recordings/{rid}/chunk", status_code=204)
async def put_chunk(
    rid: int,
    seq: int,
    request: Request,
    db: DbDep,
    x_upload_token: str = Header(default=""),
) -> None:
    """Terima satu potongan audio. Idempoten per `seq` — retry aman."""
    rec = await _session_or_reject(db, rid, x_upload_token)
    data = await _read_chunk(request)
    _reject_if_session_too_big(rid, len(data))
    meeting.save_chunk(rec.id, seq, data)


@router.post("/recordings/{rid}/finish", response_model=RecordingOut)
async def finish_meeting(
    rid: int, db: DbDep, x_upload_token: str = Header(default="")
) -> RecordingOut:
    """Tutup sesi: sambung potongan, ukur durasi, lalu antre transkrip."""
    rec = await _session_or_reject(db, rid, x_upload_token)
    dst = await _assemble_and_repair(rec.id)
    await _finalize(db, rec, dst)
    await enqueue(rec.id, JOB_KIND_TRANSCRIBE)
    return RecordingOut.model_validate(rec)


@router.delete("/recordings/{rid}/meeting", status_code=204)
async def cancel_meeting(
    rid: int, db: DbDep, x_upload_token: str = Header(default="")
) -> None:
    """Batalkan sesi: buang potongan dan rekamannya. Tidak menyisakan sampah."""
    rec = await _session_or_reject(db, rid, x_upload_token)
    meeting.discard(rec.id)
    await db.delete(rec)
    await db.commit()


# --- helpers ---------------------------------------------------------------

def _reject_bad_platform(platform: str) -> None:
    if platform not in MEETING_PLATFORMS:
        raise HTTPException(422, f"platform tidak dikenal: {platform}")


async def _create_session(db, body: MeetingStartIn) -> models.Recording:
    token = secrets.token_urlsafe(MEETING_TOKEN_BYTES)
    rec = models.Recording(
        title=(body.title.strip() or _default_title(body.platform))[:255],
        source_filename=f"{body.platform}{MEETING_CONTAINER_SUFFIX}",
        source_kind=SOURCE_MEETING, source_url=body.url,
        meeting_platform=body.platform, upload_token=token,
        upload_path="", language=body.language, status=JOB_RECORDING,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


def _default_title(platform: str) -> str:
    stamp = datetime.now(timezone.utc).astimezone().strftime("%d %b %Y %H:%M")
    return f"Meeting {platform} {stamp}"


async def _session_or_reject(db, rid: int, token: str) -> models.Recording:
    """Sesi harus ada, masih berjalan, dan tokennya cocok.

    Perbandingan token pakai `compare_digest` supaya lama-tidaknya penolakan
    tidak membocorkan seberapa banyak karakter yang sudah benar.
    """
    rec = await db.get(models.Recording, rid)
    if rec is None or rec.status != JOB_RECORDING:
        raise HTTPException(404, "sesi rekaman tidak ditemukan")
    if not rec.upload_token or not secrets.compare_digest(rec.upload_token, token):
        raise HTTPException(403, "token sesi tidak cocok")
    return rec


async def _read_chunk(request: Request) -> bytes:
    data = await request.body()
    if not data:
        raise HTTPException(422, "potongan kosong")
    if len(data) > MEETING_CHUNK_MAX_BYTES:
        mb = MEETING_CHUNK_MAX_BYTES // (1024 * 1024)
        raise HTTPException(413, f"potongan melebihi {mb} MB")
    return data


def _reject_if_session_too_big(rid: int, incoming: int) -> None:
    if meeting.received_bytes(rid) + incoming > MEETING_MAX_BYTES:
        gb = MEETING_MAX_BYTES // (1024 ** 3)
        raise HTTPException(413, f"sesi melebihi batas {gb} GB")


async def _assemble_and_repair(rid: int) -> Path:
    """Sambung potongan lalu **remux**, karena hasil mentahnya belum bisa dipakai.

    `MediaRecorder` menulis WebM mode *live*: tanpa durasi di header dan tanpa
    indeks pencarian. Tanpa remux, ffprobe gagal membaca durasinya (dan pernah
    membuat seluruh sesi ditolak "tidak terbaca sebagai media"), sementara
    player pun tak bisa melompat ke menit mana pun.
    """
    raw = settings.upload_dir / f"{uuid4().hex}.raw{MEETING_CONTAINER_SUFFIX}"
    dst = settings.upload_dir / f"{uuid4().hex}{MEETING_CONTAINER_SUFFIX}"
    if meeting.assemble(rid, raw) == 0:
        raw.unlink(missing_ok=True)
        raise HTTPException(422, "tidak ada audio yang diterima")
    try:
        await remux(raw, dst)
    except MediaError as exc:
        raise HTTPException(422, "hasil rekaman tidak terbaca sebagai media") from exc
    finally:
        raw.unlink(missing_ok=True)
    return dst


async def _finalize(db, rec: models.Recording, dst: Path) -> None:
    """Potongan sudah tersambung — barulah aman membuang yang mentah."""
    rec.duration_ms = await _probe_or_fail(dst, rec)
    rec.upload_path = str(dst)
    rec.upload_token = None  # sesi selesai: token tidak boleh dipakai lagi
    rec.status = JOB_QUEUED
    db.add(models.Job(recording_id=rec.id, kind=JOB_KIND_TRANSCRIBE, status=JOB_QUEUED))
    await db.commit()
    await db.refresh(rec)
    meeting.discard(rec.id)


async def _probe_or_fail(dst: Path, rec: models.Recording) -> int:
    """Gagal di sini = potongan mentah JANGAN dibuang; sesi masih bisa ditutup ulang."""
    try:
        return await probe_duration_ms(dst)
    except MediaError as exc:
        dst.unlink(missing_ok=True)
        raise HTTPException(422, "durasi rekaman tidak terbaca") from exc
