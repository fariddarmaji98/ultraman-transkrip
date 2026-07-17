# Todo — Webapp Transkrip MVP (M0+M1)

Scope sesi ini (permintaan user): **cukup sampai transkrip**, clean code, tanpa over-engineering,
tes di kedua sisi. Deviasi terukur dari spec dicatat di `rules.md` §"Status implementasi".

## Selesai (MVP lokal, teruji end-to-end)

- [x] scaffold monorepo: `backend/` (FastAPI) + `frontend/web/` (React+Vite)
- [x] backend skeleton: app factory, loguru, `GET /api/health`; pin `python-multipart`/`starlette`
- [x] `store/`: model SQLAlchemy `recordings`/`jobs`/`segments` (SQLite, `create_all`)
- [x] `constants/` + `app/config.py` (pydantic-settings, env `TRANSKRIP_*`)
- [x] `media/ffmpeg.py`: ffprobe durasi+validasi, ekstraksi 16 kHz mono
- [x] `asr/base.py` protocol `ASRProvider`; stub `LLMProvider`/`EmbeddingProvider` di `analysis/base.py`
- [x] `asr/local_whisper.py`: faster-whisper int8, model dari config, lazy-load
- [x] `asr/groq.py`: provider Groq (verbose_json → segments) — ditulis, aktif bila `GROQ_API_KEY` diset
- [x] worker: antrean in-process 1 konsumen + task `transcribe` (status/progress/idempoten)
- [x] route: recordings (upload streaming + ffprobe sinkron, list, detail, delete), jobs, export (txt/srt/json), serve media (Range)
- [x] FE: upload (XHR + progress), daftar rekaman, halaman transkrip (polling, segmen+timestamp, player sinkron timeupdate+ref, klik→seek), export, hapus
- [x] recovery: 422 non-media, 422 suffix, 413 cap, status `failed`
- [x] uji BE: happy path + export SRT/JSON + media Range 206 + error 422/404 (curl)
- [x] uji FE via browser internal: load, view, seek+highlight, upload lewat UI, badge live, delete, 0 error console

## Deviasi terukur (disederhanakan untuk scope transkrip-saja — lihat rules.md)

- [~] Postgres+pgvector → **SQLite** (Docker absen; pgvector di luar scope, pindah saat M3)
- [~] Procrastinate → **antrean in-process** (worker satu proses dgn API; pisah proses saat online)
- [~] Alembic → **`create_all`** (cukup untuk SQLite MVP)
- [~] auth login → **ditunda** (lokal; wajib sebelum M5 online)
- [~] docker-compose/Caddy → **ditunda** (dev pakai uvicorn + vite proxy)
- [~] ekstraksi Opus utk limit Groq → saat ini **WAV 16 kHz**; encode Opus saat Groq jadi default

## Belum / lanjutan (di luar sesi ini)

- [ ] task periodik `cleanup` retensi media (kolom `media_expires_at` ada di rencana, belum dipakai)
- [ ] auth + docker-compose + Caddy + deploy VPS (M5)
- [ ] uji audio Indonesia nyata (validasi WER) + uji file panjang (1 jam)
- [ ] indikator provider aktif di UI (Groq=cloud / lokal=mesin)
