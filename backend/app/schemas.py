"""Skema respons API (Pydantic)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from constants import DEFAULT_LANGUAGE


class SegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idx: int
    start_ms: int
    end_ms: int
    text: str
    speaker: str | None = None


class RecordingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source_filename: str
    source_kind: str
    source_url: str | None
    status: str
    duration_ms: int | None
    language: str
    created_at: datetime
    progress: int = 0  # diisi route dari job terbaru; 0 saat baru dibuat


class SummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    text: str
    provider: str
    model: str
    created_at: datetime


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    text: str
    model: str | None = None
    created_at: datetime


class ChatIn(BaseModel):
    question: str


class RecordingDetail(RecordingOut):
    source_available: bool
    media_available: bool
    segments: list[SegmentOut]
    summary: SummaryOut | None = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    status: str
    progress: int
    error: str | None


class UploadResponse(BaseModel):
    recording: RecordingOut
    job_id: int


class RenameIn(BaseModel):
    title: str


class ConfigIn(BaseModel):
    model: str


class FromUrlIn(BaseModel):
    url: str
    language: str = DEFAULT_LANGUAGE


class LlmIn(BaseModel):
    provider: str
    model: str = ""
    api_key: str | None = None  # kosong = pakai yang sudah tersimpan
