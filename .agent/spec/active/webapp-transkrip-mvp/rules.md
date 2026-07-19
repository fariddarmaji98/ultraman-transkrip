# Webapp Transkrip MVP — M0+M1

Breakdown teknis milestone M0 (fondasi) + M1 (MVP transkrip) dari [planning](../../../../docs/planning/webapp-upload-transkrip.md). Fitur AI (summarize/chat) BUKAN scope spec ini — hanya seams-nya (interface + skema) yang disiapkan.

## Main

- fitur: upload audio/video → job transkripsi async → transkrip per segmen + player sinkron + export
- modul baru: `backend/{app,asr,analysis,media,worker,store,protection,constants,config}`, `frontend/web/`, `deploy/`
- referensi clone: tidak ada (scaffold baru); pola dari planning §3
- opsional di ujung M1: deploy awal ke VPS (item M5 di todo) — boleh maju karena "online" bagian dari ide inti

## Stack

- BE: Python 3.11+ / FastAPI / SQLAlchemy 2 + Alembic / Procrastinate (queue, Postgres-backed) / loguru
  - pin `python-multipart >= 0.0.12` (parser multipart pasca-perbaikan performa) & `starlette >= 0.39` (dukungan HTTP Range utk serve media) — hasil audit bahasa/stack
- DB: PostgreSQL 16 — image `pgvector/pgvector:pg16` (pgvector sudah siap untuk M3, hindari ganti image nanti)
- ASR: interface `ASRProvider` di `backend/asr/base.py`
  - `GroqProvider` (default): `whisper-large-v3-turbo`, response `verbose_json` (segment timestamps)
  - `LocalWhisperProvider`: faster-whisper, model dari config (`large-v3-turbo` int8 default — ~1,5 GB RAM terukur, muat di VPS 4 GB; `cahya/faster-whisper-medium-id` opsi id; `small` mesin kecil), `vad_filter=True`; **lazy-load** model saat job lokal pertama, jangan saat startup
  - provider dipilih via config; error Groq (rate limit / 5xx / network) → retry job, lalu fallback lokal jika diaktifkan
- Media: ffmpeg via subprocess (`backend/media/`). **ffprobe jalan sinkron saat upload** (validasi → 422 bila bukan media, isi `duration_ms` di response 201); ekstraksi di worker: `-vn -ac 1 -ar 16000` → **Opus ~32 kbps** (~14 MB/jam — FLAC tidak bisa: lossless tanpa target bitrate; rekaman 3 jam ≈ 43 MB muat limit Groq 100 MB; >itu chunk di batas silence)
- FE: React 19 + Vite + **Tailwind v4** (`@tailwindcss/vite`) SPA di `frontend/web/`; upload via XHR (progress bar); player `<audio>` + sinkron segmen via `timeupdate` + refs (tanpa re-render React per tick)
- Deploy: `deploy/docker-compose.yml` — caddy (TLS+serve `frontend/web/dist`+proxy `/api`), api, worker, postgres

## Store

- tabel aplikasi: `recordings`, `jobs`, `segments` (kolom di planning §3; `speaker` nullable — diisi M4) + tabel internal Procrastinate
- migrasi: Alembic dari hari-1; `segments` ditulis bulk per recording, idempoten (hapus lama sebelum tulis ulang)

## Endpoint / Interface

(detail request/response di [apicontract.md](apicontract.md))

- `GET /api/health` → healthcheck (tanpa auth)
- `GET /api/config` → info engine (provider, model, batas upload) untuk panel Engine di FE
- `POST /api/auth/login` → session cookie (single user, password dari env)
- `POST /api/recordings` (multipart, stream ke disk per ~1 MB chunk via `request.stream()` + async file I/O — **jangan** `await file.read()` penuh atau sync I/O di route async; cap 2 GB; ffprobe sinkron) → 201 `{recording, job_id}`; enqueue `transcribe`
- `GET /api/recordings` / `GET /api/recordings/{id}` (+segments) / `DELETE /api/recordings/{id}`
- `GET /api/jobs/{id}` → `{status, progress, error}` — FE poll 2 dtk
- `GET /api/recordings/{id}/export?fmt=txt|srt|json` — render sendiri (`export/render.py`)
- `GET /api/recordings/{id}/media` — serve audio hasil ekstraksi (range requests)
- `GET /api/recordings/{id}/source` — serve file asli (video/audio) untuk player + tonton video (range)
- detail recording juga mengembalikan `source_filename`, `source_available`, `progress` (dari job)

## Worker

- task `transcribe(recording_id)`: status `extracting` → ffmpeg → `transcribing` → ASRProvider → tulis `segments` bulk → `done`; gagal → `failed` + `error`, retry ≤ 2
- progress: rumus timestamp-segmen-terakhir ÷ durasi hanya berlaku utk provider lokal/chunked (segmen datang bertahap); Groq satu panggilan = progress kasar per fase (0 → selesai)
- task periodik harian `cleanup`: hapus file media dgn `media_expires_at < now` (transkrip tetap), hapus upload yatim > 24 jam
- concurrency worker = 1 (RAM VPS 4 GB)
- worker SELALU proses/container terpisah dari api — model ASR & kerja berat tidak pernah tinggal di proses web (RSS Python tidak turun setelah spike; API tetap ringan)

## Proteksi (gerbang tol) — `backend/protection/`

Middleware ASGI `ProtectionMiddleware` jalan **sebelum router** (di dalam CORS), menjalankan rantai
pos berurutan. Request harus lolos semua pos baru masuk fitur; gagal salah satu → 429 langsung,
fitur (disk/ffmpeg/ASR) tak tersentuh.

    request → CORS → posA(rate global) → posB(throttle upload) → posC(antrean) → router → fitur

- **posA `RateLimit`** — `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_S` (60/60 dtk) per IP, semua request. Sliding window in-memory (deque per IP).
- **posB `RateLimit(match=is_upload)`** — `UPLOAD_LIMIT_MAX`/`UPLOAD_LIMIT_WINDOW_S` (12/10 mnt) khusus `POST /recordings` (jalur mahal).
- **posC `QueueGuard`** — tolak upload bila `pending_count() ≥ QUEUE_MAX_PENDING` (20).
- Tambah pos baru (API-key, blokir IP, dst.) = 1 entri di `build_protections()`; endpoint/fitur tak berubah.
- Middleware hanya baca header/method/path (tak menyentuh body) → aman untuk upload streaming besar.
- In-memory = single-instance MVP; multi-instance → pindahkan state ke Redis.
- Teruji: posA balas 429 mulai request ke-61/menit; posB balas 429 ("terlalu banyak unggahan") setelah 12 upload.

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

## Status implementasi (per 2026-07-18) — deviasi terukur

Dibangun sebagai **MVP lokal transkrip-saja** atas permintaan user ("cukup transkrip", tanpa
over-engineering). Docker tidak tersedia di mesin dev → infra berat ditunda. Deviasi dari spec
target di atas, semua **reversibel** dan tidak mengubah kontrak API:

| Spec target | Implementasi MVP | Alasan | Kapan naik ke target |
|---|---|---|---|
| PostgreSQL + pgvector | SQLite (`aiosqlite`) | pgvector/queue di luar scope transkrip | M3 (RAG) |
| Procrastinate (queue Postgres) | Antrean in-process 1 konsumen (`worker/queue.py`) | tanpa Docker/Redis/Postgres | saat butuh durabilitas lintas-restart / worker terpisah |
| Alembic | `Base.metadata.create_all` | cukup untuk SQLite MVP | saat pindah Postgres |
| Worker proses terpisah | 1 proses dgn API (model lazy-load, ASR di thread) | dev lokal; GIL dilepas CTranslate2 → API tetap responsif | M5 (online) |
| Auth single-user | belum ada | lokal, mempermudah tes | **wajib sebelum M5 online** |
| docker-compose + Caddy | uvicorn + Vite proxy `/api` | dev | M5 |
| Ekstraksi Opus (limit Groq) | WAV 16 kHz mono (`pcm_s16le`) | default lokal; browser bisa play WAV | saat Groq jadi default (file panjang perlu Opus < 100 MB) |
| pysubs2 | render SRT/VTT sendiri (`export/render.py`, ~20 baris) | hindari dependency utk 3 format sederhana | jika butuh ASS/format lanjut |

Yang **tetap dijaga** sesuai spec: interface `ASRProvider` (Groq + lokal), seam `analysis/base.py`,
skema `segments` bersih, streaming upload + ffprobe sinkron, rider pin `python-multipart`/`starlette`,
kualitas kode (1 fungsi ≤ 20 baris).

### Tambahan sesi ini (di atas spec awal)

- **Frontend Tailwind v4** — `index.css` = `@import "tailwindcss"`, semua styling via utility class; build produksi OK (CSS 16 KB).
- **Gerbang tol proteksi** (`backend/protection/`, lihat §Proteksi) — anti-spam berlapis sebelum router.
- **Default model lokal → `large-v3-turbo`** — hasil validasi FLEURS id (5 klip, WER dinormalisasi): turbo **5,4%** < `cahya-medium-id` 9,5% < `base` 23%. Sampel audio + transkrip acuan + skrip regen di `samples/` (audio di-gitignore, CC-BY FLEURS).
- **UI player + progress**: area konten menampilkan detail (judul/file/durasi) → **player video/audio dari `/source`** (nonton video asli, `<video>` utk .mp4/.mkv/…, `<audio>` utk audio) → progress bar saat diproses → transkrip di bawah. Progress bar upload (XHR) + progress transkripsi (lokal inkremental 30-90% per segmen; Groq kasar). Klik segmen → seek player. Teruji dgn video Indonesia 28 mnt (945 segmen).
- **Requeue saat startup** (`requeue_pending`): recording status `queued/extracting/transcribing` di-antre ulang saat app start → tidak nyangkut setelah restart (antrean in-process). Task idempoten.
- **Redesign UI gelap (ala Colibri)**: tema `@theme` Tailwind (mint/near-black), layout sidebar padat (brand/upload/engine/statistik/riwayat) + area utama, ikon status & hapus, dua UI progres (stepper + bar), endpoint `/api/config`. Detail: [ADR 0004](../../../../docs/adr/0004-dark-ui-colibri.md) + [docs/architecture/ui.md](../../../../docs/architecture/ui.md).

## Menjalankan (dev)

- Backend: `uv venv backend/.venv --python 3.11` → `uv pip install -r backend/requirements.txt` →
  dari `backend/`: `.venv\Scripts\python -m uvicorn app.main:app --port 8000`
- Frontend: dari `frontend/web/`: `npm install` → `npm run dev` (Vite di :5173, proxy `/api` → :8000)
- Provider ASR: default lokal `large-v3-turbo` (unduh ~1,5 GB saat job pertama; untuk tes cepat
  set `TRANSKRIP_LOCAL_WHISPER_MODEL=base`). Untuk Groq: set `TRANSKRIP_ASR_PROVIDER=groq` +
  `TRANSKRIP_GROQ_API_KEY=...`.
- Validasi Indonesia (opsional): `pip install datasets soundfile jiwer` lalu jalankan
  `samples/fetch_fleurs_id.py` untuk regen sampel.
