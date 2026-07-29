"""Endpoint recordings: upload (streaming), unduh dari URL, list, detail, delete, export."""
import asyncio
from pathlib import Path
from typing import Annotated
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.deps import DbDep
from app.naming import clean_title, download_name
from app.schemas import (
    ChatIn,
    ChatMessageOut,
    FromUrlIn,
    RecordingDetail,
    RecordingOut,
    RenameIn,
    SegmentOut,
    SummaryOut,
    TranslationOut,
    UploadResponse,
)
import analysis
from analysis.chat import ask
from analysis.openai_compat import LLMError
from analysis.summarize import summarize
# alias: nama `get_source` sudah dipakai route penyaji file di bawah
from capture import get_source as get_media_source
from capture import CaptureError, MediaInfo, NeedsAuth, UnsupportedUrl
from constants import (
    ACCEPTED_SUFFIXES,
    CHAT_HISTORY_TURNS,
    CHAT_MAX_QUESTION,
    DEFAULT_AI_LANGUAGE,
    DOWNLOAD_MAX_DURATION_S,
    LANGUAGE_AUTO,
    LANGUAGE_BY_ID,
    JOB_DOWNLOADING,
    JOB_KIND_FETCH,
    JOB_KIND_TRANSCRIBE,
    JOB_KIND_TRANSLATE,
    JOB_QUEUED,
    MAX_UPLOAD_BYTES,
    NOT_TRANSCRIBABLE_STATUSES,
    SOURCE_URL,
    UPLOAD_CHUNK_BYTES,
)
from export.render import render_export
from media.ffmpeg import MediaError, probe_duration_ms
from store import models
from worker.queue import enqueue

router = APIRouter()

# Bahasa keluaran AI ikut sebagai query param di semua endpoint ringkasan & chat,
# termasuk yang POST: GET dan DELETE tidak bisa membawa body, dan satu konvensi
# lebih mudah diingat daripada dua.
LangQ = Annotated[str, Query(description="Bahasa keluaran AI (kode ISO dari /api/config)")]


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
    job = await _create_job(db, rec.id, JOB_KIND_TRANSCRIBE)
    await enqueue(rec.id, JOB_KIND_TRANSCRIBE)
    return UploadResponse(recording=RecordingOut.model_validate(rec), job_id=job.id)


@router.post("/recordings/from-url", response_model=UploadResponse, status_code=201)
async def create_from_url(db: DbDep, body: FromUrlIn) -> UploadResponse:
    """Probe jalan sinkron (mirip ffprobe di jalur upload) — tolak sebelum sebyte diunduh."""
    info = await _probe_url_or_reject(body.url)
    rec = await _create_url_recording(db, body, info)
    job = await _create_job(db, rec.id, JOB_KIND_FETCH)
    await enqueue(rec.id, JOB_KIND_FETCH)
    return UploadResponse(recording=RecordingOut.model_validate(rec), job_id=job.id)


@router.get("/recordings", response_model=list[RecordingOut])
async def list_recordings(db: DbDep) -> list[RecordingOut]:
    result = await db.execute(
        select(models.Recording).order_by(models.Recording.created_at.desc())
    )
    latest = await _latest_progress(db)
    return [_with_progress(r, latest.get(r.id, 0)) for r in result.scalars().all()]


@router.get("/recordings/{rid}", response_model=RecordingDetail)
async def get_recording(rid: int, db: DbDep, lang: LangQ = DEFAULT_AI_LANGUAGE) -> RecordingDetail:
    rec = await _get_or_404(db, rid)
    segments = await _segments_of(db, rid)
    progress = await _progress_of(db, rid)
    summary = await _summary_of(db, rid, _checked(lang))
    return _to_detail(rec, segments, progress, summary)


@router.post("/recordings/{rid}/summarize", response_model=SummaryOut)
async def summarize_recording(
    rid: int, db: DbDep, lang: LangQ = DEFAULT_AI_LANGUAGE
) -> models.Summary:
    """Ringkas transkrip pakai mesin AI aktif (ADR 0007). Sinkron: bisa puluhan detik."""
    await _get_or_404(db, rid)
    segments = await _segments_of(db, rid)
    if not segments:
        raise HTTPException(422, "belum ada transkrip untuk diringkas")
    cfg = analysis.resolve()
    _reject_if_llm_unset(cfg)
    text = await _run_summary(segments, cfg, _checked(lang))
    return await _save_summary(db, rid, text, cfg, lang)


@router.get("/recordings/{rid}/chat", response_model=list[ChatMessageOut])
async def list_chat(
    rid: int, db: DbDep, lang: LangQ = DEFAULT_AI_LANGUAGE
) -> list[models.ChatMessage]:
    await _get_or_404(db, rid)
    return await _chat_history(db, rid, _checked(lang))


@router.post("/recordings/{rid}/chat", response_model=ChatMessageOut)
async def send_chat(
    rid: int, body: ChatIn, db: DbDep, lang: LangQ = DEFAULT_AI_LANGUAGE
) -> models.ChatMessage:
    """Tanya transkrip. Sinkron seperti ringkasan — belasan detik (ADR 0009)."""
    await _get_or_404(db, rid)
    question = _clean_question(body.question)
    segments = await _segments_of(db, rid)
    cfg = analysis.resolve()
    _reject_if_llm_unset(cfg)
    history = await _chat_history(db, rid, _checked(lang))
    answer = await _run_chat(question, segments, history[-CHAT_HISTORY_TURNS:], cfg, lang)
    return await _save_turn(db, rid, question, answer, cfg, lang)


@router.delete("/recordings/{rid}/chat", status_code=204)
async def clear_chat(rid: int, db: DbDep, lang: LangQ = DEFAULT_AI_LANGUAGE) -> None:
    """Hanya utas bahasa ini — percakapan bahasa lain punya isi sendiri."""
    await _get_or_404(db, rid)
    await db.execute(
        delete(models.ChatMessage).where(
            models.ChatMessage.recording_id == rid,
            models.ChatMessage.lang == _checked(lang),
        )
    )
    await db.commit()


@router.post("/recordings/{rid}/translate", status_code=202)
async def start_translate(rid: int, db: DbDep, lang: LangQ) -> dict:
    """Terjemahkan transkrip ke `lang` di latar — 945 segmen tidak bisa sinkron.

    Berbeda dari ringkasan & chat yang membaca transkrip asli, ini menghasilkan
    salinan transkrip per bahasa. Status rekaman tidak berubah: transkripnya
    sudah selesai, dan ini pekerjaan sampingan.
    """
    rec = await _get_or_404(db, rid)
    _reject_if_same_language(rec, _checked(lang))
    if not await _segments_of(db, rid):
        raise HTTPException(422, "belum ada transkrip untuk diterjemahkan")
    _reject_if_llm_unset(analysis.resolve())
    job = await _create_job(db, rid, JOB_KIND_TRANSLATE, lang)
    await enqueue(rid, JOB_KIND_TRANSLATE)
    return {"job_id": job.id, "lang": lang}


@router.get("/recordings/{rid}/translation", response_model=TranslationOut)
async def get_translation(rid: int, db: DbDep, lang: LangQ) -> TranslationOut:
    """Status + progres + segmen terjemahan. `status=None` = belum pernah diminta."""
    await _get_or_404(db, rid)
    job = await _translate_job(db, rid, _checked(lang))
    rows = await _translation_rows(db, rid, lang)
    return TranslationOut(
        lang=lang,
        status=job.status if job else None,
        progress=job.progress if job else 0,
        error=job.error if job else None,
        segments=rows,
    )


@router.post("/recordings/{rid}/transcribe", response_model=RecordingOut, status_code=202)
async def start_transcribe(rid: int, db: DbDep) -> RecordingOut:
    """Jalankan transkrip untuk rekaman yang filenya sudah ada.

    Sengaja generik: dipakai untuk video hasil unduhan (`downloaded`) sekaligus
    transkrip ulang rekaman upload — mis. setelah ganti model ASR (ADR 0005).
    """
    rec = await _get_or_404(db, rid)
    _reject_if_not_transcribable(rec)
    job = await _create_job(db, rec.id, JOB_KIND_TRANSCRIBE)
    rec.status = JOB_QUEUED
    await db.commit()
    await db.refresh(rec)
    await enqueue(rec.id, JOB_KIND_TRANSCRIBE)
    return _with_progress(rec, job.progress)


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
    return FileResponse(
        rec.upload_path, filename=download_name(rec.title, rec.upload_path)
    )


@router.get("/recordings/{rid}/export")
async def export_transcript(rid: int, db: DbDep, fmt: str = "txt") -> Response:
    await _get_or_404(db, rid)
    segments = await _segments_of(db, rid)
    body, media_type = render_export(segments, fmt)
    disposition = f'attachment; filename="transkrip-{rid}.{fmt}"'
    return Response(body, media_type=media_type,
                    headers={"Content-Disposition": disposition})


# --- helpers ---------------------------------------------------------------

def _reject_if_llm_unset(cfg: dict) -> None:
    if cfg["needs_key"] and not cfg["api_key"]:
        raise HTTPException(422, "mesin AI belum punya kunci API — atur di popup Setelan")


def _clean_question(raw: str) -> str:
    question = raw.strip()
    if not question:
        raise HTTPException(422, "pertanyaan kosong")
    if len(question) > CHAT_MAX_QUESTION:
        raise HTTPException(422, f"pertanyaan melebihi {CHAT_MAX_QUESTION} karakter")
    return question


async def _chat_history(db, rid: int, lang: str) -> list[models.ChatMessage]:
    result = await db.execute(
        select(models.ChatMessage)
        .where(models.ChatMessage.recording_id == rid, models.ChatMessage.lang == lang)
        .order_by(models.ChatMessage.id)
    )
    return list(result.scalars().all())


async def _run_chat(question: str, segments, history, cfg: dict, lang: str) -> str:
    try:
        return await ask(question, segments, history, analysis.get_llm(), lang)
    except LLMError as exc:
        raise HTTPException(502, str(exc)) from exc


async def _save_turn(db, rid: int, question: str, answer: str, cfg: dict, lang: str):
    """Simpan pertanyaan dan jawaban sekaligus — riwayat tak boleh timpang."""
    db.add(models.ChatMessage(recording_id=rid, role="user", text=question, lang=lang))
    reply = models.ChatMessage(
        recording_id=rid, role="assistant", text=answer, lang=lang,
        provider=cfg["provider"], model=cfg["model"],
    )
    db.add(reply)
    await db.commit()
    await db.refresh(reply)
    return reply


async def _run_summary(segments, cfg: dict, lang: str) -> str:
    try:
        return await summarize(segments, analysis.get_llm(), lang)
    except LLMError as exc:
        raise HTTPException(502, str(exc)) from exc


async def _save_summary(db, rid: int, text: str, cfg: dict, lang: str) -> models.Summary:
    """Satu ringkasan per recording PER BAHASA — yang lama diganti, bukan ditumpuk."""
    await db.execute(
        delete(models.Summary).where(
            models.Summary.recording_id == rid, models.Summary.lang == lang
        )
    )
    row = models.Summary(
        recording_id=rid, lang=lang, text=text,
        provider=cfg["provider"], model=cfg["model"],
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError as exc:
        # Dua permintaan bareng (dua tab, atau klik kedua karena dikira tak
        # bereaksi — endpointnya sinkron puluhan detik). Tanpa ini, pemakai
        # menerima 500 berisi pesan SQLAlchemy mentah.
        await db.rollback()
        raise HTTPException(409, "ringkasan bahasa ini sedang dibuat — coba lagi") from exc
    await db.refresh(row)
    return row


def _checked(lang: str) -> str:
    """Tolak kode bahasa asing sebelum ia sempat jadi baris di DB.

    Tanpa ini, `?lang=xx` melahirkan utas chat dan ringkasan yang tidak akan
    pernah bisa dibuka lagi dari UI — pemilihnya cuma menawarkan isi katalog.
    """
    if lang not in LANGUAGE_BY_ID:
        raise HTTPException(422, f"bahasa tidak dikenal: {lang}")
    return lang


def _reject_if_not_transcribable(rec) -> None:
    if rec.status in NOT_TRANSCRIBABLE_STATUSES:
        raise HTTPException(409, "rekaman ini sedang diproses")
    if not rec.upload_path or not Path(rec.upload_path).exists():
        raise HTTPException(422, "file sumber tidak tersedia")


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


async def _probe_url_or_reject(url: str) -> MediaInfo:
    """Nama harus beda dari `_probe_or_reject` di atas — dulu keduanya sama, dan
    definisi kedua diam-diam menimpa yang pertama sehingga upload memanggil
    prober URL dengan sebuah Path (500). Import tetap sukses; hanya runtime yang
    rusak, jadi tidak ada yang menangkapnya sampai upload benar-benar dicoba."""
    try:
        info = await asyncio.to_thread(get_media_source().probe, url)
    except (UnsupportedUrl, NeedsAuth) as exc:
        raise HTTPException(422, str(exc)) from exc
    except CaptureError as exc:
        raise HTTPException(502, str(exc)) from exc
    _reject_too_large(info)
    return info


def _reject_too_large(info: MediaInfo) -> None:
    """Tolak dari hasil probe — satu URL panjang tak boleh bisa memenuhi disk."""
    if info.duration_ms and info.duration_ms > DOWNLOAD_MAX_DURATION_S * 1000:
        jam = DOWNLOAD_MAX_DURATION_S // 3600
        raise HTTPException(422, f"video terlalu panjang (maks {jam} jam)")
    if info.filesize_bytes and info.filesize_bytes > MAX_UPLOAD_BYTES:
        gb = MAX_UPLOAD_BYTES // (1024 ** 3)
        raise HTTPException(422, f"perkiraan ukuran melebihi batas {gb} GB")


async def _create_url_recording(db, body: FromUrlIn, info: MediaInfo):
    """Judul dari platform sudah bersih — jangan lewatkan ke `clean_title` (memangkas
    apa pun setelah titik terakhir, mis. "Rapat 2.0 final" jadi "Rapat 2")."""
    rec = models.Recording(
        title=info.title[:255], source_filename="", source_kind=SOURCE_URL,
        source_url=body.url, upload_path="", language=body.language,
        duration_ms=info.duration_ms, status=JOB_DOWNLOADING,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


async def _create_job(db, recording_id: int, kind: str, lang: str | None = None):
    job = models.Job(recording_id=recording_id, kind=kind, status=JOB_QUEUED, lang=lang)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


def _reject_if_same_language(rec, lang: str) -> None:
    """Bahasa sumber tidak selalu diketahui — hanya tolak bila benar-benar sama.

    Rekaman `auto` yang belum pernah dideteksi tidak punya bahasa sumber, dan
    menebaknya hanya akan menolak permintaan yang sah.
    """
    source = rec.detected_language if rec.language == LANGUAGE_AUTO else rec.language
    if source and source == lang:
        raise HTTPException(422, "transkripnya memang sudah berbahasa itu")


async def _translate_job(db, rid: int, lang: str):
    result = await db.execute(
        select(models.Job)
        .where(
            models.Job.recording_id == rid,
            models.Job.kind == JOB_KIND_TRANSLATE,
            models.Job.lang == lang,
        )
        .order_by(models.Job.id.desc())
    )
    return result.scalars().first()


async def _translation_rows(db, rid: int, lang: str):
    result = await db.execute(
        select(models.SegmentTranslation)
        .where(
            models.SegmentTranslation.recording_id == rid,
            models.SegmentTranslation.lang == lang,
        )
        .order_by(models.SegmentTranslation.idx)
    )
    return list(result.scalars().all())


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
    """Job terbaru: satu recording bisa punya `fetch` lalu `transcribe`.

    Job `translate` sengaja DIKECUALIKAN. Angka ini menggambarkan seberapa jauh
    rekaman ini diproses jadi transkrip; terjemahan berjalan setelah transkrip
    selesai dan punya endpoint progresnya sendiri. Tanpa filter ini, rekaman
    yang sudah `done` akan melaporkan progres 40% hanya karena sedang
    diterjemahkan ke bahasa lain.
    """
    result = await db.execute(
        select(models.Job.progress)
        .where(models.Job.recording_id == rid, models.Job.kind != JOB_KIND_TRANSLATE)
        .order_by(models.Job.id.desc())
    )
    return result.scalars().first() or 0


async def _latest_progress(db) -> dict[int, int]:
    """Progress job terbaru per recording — sekali query untuk seluruh daftar."""
    newest = (
        select(func.max(models.Job.id))
        .where(models.Job.kind != JOB_KIND_TRANSLATE)   # alasannya di `_progress_of`
        .group_by(models.Job.recording_id)
        .scalar_subquery()
    )
    rows = await db.execute(
        select(models.Job.recording_id, models.Job.progress)
        .where(models.Job.id.in_(newest))
    )
    return {rid: progress for rid, progress in rows.all()}


def _with_progress(rec, progress: int) -> RecordingOut:
    out = RecordingOut.model_validate(rec)
    out.progress = progress
    return out


async def _summary_of(db, rid: int, lang: str) -> models.Summary | None:
    result = await db.execute(
        select(models.Summary)
        .where(models.Summary.recording_id == rid, models.Summary.lang == lang)
        # Terbaru menang. Tanpa order_by, SQLite lazimnya memberi rowid terkecil,
        # sehingga duplikat lawas (dari sebelum indeks unik ada) membuat "buat
        # ulang" tampak tidak mengubah apa pun.
        .order_by(models.Summary.id.desc())
    )
    return result.scalars().first()


def _to_detail(rec, segments, progress: int, summary) -> RecordingDetail:
    return RecordingDetail(
        id=rec.id, title=rec.title, source_filename=rec.source_filename,
        source_kind=rec.source_kind, source_url=rec.source_url,
        status=rec.status, duration_ms=rec.duration_ms, language=rec.language,
        detected_language=rec.detected_language,
        created_at=rec.created_at, progress=progress,
        source_available=bool(rec.upload_path and Path(rec.upload_path).exists()),
        media_available=bool(rec.media_path and Path(rec.media_path).exists()),
        segments=[SegmentOut.model_validate(s) for s in segments],
        summary=SummaryOut.model_validate(summary) if summary else None,
    )


def _remove_files(rec) -> None:
    for attr in ("upload_path", "media_path"):
        value = getattr(rec, attr)
        if value:
            Path(value).unlink(missing_ok=True)
