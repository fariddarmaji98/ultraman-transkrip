# Ultraman Transkrip

Webapp transkrip: **unggah audio/video → dapat transkrip**. Frontend web (React) + backend
(FastAPI) yang mentranskrip di server, menyimpan hasilnya, dan didesain untuk dikembangkan dengan
fitur AI (ringkasan, chat, "second brain").

> Arah lama (chrome-extension real-time) sudah di-pivot ke webapp upload-based — lihat
> [ADR 0002](docs/adr/0002-pivot-webapp-upload-transkrip.md). Rencana pengembangan besar
> (jadi asisten meeting ala Colibri) di [docs/planning/colibri-direction.md](docs/planning/colibri-direction.md).

## Apa yang bisa

- **Unggah** audio/video (mp3, wav, m4a, mp4, mkv, webm, …) → transkrip per-segmen + timestamp.
- **Player tersinkron**: tonton video / dengar audio; klik segmen → player lompat ke waktu itu.
- **Progress**: stepper tahap (Antre → Ekstrak → Transkrip → Selesai) + bar persen.
- **Riwayat**: semua transkrip tersimpan (SQLite), bisa dibuka ulang, rename judul, hapus.
- **Ekspor**: TXT / SRT / JSON.
- **Provider ASR bisa ditukar**: faster-whisper lokal (default) atau Groq API — ganti lewat env.
- **Model bisa dipilih dari UI**: dropdown di panel Engine (`base` … `large-v3`), tersimpan lintas
  restart, terkunci saat ada transkrip berjalan ([ADR 0005](docs/adr/0005-model-asr-runtime.md)).
- **Workspace 3 kolom**: riwayat │ asisten AI (menyusul M2/M3) │ player + transkrip; lebar panel
  bisa digeser ([ADR 0006](docs/adr/0006-workspace-tiga-kolom.md)).
- **Mesin AI dipilih dari popup Setelan**: Ollama lokal, Groq, DeepSeek, Claude, OpenAI — satu jalur
  OpenAI-compatible, lengkap dengan tes koneksi ([ADR 0007](docs/adr/0007-mesin-ai-dipilih-dari-ui.md)).
- **Unduh video dari URL**: tempel link → video (maks 720p) masuk arsip dan bisa ditonton; transkrip
  dijalankan terpisah. TikTok & X paling mulus, YouTube kadang minta login
  ([ADR 0008](docs/adr/0008-video-downloader-dua-langkah.md)).
- **Ringkasan AI**: ringkasan + poin utama + poin aksi dari transkrip, lewat mesin AI pilihanmu.
  Transkrip panjang dipotong dan digabung otomatis ([ADR 0009](docs/adr/0009-ringkasan-transkrip.md)).
- **Bahasa Indonesia divalidasi**: `large-v3-turbo` ~5,4% WER pada FLEURS-id (lihat `samples/`).

## Arsitektur (saat ini)

```
   Browser — React + Vite + Tailwind (tema gelap)
      │  /api (proxy Vite → FastAPI)
      ▼
   FastAPI  ── gerbang tol proteksi (rate-limit + throttle upload + queue-guard) ── router
      │            │ upload → simpan ke disk, buat Recording+Job, enqueue
      ▼            ▼
   SQLite     Worker in-process (antrean 1 konsumen)
   (recordings, ├─ ffmpeg: ekstrak audio 16 kHz mono
    jobs,       ├─ ASRProvider: faster-whisper lokal | Groq API
    segments)   └─ tulis segments, update progress
```

Alur: `upload → ffprobe (validasi+durasi) → ffmpeg extract → ASRProvider → segments`. Status job:
`queued → extracting → transcribing → done | failed`. Job yang belum selesai **di-antre ulang
otomatis saat restart**.

## Stack

| Bagian | Teknologi |
|---|---|
| Frontend | React 19 + Vite + Tailwind v4 (SPA, tema gelap — [ADR 0004](docs/adr/0004-dark-ui-colibri.md)) |
| Backend | Python 3.11 + FastAPI + SQLAlchemy 2 (async) |
| DB / queue | SQLite + antrean asyncio in-process (worker 1 konsumen) |
| ASR | faster-whisper (CTranslate2, lokal, default `large-v3-turbo`) · Groq `whisper-large-v3-turbo` |
| Media | ffmpeg (subprocess) |
| Proteksi | middleware ASGI berlapis ("gerbang tol") sebelum router |

## Struktur repo

```
backend/            Python + FastAPI
  app/              app factory, config, routes (health, recordings, jobs), schemas, naming
  asr/              interface ASRProvider + adapter local_whisper / groq
  analysis/         seam AI (stub LLM/Embedding) — untuk ringkasan/chat nanti
  media/            helper ffmpeg (probe, ekstrak)
  worker/           antrean + pipeline transkripsi
  store/            model SQLAlchemy + engine (recordings, jobs, segments)
  export/           render TXT / SRT / JSON
  protection/       gerbang tol: rate-limit, throttle upload, queue-guard
  constants/        konstanta terpusat (ADR 0001)
frontend/web/       React + Vite + Tailwind SPA
samples/            klip validasi Indonesia (FLEURS) + skrip regen (audio di-gitignore)
docs/               ADR + planning + architecture (lihat index di bawah)
.agent/             konfigurasi agent (skills, spec) — lihat AGENTS.md
```

## Menjalankan (dev)

Butuh: Python 3.11 (disarankan lewat [uv](https://github.com/astral-sh/uv)), Node 20+, **ffmpeg** di PATH.

Backend:
```
uv venv backend/.venv --python 3.11
uv pip install --python backend/.venv/Scripts/python.exe -r backend/requirements.txt
cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Frontend (terminal lain):
```
cd frontend/web && npm install && npm run dev      # Vite di :5173, proxy /api → :8000
```
Buka http://localhost:5173.

## Konfigurasi (env `TRANSKRIP_*`)

| Env | Default | Fungsi |
|---|---|---|
| `TRANSKRIP_ASR_PROVIDER` | `local` | `local` (faster-whisper) atau `groq` |
| `TRANSKRIP_LOCAL_WHISPER_MODEL` | `large-v3-turbo` | model lokal; `base` utk tes cepat, `cahya/faster-whisper-medium-id` utk id. **Bila diset, mengunci pilihan dropdown UI** (env > `data/runtime.json` > default) |
| `TRANSKRIP_GROQ_API_KEY` | — | wajib bila provider `groq` |
| `TRANSKRIP_DATA_DIR` | `data` | lokasi DB + upload + media |
| `TRANSKRIP_MEDIA_RETENTION_DAYS` | `30` | retensi media (transkrip tetap) |
| `TRANSKRIP_LLM_PROVIDER` | `ollama` | mesin AI ringkasan/chat: `ollama`, `groq`, `deepseek`, `anthropic`, `openai`. **Bila diset, mengunci pilihan di popup Setelan** |
| `TRANSKRIP_LLM_MODEL` | — | kosong = model default provider |
| `TRANSKRIP_LLM_API_KEY` | — | kunci untuk provider aktif; menang atas kunci yang disimpan dari UI |
| `TRANSKRIP_LLM_BASE_URL` | — | override endpoint provider aktif (mis. Ollama di host lain) |

> **Kunci API dari popup Setelan disimpan plaintext di `data/runtime.json`.** `data/` sudah masuk
> `.gitignore` dan nilainya tidak pernah dikirim balik ke browser (hanya flag `key_set`), tapi untuk
> deployment sungguhan pakai `TRANSKRIP_LLM_API_KEY` lewat env, bukan disimpan lewat UI.

## Status & roadmap

MVP transkrip **jalan & teruji** (lokal). Beberapa penyederhanaan sadar dari rencana penuh (SQLite
bukan Postgres, antrean in-process bukan Procrastinate, **belum ada auth**, belum ada docker-compose)
— didokumentasikan di `.agent/spec/active/webapp-transkrip-mvp/rules.md`.

Arah berikutnya (planning tersedia): ringkasan + action item AI (M2) → chat/search "second brain"
(M3) → **asisten meeting real-time ala Colibri** ([planning](docs/planning/colibri-direction.md)) ·
**video downloader** ingest URL sosmed ([planning](docs/planning/video-downloader.md)) · auth + deploy online.

## Dokumentasi

- Arsitektur: [architecture/overview.md](docs/architecture/overview.md) · [constants](docs/architecture/constants.md) · [ui](docs/architecture/ui.md)
- Keputusan (ADR): [0001 constants](docs/adr/0001-centralized-constants.md) · [0002 pivot webapp](docs/adr/0002-pivot-webapp-upload-transkrip.md) · [0003 modular monolith](docs/adr/0003-modular-monolith-not-microservices.md) · [0004 UI gelap](docs/adr/0004-dark-ui-colibri.md) · [0005 model runtime](docs/adr/0005-model-asr-runtime.md) · [0006 workspace 3 kolom](docs/adr/0006-workspace-tiga-kolom.md) · [0007 mesin AI dari UI](docs/adr/0007-mesin-ai-dipilih-dari-ui.md) · [0008 video downloader](docs/adr/0008-video-downloader-dua-langkah.md) · [0009 ringkasan](docs/adr/0009-ringkasan-transkrip.md)
- Rencana: [webapp transkrip](docs/planning/webapp-upload-transkrip.md) · [arah Colibri](docs/planning/colibri-direction.md) · [video downloader](docs/planning/video-downloader.md)

## Privasi & etika

- Mode Groq mengirim audio ke cloud; mode lokal (faster-whisper) memproses di mesin. UI menampilkan
  provider aktif.
- Hanya untuk audio yang kamu **berhak** transkrip. Jangan log isi transkrip di level INFO.
- Media auto-hapus setelah N hari (default 30); transkrip milikmu, bisa dihapus kapan pun.
