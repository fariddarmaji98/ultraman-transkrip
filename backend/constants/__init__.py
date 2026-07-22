"""Konstanta & default terpusat (ADR 0001). Tidak mengimpor app/asr/analysis."""

# Status job & recording
JOB_QUEUED = "queued"
JOB_EXTRACTING = "extracting"
JOB_TRANSCRIBING = "transcribing"
JOB_DONE = "done"
JOB_FAILED = "failed"
JOB_DOWNLOADING = "downloading"  # sedang diunduh dari URL
JOB_DOWNLOADED = "downloaded"    # file siap, belum ditranskrip (terminal sampai user minta)

# Dua himpunan berbeda — jangan disatukan (spec video-downloader §Status):
#   requeue butuh `downloading`; guard model ASR tidak (mengunduh tak memakai Whisper).
ACTIVE_STATUSES = (JOB_QUEUED, JOB_EXTRACTING, JOB_TRANSCRIBING, JOB_DOWNLOADING)
TRANSCRIBE_BUSY_STATUSES = (JOB_QUEUED, JOB_EXTRACTING, JOB_TRANSCRIBING)

# Jenis job & asal rekaman
JOB_KIND_FETCH = "fetch"
JOB_KIND_TRANSCRIBE = "transcribe"
SOURCE_UPLOAD = "upload"
SOURCE_URL = "url"

# Batas upload & streaming
MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB
UPLOAD_CHUNK_BYTES = 1024 * 1024           # 1 MB per chunk (stream ke disk)

# Default ASR
DEFAULT_ASR_PROVIDER = "local"   # "local" (faster-whisper) | "groq"
DEFAULT_LOCAL_MODEL = "large-v3-turbo"  # validasi FLEURS-id (5 klip): turbo 5.4% < medium-id 9.5% < base 23% WER
DEFAULT_LANGUAGE = "auto"
GROQ_MODEL = "whisper-large-v3-turbo"  # model tetap di sisi Groq (tidak bisa dipilih)

# Model lokal yang boleh dipilih dari UI. Ukuran = perkiraan unduhan int8 (sekali saja).
LOCAL_MODEL_CHOICES = (
    {"id": "base", "label": "Base", "size": "~145 MB", "note": "tercepat, akurasi rendah"},
    {"id": "small", "label": "Small", "size": "~480 MB", "note": "cepat, akurasi sedang"},
    {"id": "medium", "label": "Medium", "size": "~1,5 GB", "note": "seimbang"},
    {"id": "large-v3-turbo", "label": "Large v3 Turbo", "size": "~1,6 GB", "note": "terbaik untuk Indonesia"},
    {"id": "large-v3", "label": "Large v3", "size": "~3,1 GB", "note": "paling akurat, paling lambat"},
    {"id": "cahya/faster-whisper-medium-id", "label": "Medium-ID", "size": "~1,5 GB", "note": "fine-tune Indonesia"},
)
LOCAL_MODEL_IDS = tuple(m["id"] for m in LOCAL_MODEL_CHOICES)

# --- LLM (ringkasan & chat, M2/M3) -----------------------------------------
# Semua provider dipanggil lewat satu jalur OpenAI-compatible (`/chat/completions`),
# jadi menambah provider = satu entri di sini, bukan adapter baru.
DEFAULT_LLM_PROVIDER = "ollama"  # default lokal: privat, tanpa kunci, sejalan ASR lokal
LLM_PROVIDERS = (
    {
        "id": "ollama", "label": "Ollama (lokal)", "base_url": "http://localhost:11434/v1",
        "default_model": "llama3.1", "needs_key": False,
        "note": "Jalan di mesin sendiri — teks tidak keluar. Perlu Ollama terpasang.",
    },
    {
        "id": "groq", "label": "Groq", "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile", "needs_key": True,
        "note": "Paling cepat, ada tier gratis. Teks dikirim ke cloud Groq.",
    },
    {
        "id": "deepseek", "label": "DeepSeek", "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat", "needs_key": True,
        "note": "Murah dengan context panjang — cocok transkrip 30+ menit.",
    },
    {
        "id": "anthropic", "label": "Claude (Anthropic)", "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-sonnet-5", "needs_key": True,
        "note": "Kualitas ringkasan paling rapi. Lewat endpoint OpenAI-compatible.",
    },
    {
        "id": "openai", "label": "OpenAI", "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini", "needs_key": True,
        "note": "Umum dan stabil.",
    },
)
LLM_PROVIDER_IDS = tuple(p["id"] for p in LLM_PROVIDERS)
LLM_TIMEOUT_S = 120  # transkrip panjang butuh waktu; jangan putus di tengah
LLM_TEST_TIMEOUT_S = 20  # tombol "tes koneksi" harus cepat gagal

# Ringkasan (M2). Batas konservatif: Ollama lokal sering hanya 8k context,
# jadi potongan dibuat aman untuk provider terkecil, bukan yang terbesar.
SUMMARY_CHUNK_CHARS = 12000
SUMMARY_MAX_CHUNKS = 12  # >12 potongan: transkrip dipangkas, dan itu diberitahukan

# Target audio untuk Whisper (16 kHz mono)
ASR_SAMPLE_RATE = 16000
ASR_CHANNELS = 1

# Retensi media (transkrip tetap; media dihapus setelah N hari)
MEDIA_RETENTION_DAYS = 30

# Unduhan dari URL (yt-dlp)
DOWNLOAD_MAX_HEIGHT = 720          # cap resolusi — hemat disk, cukup untuk ditonton
DOWNLOAD_MAX_DURATION_S = 4 * 3600  # tolak saat probe, sebelum sebyte pun diunduh

# Jeda acak antar unduhan. Burst dari satu IP paling cepat memancing rate-limit
# platform; acak supaya polanya tidak seragam seperti bot.
FETCH_GAP_MIN_S = 3
FETCH_GAP_MAX_S = 10

# Umur yt-dlp sebelum dianggap basi. Extractor rusak tiap situs berubah —
# ini gotcha nomor satu di planning, jadi harus kelihatan di UI.
YTDLP_STALE_DAYS = 14

# Format media yang diterima (dikenali ffmpeg)
ACCEPTED_SUFFIXES = {
    ".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus", ".wma",
    ".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v",
}

# Gerbang tol proteksi anti-spam (in-memory; single-instance MVP)
RATE_LIMIT_MAX = 60           # posA: maks permintaan per IP
RATE_LIMIT_WINDOW_S = 60      #       dalam 60 detik
UPLOAD_LIMIT_MAX = 12         # posB: maks unggahan per IP
UPLOAD_LIMIT_WINDOW_S = 600   #       dalam 10 menit
QUEUE_MAX_PENDING = 20        # posC: tolak unggah bila antrean transkrip >= ini
