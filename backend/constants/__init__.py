"""Konstanta & default terpusat (ADR 0001). Tidak mengimpor app/asr/analysis."""

# Status job & recording
JOB_QUEUED = "queued"
JOB_EXTRACTING = "extracting"
JOB_TRANSCRIBING = "transcribing"
JOB_DONE = "done"
JOB_FAILED = "failed"
JOB_DOWNLOADING = "downloading"  # sedang diunduh dari URL
JOB_DOWNLOADED = "downloaded"    # file siap, belum ditranskrip (terminal sampai user minta)
JOB_RECORDING = "recording"      # sesi meeting berjalan; ekstensi masih mengirim potongan

# TIGA himpunan berbeda — jangan disatukan. Tiap pemakai butuh jawaban berbeda
# untuk pertanyaan "sedang sibuk?", dan menyatukannya pernah jadi jebakan.
#   requeue saat startup  : butuh `downloading` (unduhan terputus dilanjutkan worker),
#                           TIDAK `recording` — sesi meeting dilanjutkan oleh ekstensinya
#                           sendiri; seluruh state-nya di disk + DB, jadi restart backend
#                           tidak memutusnya dan worker tak punya apa pun untuk dikerjakan.
#   guard tombol transkrip: semua yang sedang berjalan, termasuk `recording`.
#   guard ganti model ASR : hanya yang benar-benar memakai Whisper.
ACTIVE_STATUSES = (JOB_QUEUED, JOB_EXTRACTING, JOB_TRANSCRIBING, JOB_DOWNLOADING)
NOT_TRANSCRIBABLE_STATUSES = ACTIVE_STATUSES + (JOB_RECORDING,)
TRANSCRIBE_BUSY_STATUSES = (JOB_QUEUED, JOB_EXTRACTING, JOB_TRANSCRIBING)

# Jenis job & asal rekaman
JOB_KIND_FETCH = "fetch"
JOB_KIND_TRANSCRIBE = "transcribe"
SOURCE_UPLOAD = "upload"
SOURCE_URL = "url"
SOURCE_MEETING = "meeting"

# Batas upload & streaming
MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB
UPLOAD_CHUNK_BYTES = 1024 * 1024           # 1 MB per chunk (stream ke disk)

# Default ASR
DEFAULT_ASR_PROVIDER = "local"   # "local" (faster-whisper) | "groq"
DEFAULT_LOCAL_MODEL = "large-v3-turbo"  # validasi FLEURS-id (5 klip): turbo 5.4% < medium-id 9.5% < base 23% WER
LANGUAGE_AUTO = "auto"
DEFAULT_LANGUAGE = LANGUAGE_AUTO
GROQ_MODEL = "whisper-large-v3-turbo"  # model tetap di sisi Groq (tidak bisa dipilih)

# Bahasa yang boleh DIPILIH user — untuk mesin ASR maupun keluaran AI. Ini bukan
# daftar bahasa yang bisa DIDETEKSI: Whisper mengenal ~100, katalog ini sengaja
# pendek karena tiap entri berarti satu dropdown yang harus dibaca orang.
# `en_name` dipakai dua arah: menormalkan balasan Groq (yang mengembalikan NAMA,
# bukan kode) dan menyebut bahasa tujuan ke LLM. Kode mengikuti ISO 639-1 yang
# sama dengan `faster_whisper.tokenizer._LANGUAGE_CODES`.
LANGUAGES = (
    {"id": "id", "label": "Indonesia", "en_name": "Indonesian"},
    {"id": "en", "label": "English", "en_name": "English"},
    {"id": "ja", "label": "日本語", "en_name": "Japanese"},
    {"id": "ko", "label": "한국어", "en_name": "Korean"},
    {"id": "zh", "label": "中文", "en_name": "Chinese"},
    {"id": "ar", "label": "العربية", "en_name": "Arabic"},
    {"id": "es", "label": "Español", "en_name": "Spanish"},
    {"id": "fr", "label": "Français", "en_name": "French"},
    {"id": "de", "label": "Deutsch", "en_name": "German"},
)
LANGUAGE_BY_ID = {lang["id"]: lang for lang in LANGUAGES}
LANGUAGE_CODE_BY_NAME = {lang["en_name"].lower(): lang["id"] for lang in LANGUAGES}

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

# Chat (M3). Transkrip yang tak muat dikirim sebagian: potongan paling relevan
# dengan pertanyaan. Pemilihannya pakai pencocokan kata, bukan embedding —
# pgvector menyusul saat library sudah besar.
CHAT_CONTEXT_CHARS = 12000
CHAT_BLOCK_LINES = 25    # ukuran potongan saat transkrip harus dipilih sebagian
CHAT_HISTORY_TURNS = 6   # pesan lama yang ikut dikirim (3 tanya-jawab)
CHAT_MAX_QUESTION = 2000

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

# Tangkap audio meeting lewat ekstensi Chrome (planning meeting-capture.md).
# Potongan disimpan per-`seq` lalu disambung saat sesi ditutup — bukan di-append
# ke satu file: potongan bisa datang tak berurutan atau terkirim dua kali
# (retry), dan menyambung dari berkas ber-nomor membuat keduanya tidak merusak.
MEETING_PLATFORMS = ("meet", "zoom", "teams", "lain")
MEETING_CONTAINER_SUFFIX = ".webm"          # MediaRecorder Chrome: webm/opus
MEETING_CHUNK_SUFFIX = ".part"
MEETING_CHUNK_MAX_BYTES = 8 * 1024 * 1024   # satu potongan ~5 dtk — 8 MB sangat longgar
MEETING_MAX_BYTES = MAX_UPLOAD_BYTES        # total sesi, samakan dengan cap upload
MEETING_TOKEN_BYTES = 24                    # token sesi sekali pakai (bukan auth penuh)
# Kiri = tab (peserta), kanan = mikrofon (saya). Ini SATU-SATUNYA sumber
# pemisahan pembicara lapis 0, dan sisi ekstensi tidak bisa menjaminnya: lebar
# kanal track `MediaRecorder` tidak bisa disetir dari JS. Jadi diperiksa di sini.
MEETING_EXPECTED_CHANNELS = 2

# Umur yt-dlp sebelum dianggap basi. Extractor rusak tiap situs berubah —
# ini gotcha nomor satu di planning, jadi harus kelihatan di UI.
YTDLP_STALE_DAYS = 14

# Cookies per-platform (format Netscape cookies.txt). Diperlakukan seperti kunci
# API: disimpan server-side, isinya tidak pernah dikirim balik ke browser.
COOKIE_MAX_BYTES = 512 * 1024
COOKIE_PLATFORMS = (
    {
        "id": "instagram", "label": "Instagram", "domains": ("instagram.com",),
        "note": "Praktis wajib — tanpa cookies hampir selalu gagal.",
    },
    {
        "id": "facebook", "label": "Facebook", "domains": ("facebook.com", "fb.watch"),
        "note": "Wajib untuk konten non-publik.",
    },
    {
        "id": "youtube", "label": "YouTube", "domains": ("youtube.com", "youtu.be"),
        "note": "Membantu saat kena bot-check. Pakai akun cadangan, bukan akun utama.",
    },
    {
        "id": "tiktok", "label": "TikTok", "domains": ("tiktok.com",),
        "note": "Biasanya tidak perlu; berguna bila kena rate-limit.",
    },
    {
        "id": "twitter", "label": "X / Twitter", "domains": ("x.com", "twitter.com"),
        "note": "Opsional — cookies justru bisa memicu error CSRF. Coba tanpa dulu.",
    },
)
COOKIE_PLATFORM_IDS = tuple(p["id"] for p in COOKIE_PLATFORMS)

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
