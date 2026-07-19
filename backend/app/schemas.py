"""Skema respons API (Pydantic)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


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
    status: str
    duration_ms: int | None
    language: str
    created_at: datetime


class RecordingDetail(RecordingOut):
    source_available: bool
    media_available: bool
    progress: int
    segments: list[SegmentOut]


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
