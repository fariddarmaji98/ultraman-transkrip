"""Healthcheck + info config (dipakai FE untuk panel engine)."""
from fastapi import APIRouter

from app.config import settings
from constants import MAX_UPLOAD_BYTES

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/config")
async def config() -> dict:
    is_groq = settings.asr_provider == "groq"
    return {
        "asr_provider": settings.asr_provider,
        "model": "whisper-large-v3-turbo" if is_groq else settings.local_whisper_model,
        "max_upload_mb": MAX_UPLOAD_BYTES // (1024 * 1024),
    }
