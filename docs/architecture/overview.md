# Arsitektur — Ikhtisar Sistem (as-built)

Referensi teknis sistem transkrip **seperti yang benar-benar dibangun** sekarang (bukan rencana
penuh — lihat penyederhanaan di §9). Pelengkap: [constants](constants.md), [ui](ui.md),
[ADR 0002 pivot](../adr/0002-pivot-webapp-upload-transkrip.md).

## 1. Ringkasan

Webapp upload-based: browser mengunggah audio/video → FastAPI menyimpan file, membuat job,
worker in-process mengekstrak audio (ffmpeg) lalu mentranskrip (faster-whisper lokal atau Groq),
menyimpan segmen ke SQLite. Frontend mem-poll status dan menampilkan transkrip + player tersinkron.

## 2. Alur request (upload → transkrip)

```
Browser ──POST /api/recordings (multipart, streaming)──► FastAPI
   │                                                        │ ffprobe (validasi + durasi, sinkron)
   │                                                        │ simpan file, buat Recording + Job(queued)
   │                                                        │ enqueue(recording_id) → antrean asyncio
   │◄──────────── 201 { recording, job_id } ───────────────┘
   │
   │  worker_loop (1 konsumen):
   │    Job.status extracting → media/ffmpeg: ekstrak 16 kHz mono
   │    Job.status transcribing → asr.get_provider().transcribe(...)  (progress 30→90 lokal)
   │    tulis segments (bulk, idempoten) → Job.status done
   │
   └──GET /api/jobs/{id} (poll 2 dtk)──► { status, progress } ; saat done → GET /api/recordings/{id}
```

Status: `queued → extracting → transcribing → done | failed`. Gagal → `failed` + pesan, retry ≤ 2.
Saat startup, `requeue_pending()` meng-antre ulang recording yang belum selesai (antrean in-process
hilang saat restart) — jadi job tidak nyangkut.

## 3. Modul backend

| Modul | Isi | Catatan |
|---|---|---|
| `app/` | `main.py` (app factory + lifespan), `config.py` (settings env `TRANSKRIP_*`), `deps.py` (sesi DB), `schemas.py`, `naming.py` (bersihkan judul dari nama file), `routes/` | lifespan: init DB → start worker → requeue |
| `asr/` | `base.py` (protocol `ASRProvider` + `Segment`), `local_whisper.py`, `groq.py`, `__init__.get_provider()` | interface tunggal; lokal lapor progres per-segmen |
| `analysis/` | `base.py` (Protocol `LLMProvider` async / `EmbeddingProvider`), `openai_compat.py` (adapter httpx), `__init__.resolve()`/`get_llm()` | satu jalur OpenAI-compatible untuk Ollama/Groq/DeepSeek/Claude/OpenAI ([ADR 0007](../adr/0007-mesin-ai-dipilih-dari-ui.md)); pemakainya (ringkasan M2) menyusul |
| `media/` | `ffmpeg.py`: `probe_duration_ms`, `extract_audio` | subprocess asyncio |
| `worker/` | `queue.py` (antrean, `enqueue`, `pending_count`, `requeue_pending`), `pipeline.py` (`run_transcribe`) | concurrency=1; poller progres via holder thread-safe |
| `store/` | `models.py` (Recording, Job, Segment), `db.py` (engine async + `init_db`/create_all) | SQLite (`aiosqlite`) |
| `export/` | `render.py`: TXT / SRT / JSON | tanpa dependency tambahan |
| `protection/` | middleware ASGI + pos proteksi | lihat §6 |
| `constants/` | konstanta terpusat (status, batas, default, format) | tidak impor modul lain (ADR 0001) |

## 4. Data model (SQLite)

- **recordings** — `id, title, source_filename, upload_path, media_path, duration_ms, language,
  status, created_at`. (`source_url`/`source_kind` menyusul saat fitur video-downloader.)
- **jobs** — `id, recording_id, kind, status, progress (0–100), error, created_at`. Satu job
  transkripsi per recording (MVP).
- **segments** — `id, recording_id, idx, start_ms, end_ms, text, speaker (nullable)`. `speaker`
  diisi saat diarization (M4). Ditulis bulk, idempoten.

## 5. ASR provider

Interface `ASRProvider.transcribe(audio_path, language, on_progress=None) -> list[Segment]`:
- **`LocalWhisperProvider`** — faster-whisper (CTranslate2, `compute_type=int8`, CPU), model dari
  config (default `large-v3-turbo`; opsi `cahya/faster-whisper-medium-id`, `base`). Lazy-load
  (dimuat saat job lokal pertama), lapor progres per-segmen (fase transkripsi → 30–90%).
- **`GroqProvider`** — `whisper-large-v3-turbo` via API OpenAI-compatible (`verbose_json`). Aktif
  bila `TRANSKRIP_ASR_PROVIDER=groq` + `TRANSKRIP_GROQ_API_KEY`.
- Pemilihan via `get_provider()` (config). Ekstraksi ffmpeg & pipeline sama untuk semua provider —
  ganti provider = ganti env, bukan rewrite. Akurasi Indonesia divalidasi (`samples/`): turbo 5,4% <
  cahya-medium-id 9,5% < base 23% WER (FLEURS-id).

## 6. Gerbang tol proteksi

`ProtectionMiddleware` (ASGI) jalan **sebelum router** (di dalam CORS), menjalankan rantai pos
berurutan; gagal salah satu → 429 sebelum menyentuh disk/ffmpeg/ASR:

```
request → CORS → posA RateLimit(60/mnt/IP) → posB RateLimit(12/10mnt, upload) → posC QueueGuard(20) → router
```

Hanya membaca header/method/path (aman untuk upload streaming). In-memory (single-instance MVP).
Tambah pos = 1 entri di `build_protections()`.

## 7. API

| Method & path | Fungsi |
|---|---|
| `GET /api/health` | healthcheck |
| `GET /api/config` | info provider/model/limit + katalog model lokal (panel Engine FE) |
| `PATCH /api/config` | ganti model lokal — 422 di luar katalog, 409 saat Groq/ada job jalan ([ADR 0005](../adr/0005-model-asr-runtime.md)) |
| `POST /api/recordings` | upload (multipart streaming) → 201 `{recording, job_id}` |
| `GET /api/recordings` | daftar (terbaru dulu) |
| `GET /api/recordings/{id}` | detail + segments + `progress`, `source_available` |
| `PATCH /api/recordings/{id}` | rename judul |
| `DELETE /api/recordings/{id}` | hapus (media + transkrip) |
| `GET /api/recordings/{id}/media` | audio hasil ekstraksi (Range) |
| `GET /api/recordings/{id}/source` | file asli (video/audio) untuk player (Range) |
| `GET /api/recordings/{id}/export?fmt=txt\|srt\|json` | ekspor transkrip |
| `GET /api/jobs/{id}` | status + progress (poll FE) |
| `GET /api/llm` | katalog mesin AI + provider aktif + `key_set` (nilai kunci tidak pernah dikirim) |
| `PATCH /api/llm` | simpan provider/model/kunci — 422 provider tak dikenal |
| `POST /api/llm/test` | ping provider sungguhan → `{ok, detail}` (gagal tetap 200) |
| `DELETE /api/llm/{provider}/key` | lupakan kunci tersimpan |

## 8. Frontend

React + Vite + Tailwind (tema gelap, [ui.md](ui.md)). Semua request lewat `/api` (proxy Vite).

Halaman detail = **workspace 3 kolom** ([ADR 0006](../adr/0006-workspace-tiga-kolom.md)):
`Sidebar` (upload + panel Engine + statistik + riwayat) │ `AiPanel` (ringkasan + chat — masih
dikunci sampai M2/M3) │ `SourcePanel` (player + `ProgressSteps`/`ProgressBar` + `SegmentList`).
`TranscriptHeader` membentang di atas dua kolom kanan. Lebar sidebar & kolom kanan bisa digeser
(`hooks/usePanelWidth.js` + `ResizeHandle`, tersimpan di `localStorage`).

Komponen pendukung: `ModelPicker` (ganti model), `StatusBadge` (ikon status), `ConfirmModal`
(konfirmasi hapus). Klik segmen → player seek; sinkron via `timeupdate`+ref.

## 9. Penyederhanaan sadar (vs rencana penuh)

Dibangun sebagai MVP lokal; deviasi terukur & reversibel (detail di
`.agent/spec/active/webapp-transkrip-mvp/rules.md`):

- **SQLite** (bukan Postgres+pgvector) — pgvector menyusul saat RAG (M3).
- **Antrean asyncio in-process** (bukan Procrastinate/Redis) — worker satu proses dgn API.
- **`create_all`** (bukan Alembic).
- **Belum ada auth** — wajib sebelum online.
- **Belum ada docker-compose/Caddy** — dev pakai uvicorn + Vite proxy.

## 10. Dokumen terkait

Planning: [webapp transkrip](../planning/webapp-upload-transkrip.md) · [arah Colibri](../planning/colibri-direction.md) ·
[video downloader](../planning/video-downloader.md). ADR: [0001](../adr/0001-centralized-constants.md)–[0007](../adr/0007-mesin-ai-dipilih-dari-ui.md).
