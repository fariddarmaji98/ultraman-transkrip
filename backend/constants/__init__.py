"""Konstanta & default terpusat (ADR 0001). Tidak mengimpor app/asr/analysis."""

# Status job & recording
JOB_QUEUED = "queued"
JOB_EXTRACTING = "extracting"
JOB_TRANSCRIBING = "transcribing"
JOB_DONE = "done"
JOB_FAILED = "failed"

# Batas upload & streaming
MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB
UPLOAD_CHUNK_BYTES = 1024 * 1024           # 1 MB per chunk (stream ke disk)

# Default ASR
DEFAULT_ASR_PROVIDER = "local"   # "local" (faster-whisper) | "groq"
DEFAULT_LOCAL_MODEL = "base"     # tiny|base|small|medium|large-v3|large-v3-turbo
DEFAULT_LANGUAGE = "auto"

# Target audio untuk Whisper (16 kHz mono)
ASR_SAMPLE_RATE = 16000
ASR_CHANNELS = 1

# Retensi media (transkrip tetap; media dihapus setelah N hari)
MEDIA_RETENTION_DAYS = 30

# Format media yang diterima (dikenali ffmpeg)
ACCEPTED_SUFFIXES = {
    ".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus", ".wma",
    ".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v",
}
