"""Healthcheck + info config (panel engine di FE) + ganti model lokal."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app import runtime
from app.config import settings
from app.deps import DbDep
from app.schemas import ConfigIn
from constants import (
    ACTIVE_STATUSES,
    GROQ_MODEL,
    LOCAL_MODEL_CHOICES,
    LOCAL_MODEL_IDS,
    MAX_UPLOAD_BYTES,
)
from store import models

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/config")
async def config() -> dict:
    return _payload()


@router.patch("/config")
async def update_config(body: ConfigIn, db: DbDep) -> dict:
    """Ganti model lokal. Ditolak saat provider Groq atau ada transkrip berjalan."""
    if settings.asr_provider == "groq":
        raise HTTPException(409, "model dikunci oleh provider Groq")
    if body.model not in LOCAL_MODEL_IDS:
        raise HTTPException(422, "model tidak dikenal")
    if await _active_count(db):
        raise HTTPException(409, "ada transkrip berjalan — tunggu sampai selesai")
    runtime.set_local_model(body.model)
    return _payload()


def _payload() -> dict:
    is_groq = settings.asr_provider == "groq"
    return {
        "asr_provider": settings.asr_provider,
        "model": GROQ_MODEL if is_groq else settings.local_whisper_model,
        "max_upload_mb": MAX_UPLOAD_BYTES // (1024 * 1024),
        "models": [] if is_groq else list(LOCAL_MODEL_CHOICES),
    }


async def _active_count(db) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(models.Recording)
        .where(models.Recording.status.in_(ACTIVE_STATUSES))
    )
    return result.scalar_one()
