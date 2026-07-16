# Webapp Transkrip MVP — M0+M1

Breakdown teknis milestone M0 (fondasi) + M1 (MVP transkrip) dari [planning](../../../../docs/planning/webapp-upload-transkrip.md). Fitur AI (summarize/chat) BUKAN scope spec ini — hanya seams-nya (interface + skema) yang disiapkan.

## Main

- fitur: upload audio/video → job transkripsi async → transkrip per segmen + player sinkron + export
- modul baru: `backend/{app,asr,analysis,media,worker,store,constants,config}`, `frontend/web/`, `deploy/`
- referensi clone: tidak ada (scaffold baru); pola dari planning §3
- opsional di ujung M1: deploy awal ke VPS (item M5 di todo) — boleh maju karena "online" bagian dari ide inti

## Stack

- BE: Python 3.11+ / FastAPI / SQLAlchemy 2 + Alembic / Procrastinate (queue, Postgres-backed) / loguru
- DB: PostgreSQL 16 — image `pgvector/pgvector:pg16` (pgvector sudah siap untuk M3, hindari ganti image nanti)
- ASR: interface `ASRProvider` di `backend/asr/base.py`
  - `GroqProvider` (default): `whisper-large-v3-turbo`, response `verbose_json` (segment timestamps)
  - `LocalWhisperProvider`: faster-whisper, model dari config (`large-v3-turbo` int8 default; `cahya/faster-whisper-medium-id` opsi id; `small` mesin kecil), `vad_filter=True`
  - provider dipilih via config; error Groq (rate limit / 5xx / network) → retry job, lalu fallback lokal jika diaktifkan
- Media: ffmpeg via subprocess (`backend/media/`). **ffprobe jalan sinkron saat upload** (validasi → 422 bila bukan media, isi `duration_ms` di response 201); ekstraksi di worker: `-vn -ac 1 -ar 16000` → **Opus ~32 kbps** (~14 MB/jam — FLAC tidak bisa: lossless tanpa target bitrate; rekaman 3 jam ≈ 43 MB muat limit Groq 100 MB; >itu chunk di batas silence)
- FE: React + Vite SPA di `frontend/web/`; Uppy (mode XHR) untuk upload; player `<audio>` + sinkron segmen via `timeupdate` + refs (tanpa re-render React per tick)
- Deploy: `deploy/docker-compose.yml` — caddy (TLS+serve `frontend/web/dist`+proxy `/api`), api, worker, postgres

## Store

- tabel aplikasi: `recordings`, `jobs`, `segments` (kolom di planning §3; `speaker` nullable — diisi M4) + tabel internal Procrastinate
- migrasi: Alembic dari hari-1; `segments` ditulis bulk per recording, idempoten (hapus lama sebelum tulis ulang)

## Endpoint / Interface

(detail request/response di [apicontract.md](apicontract.md))

- `GET /api/health` → healthcheck (tanpa auth)
- `POST /api/auth/login` → session cookie (single user, password dari env)
- `POST /api/recordings` (multipart, stream ke disk per ~1 MB chunk, cap 2 GB; ffprobe sinkron) → 201 `{recording, job_id}`; enqueue `transcribe`
- `GET /api/recordings` / `GET /api/recordings/{id}` (+segments) / `DELETE /api/recordings/{id}`
- `GET /api/jobs/{id}` → `{status, progress, error}` — FE poll 2 dtk
- `GET /api/recordings/{id}/export?format=txt|srt|vtt|json` — via pysubs2
- `GET /api/recordings/{id}/media` — serve audio hasil ekstraksi utk player (range requests)

## Worker

- task `transcribe(recording_id)`: status `extracting` → ffmpeg → `transcribing` → ASRProvider → tulis `segments` bulk → `done`; gagal → `failed` + `error`, retry ≤ 2
- progress: rumus timestamp-segmen-terakhir ÷ durasi hanya berlaku utk provider lokal/chunked (segmen datang bertahap); Groq satu panggilan = progress kasar per fase (0 → selesai)
- task periodik harian `cleanup`: hapus file media dgn `media_expires_at < now` (transkrip tetap), hapus upload yatim > 24 jam
- concurrency worker = 1 (RAM VPS 4 GB)

## Config / Constants

- `backend/constants/`: format yang diterima, cap ukuran, model default per provider, retensi default (mis. 30 hari), path media
- `config/default.yaml` + env: `ASR_PROVIDER`, `GROQ_API_KEY`, `LOCAL_WHISPER_MODEL`, `DATABASE_URL`, `AUTH_PASSWORD`, `MEDIA_RETENTION_DAYS`
- ADR 0001 tetap: constants tidak impor app/analysis

## Recovery

- upload bukan media / ffprobe gagal → 422 + pesan jelas; file dihapus
- file > cap → 413 (Caddy limit > cap agar error dari app, bukan proxy)
- Groq gagal setelah retry → fallback lokal (jika on) atau `failed` dgn pesan actionable
- api/worker restart di tengah job → job Procrastinate di-retry, task idempotent (hapus segments lama recording tsb sebelum tulis ulang)
- FE: poll dapat `failed` → tampilkan error + tombol coba lagi

## Note

- Komitmen "AI-ready" di spec ini HANYA: skema `segments` bersih (start_ms/end_ms/text/speaker-nullable) + protocol `ASRProvider` (di `asr/base.py`) + stub `LLMProvider`/`EmbeddingProvider` (di `analysis/base.py`, sesuai peta layer planning §3); implementasi LLM = M2.
- Playback: verifikasi Opus jalan di `<audio>` iOS Safari (dukungan Ogg/Opus baru di Safari terbaru); bila bermasalah, sediakan copy m4a/AAC khusus playback.
- Jangan log isi transkrip di INFO (aturan repo).
- UI tampilkan provider aktif (Groq = audio ke cloud; lokal = di mesin).
- Dev di Windows: Procrastinate jalan native, tapi utamakan docker compose agar dev ≈ prod; ffmpeg wajib ada di image worker.
- Verifikasi akhir M1: upload mp4 1 jam ber-bahasa Indonesia dari browser → transkrip akurat < 5 menit **sejak upload selesai** (Groq; durasi upload di luar kendali sistem) → export SRT kebaca player video.
