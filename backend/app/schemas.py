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


class TranslatedSegmentOut(BaseModel):
    """Hanya `idx` + teks: waktunya tetap milik `SegmentOut`, jangan disalin.

    Dua sumber kebenaran untuk waktu yang sama adalah cara termudah membuat
    terjemahan dan aslinya diam-diam menunjuk menit yang berbeda.
    """

    model_config = ConfigDict(from_attributes=True)

    idx: int
    text: str


class TranslationOut(BaseModel):
    lang: str
    status: str | None = None      # None = belum pernah diminta
    progress: int = 0
    error: str | None = None
    segments: list[TranslatedSegmentOut] = []


class RecordingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source_filename: str
    source_kind: str
    source_url: str | None
    status: str
    duration_ms: int | None
    language: str                        # yang DIMINTA ("auto" bila dideteksi)
    detected_language: str | None = None  # yang TERDENGAR; None bila belum pernah dideteksi
    created_at: datetime
    progress: int = 0  # diisi route dari job terbaru; 0 saat baru dibuat


class SummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lang: str          # bahasa TULISAN ringkasan, bukan bahasa rekamannya
    text: str
    provider: str
    model: str
    created_at: datetime


class ExtractItemOut(BaseModel):
    text: str
    at_ms: int


class ExtractOut(BaseModel):
    """Hasil ekstraksi terstruktur. `recording_id` & `lang` disertakan supaya
    klien bisa memvalidasi hasilnya milik rekaman/bahasa yang diminta."""

    recording_id: int
    lang: str
    decisions: list[ExtractItemOut]
    requirements: list[ExtractItemOut]
    constraints: list[ExtractItemOut]
    open_questions: list[ExtractItemOut]
    auto_tags: list[str] = []   # topik dari LLM (ADR 0018)
    labels: list[str] = []      # label manual user (ADR 0018)
    provider: str
    model: str
    created_at: datetime


class LabelsIn(BaseModel):
    """Body PUT /recordings/{rid}/labels — list baru menggantikan seluruhnya."""

    labels: list[str]


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
    extract: "ExtractOut | None" = None
    labels: list[str] = []


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


class MeetingStartIn(BaseModel):
    platform: str = "lain"          # meet | zoom | teams | lain
    title: str = ""                 # kosong = diberi judul dari platform + tanggal
    language: str = DEFAULT_LANGUAGE
    url: str | None = None          # URL meeting, sekadar jejak


class MeetingSessionOut(BaseModel):
    """Balasan mulai-sesi. `upload_token` dipegang ekstensi untuk mengirim potongan."""

    recording_id: int
    upload_token: str


class LlmIn(BaseModel):
    provider: str
    model: str = ""
    api_key: str | None = None  # kosong = pakai yang sudah tersimpan
    base_url: str | None = None  # hanya untuk provider custom
