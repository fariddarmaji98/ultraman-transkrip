# Repository Guidelines

## Project Structure & Module Organization

Webapp transkrip **upload-based**: frontend web (React) mengunggah audio/video, backend (FastAPI)
mentranskrip di server, menyimpan, dan menyiapkan seam untuk fitur AI. Lihat `README.md` +
[docs/architecture/overview.md](docs/architecture/overview.md).

```
backend/            Python + FastAPI
  app/              app factory (main.py), config.py, deps.py, schemas.py, naming.py, routes/
  asr/              interface ASRProvider (base.py) + adapter local_whisper.py / groq.py
  analysis/         seam AI (base.py: stub LLMProvider/EmbeddingProvider) — belum diimplementasi
  media/            ffmpeg.py (ffprobe + ekstraksi audio 16 kHz)
  worker/           queue.py (antrean + requeue) + pipeline.py (extract → transcribe → segments)
  store/            models.py (recordings, jobs, segments) + db.py (engine async SQLite)
  export/           render.py (TXT / SRT / JSON)
  protection/       gerbang tol: middleware.py + rate_limit.py + queue_guard.py + base.py
  constants/        konstanta & default terpusat (tidak impor app/asr/analysis)
frontend/web/       React 19 + Vite + Tailwind v4 (SPA, tema gelap) — src/components/
samples/            klip validasi Indonesia (FLEURS) + fetch_fleurs_id.py (audio di-gitignore)
docs/               ADR + planning + architecture
.agent/             konfigurasi agent (skills, spec)
```

## Backend (Python + FastAPI)

- `app/`: FastAPI app factory + lifespan (init DB, start worker, requeue job pending). Route +
  pydantic schema. Endpoint: `GET /api/health`, `GET /api/config`, `POST/GET/PATCH/DELETE
  /api/recordings` (+ `/{id}/media`, `/{id}/source`, `/{id}/export`), `GET /api/jobs/{id}`.
- `asr/`: **satu interface `ASRProvider`** (`transcribe(path, language, on_progress) -> [Segment]`),
  adapter `local_whisper` (faster-whisper int8, lazy-load) & `groq`. Provider dipilih via config —
  bukan if-else provider tersebar. Provider baru → tambah adapter + entry di `get_provider()`.
- `media/`: ffmpeg via subprocess. ffprobe validasi+durasi (sinkron saat upload), ekstraksi 16 kHz mono.
- `worker/`: antrean asyncio 1 konsumen (concurrency=1). Pipeline idempoten (hapus segments lama
  sebelum tulis ulang). `requeue_pending()` melanjutkan job saat restart.
- `store/`: SQLite async (SQLAlchemy 2). `create_all` (belum Alembic). Tabel recordings/jobs/segments.
- `protection/`: middleware ASGI berlapis SEBELUM router (rate-limit global, throttle upload,
  queue-guard). Tambah pos = 1 entri di `build_protections()`; endpoint tak berubah.
- `constants/`: magic number/string terpusat. **Tidak** impor `app/`/`asr/`/`analysis/`. Lihat
  [ADR 0001](docs/adr/0001-centralized-constants.md) + [docs/architecture/constants.md](docs/architecture/constants.md).

Commands:
- `uv venv backend/.venv --python 3.11 && uv pip install --python backend/.venv/Scripts/python.exe -r backend/requirements.txt`
- Dari `backend/`: `.venv/Scripts/python -m uvicorn app.main:app --port 8000`
- Verifikasi: unggah file sampel via `POST /api/recordings` → poll `GET /api/jobs/{id}` → cek segments.

## Frontend (React + Vite + Tailwind)

- `frontend/web/` — SPA di `src/components/` (Sidebar, UploadPanel, RecordingList, TranscriptView,
  ProgressSteps, StatusBadge, ConfirmModal, dst.). Tema gelap via `@theme` Tailwind v4
  ([ADR 0004](docs/adr/0004-dark-ui-colibri.md) + [docs/architecture/ui.md](docs/architecture/ui.md)).
- Semua request lewat `/api` (diproxy Vite ke FastAPI). Klien di `src/api.js`.
- Upload via XHR (progress). Polling job untuk progress. Player `<video>`/`<audio>` dari `/source`;
  sinkron segmen via `timeupdate` + ref (tanpa re-render per tick).

Commands:
- `cd frontend/web && npm install && npm run dev` (Vite :5173, proxy `/api` → :8000).
- Verifikasi: unggah file pendek → progress → transkrip muncul → klik segmen (player seek).

## Core Workflow

Default fitur baru = **clone modul terdekat**, bukan mulai dari nol.
- Backend: clone route/handler terdekat di `app/routes/`, rename, daftarkan ke router, tambah schema,
  baru ubah logic. Provider ASR/LLM baru → adapter baru + entry factory, bukan if-else tersebar.
- Frontend: clone komponen terdekat sebelum bikin pola baru.

Jangan refactor abstraksi besar (ganti engine ASR, ganti framework, ubah struktur DB) tanpa ADR
atau permintaan user.

## Coding Style & Feature Rules

- Backend: type hints + `loguru`; satu interface `ASRProvider` (dan `LLMProvider` nanti); magic
  number → `constants/`. `constants/` tidak impor modul lain.
- **1 fungsi maksimal ~20 baris** (aturan yang dipakai konsisten di codebase ini).
- Frontend: komponen kecil, ekstrak subkomponen agar fungsi tetap kecil; styling via utility Tailwind + token `@theme`.
- Gunakan `rg` untuk cari pemakaian simbol/route/setting.

## Privasi & Etika

- Tool untuk audio yang user **berhak** transkrip.
- Mode Groq mengirim audio ke cloud; mode lokal (faster-whisper) di mesin. UI menampilkan provider aktif.
- Jangan log isi transkrip mentah ke level INFO (bisa sensitif). DEBUG + opt-in.

## Documentation & ADR

- `docs/` untuk dokumentasi fitur, planning, architecture, dan ADR.
- Buat ADR saat: pilih engine/library baru, pindah framework, ubah arsitektur FE↔BE, ubah cara
  abstraksi provider, atau menyimpang dari clone-modul. ADR terbaru: 0001–0004.

## Agent Config & Spec Workflow

```
.agent/
  skills/       ← skill files (spec-generator, documentation)
  spec/active/  ← spec fitur yang sedang dibangun (rules.md + todo.md + commits.md [+ card/apicontract])
  spec/archive/ ← spec selesai (semua commit sudah di main)
```

- Fitur baru → `spec-generator` membuat `.agent/spec/active/[nama]/`. Selesai → update `todo.md`
  (`[x]`) + `commits.md`; semua commit di `main` → pindah folder ke `archive/`.

## Testing / Verifikasi

Unit test belum jadi gate wajib (banyak logic bergantung audio/ASR live). Verifikasi default =
**jalankan komponen nyata** (backend: call endpoint + baca log; frontend: `npm run dev` + coba alur)
bukan unit test. Pahami `docs/` sebelum mengerjakan task relevan.
