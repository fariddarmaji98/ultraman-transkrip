# Planning — Webapp Transkrip (Upload Audio/Video → Transkrip)

> Status: **disetujui sebagai arah baru** (menggantikan desain Chrome-extension real-time — lihat [ADR 0002](../adr/0002-pivot-webapp-upload-transkrip.md)).
> Riset: Juli 2026, tiga jalur riset internet (engine ASR, repo open-source existing, arsitektur & deployment). Semua klaim harga/benchmark ada link sumbernya di bagian bawah — **cek ulang harga saat implementasi**.

## 1. Ringkasan

Aplikasi web dengan FE + BE terpisah, di-deploy online:

1. User **upload rekaman** (audio atau video, sampai ~2 GB / rekaman 1–3 jam).
2. Backend **ekstrak audio** (ffmpeg) lalu **transkripsi** (Whisper via provider yang bisa ditukar).
3. FE menampilkan **progress** lalu **transkrip per segmen + timestamp**, bisa di-export (TXT/SRT/VTT/JSON).
4. Backend didesain **extensible untuk AI**: ringkasan LLM, chat-with-transcript dengan sitasi timestamp, pencarian lintas transkrip ("second brain" — tujuan lama proyek ini tetap hidup, hanya cara transkripsinya yang pindah ke server).

Keputusan terpenting hasil riset:

| Keputusan | Pilihan | Kenapa |
|---|---|---|
| Fork vs bangun sendiri | **Bangun sendiri, contek pola** | Dua produk terdekat (Whishper, Scriberr) macet & bukan Python; nilai fork sesungguhnya ada di layer engine, bukan layer produk |
| Engine ASR | **Whisper family di balik interface `ASRProvider`** | Model baru 2025–2026 (Parakeet, Canary, Voxtral, Moonshine) **tidak support bahasa Indonesia**; Whisper large-v3 ~7,7% WER Indonesia (FLEURS) |
| Default MVP | **Groq API `whisper-large-v3-turbo` — $0.04/jam audio** | Kualitas large-v3-turbo dalam hitungan detik; self-host CPU tidak bisa menandingi kualitas+kecepatan ini di harga berapa pun |
| Fallback lokal | **faster-whisper (int8)** di worker yang sama | Privasi / Groq down; ganti provider = ganti config, bukan rewrite |
| Backend | **Python + FastAPI** | Sesuai arah repo + ekosistem AI Python paling kaya untuk pengembangan lanjut |
| Queue | **Procrastinate (Postgres-backed)** | Satu datastore untuk queue + metadata + pgvector nanti; tanpa Redis; jalan di Windows dev |
| DB | **PostgreSQL dari hari pertama** | Dibutuhkan Procrastinate; pgvector untuk RAG nanti; hindari migrasi SQLite→PG |
| FE | **React + Vite SPA** | Ekosistem terkuat untuk dua masalah UI tersulit (uploader, transcript-sync); tanpa SSR/Next karena ini app di balik tombol upload, bukan situs konten |
| Deploy | **Docker Compose di VPS murah** (Hetzner CX23 €4.49 atau IDCloudHost/Biznet) | PaaS melawan upload 2 GB & job berjam-jam; total realistis **~$7–13/bulan** |
| Layer AI | **OpenAI SDK + `base_url` configurable** | DeepSeek/Groq/Ollama/OpenRouter semua OpenAI-compatible; ganti provider = ganti env var |

## 2. Fitur

### MVP (fase M1) — "upload → transkrip, online"

- **Upload** drag & drop dengan progress bar (Uppy, mode XHR) — semua format yang ffmpeg mengerti: mp3, wav, m4a, ogg, flac, mp4, mkv, webm, mov, …
- **Ekstraksi audio otomatis** — ffmpeg → 16 kHz mono Opus ~32 kbps (~14 MB/jam) sebelum ASR.
- **Transkripsi** — default Groq `whisper-large-v3-turbo`; pilihan bahasa `auto | id | en` (preset di FE; API menerima kode ISO lain — Whisper support 99 bahasa).
- **Progress job** — status `queued → extracting → transcribing → done/failed` + persentase; FE polling tiap 2 detik.
- **Tampilan transkrip** — per segmen dengan timestamp; player audio sinkron (klik segmen → seek; segmen aktif ikut ter-highlight saat play).
- **Export** — TXT, SRT, VTT, JSON (level segmen; word-level menyusul di M4 bersama WhisperX) via pysubs2.
- **Riwayat rekaman** — daftar, buka ulang, hapus.
- **Auth sederhana** — single user + password (wajib karena online).
- **Retensi media** — file media auto-hapus setelah N hari (task periodik); transkrip disimpan selamanya (ukurannya KB).

### Fase M2 — AI tahap 1 (ringkasan)

- `POST /api/recordings/{id}/summarize` — ringkasan LLM (provider-agnostic: DeepSeek / Groq / Ollama lokal), disimpan sebagai artefak turunan (bukan respons sekali pakai).
- Template prompt di `backend/prompts/` (ringkasan umum, notulen rapat, action items).
- Judul otomatis untuk rekaman.
- SSE untuk progress + streaming token LLM (upgrade dari polling; plumbing dipakai ulang untuk chat nanti).

### Fase M3 — AI tahap 2 (second brain)

- **Chat-with-transcript** — context stuffing (transkrip 3 jam ≈ 25–45 rb token, muat di semua model modern; RAG belum perlu untuk satu transkrip), jawaban dengan **sitasi timestamp yang deep-link ke player** — fitur pembunuh transcript-RAG.
- **Pencarian lintas transkrip** — Postgres FTS dulu, lalu hybrid dengan pgvector (chunk 500–800 token di batas segmen, simpan `start_ms/end_ms` untuk sitasi).

### Fase M4 — pendalaman

- **Diarization** (label pembicara) — pyannote `speaker-diarization-community-1` via WhisperX/whisper-asr-webservice (butuh GPU/serverless) **atau** ElevenLabs Scribe (~$0.22–0.40/jam, WER Indonesia 2,4% klaim terbaik + diarization built-in). Catatan: semua proyek yang ringkasannya bagus memberi makan teks *ber-label pembicara* ke LLM — diarization mendahului investasi fitur AI lanjutan.
- **Editor transkrip** — edit teks per segmen (contenteditable per utterance, pola Whishper/Scriberr; hindari mesin word-level DraftJS/Slate — baca dulu catatan "timed-text editor domain problem" pietrop).
- **Upload resumable** (tusd sidecar) — penting untuk upstream Indonesia; putus koneksi ≠ ulang dari nol.
- **Object storage** — Cloudflare R2 (10 GB gratis, egress $0) + lifecycle rules.
- **Multi-user** — bila mulai dipakai orang lain.
- Nice-to-have: ingest URL YouTube dll (yt-dlp, subtitle-first: cek caption bawaan sebelum jalankan Whisper — pola AI-Video-Transcriber), terjemahan.

## 3. Arsitektur

```
Browser (React + Vite SPA, Uppy)
   │ 1. upload (streaming multipart)
   ▼
Caddy (TLS, serve SPA statis, proxy /api → FastAPI; tanpa limit body default)
   │
   ▼
FastAPI (container `api`)
   │ 2. stream file ke disk, buat row Recording+Job, enqueue task
   ▼
PostgreSQL ─ queue (Procrastinate) ─ metadata ─ pgvector (M3)
   │ 3. worker ambil job
   ▼
Worker (container `worker`, codebase sama, `procrastinate worker`)
   ├─ ffmpeg: ekstrak → 16 kHz mono opus/flac
   ├─ ASRProvider:
   │    • GroqProvider          (default — whisper-large-v3-turbo)
   │    • LocalWhisperProvider  (faster-whisper int8 — privasi/fallback)
   │    • WhisperXProvider      (M4 — GPU, alignment + diarization)
   ├─ tulis segments (start_ms, end_ms, text) → Postgres, update progress
   └─ (M2+) LLMProvider (OpenAI-compatible) → summary, embeddings
   │
   ▼
Browser poll GET /api/jobs/{id} tiap 2 dtk → render transkrip + player sinkron
```

Empat container compose: `caddy`, `api`, `worker`, `postgres`. Satu origin (tanpa CORS), satu sertifikat TLS, satu perintah deploy.

### Skema data (komitmen hari-1 hanya `segments` yang bersih)

- `recordings` — id, title, source_filename, media_path, duration_ms, language, status, created_at, media_expires_at
- `jobs` — id, recording_id, kind (`transcribe|summarize|embed`), status, progress (0–100), error, timestamps
- `segments` — id, recording_id, idx, start_ms, end_ms, text, speaker (nullable — diisi M4)
- `summaries` (M2) — id, recording_id, model, prompt_key, content, created_at
- `chunks` (M3) — id, recording_id, start_ms, end_ms, text, embedding vector — timestamp di chunk = bahan sitasi
- `chat_sessions` / `chat_messages` (M3)

### Struktur repo (revisi)

```
backend/
  app/            FastAPI: routes + pydantic schemas
  asr/            interface ASRProvider + adapter groq / local_whisper / (whisperx)
  analysis/       LLM provider-agnostic (M2+) — tetap satu interface
  prompts/        template prompt LLM
  media/          helper ffmpeg (probe, ekstrak, encode)
  worker/         task Procrastinate (transcribe, cleanup, summarize)
  store/          model SQLAlchemy + migrasi Alembic
  constants/      terpusat (ADR 0001) — tidak impor app/analysis
  config/         default.yaml + env
frontend/
  web/            React + Vite SPA (menggantikan chrome-extension sebagai langkah 1)
deploy/           docker-compose.yml, Caddyfile, GitHub Action ssh-deploy
docs/             planning, ADR, arsitektur
.agent/           skills + spec
```

## 4. Metode transkripsi (temuan riset engine)

**Realita bahasa Indonesia (penting):** model ASR baru yang lagi ramai justru tidak bisa dipakai — NVIDIA Parakeet/Canary hanya 25 bahasa Eropa, Mistral Voxtral 13 bahasa tanpa Indonesia, Kyutai STT hanya en/fr, Moonshine tanpa Indonesia. Leaderboard HF Open ASR juga English-centric — menyesatkan untuk kasus kita. **Whisper family tetap tulang punggung** (99 bahasa; large-v3 ~7,7% WER FLEURS-id). Dua pendatang baru yang layak dipantau: **Qwen3-ASR** (Apache-2.0, 30 bahasa termasuk Indonesia, GPU-first, tapi forced-aligner-nya belum support Indonesia) dan **Meta Omnilingual ASR** (1.600+ bahasa termasuk bahasa daerah — Jawa, Minang).

Angka WER Indonesia yang terdokumentasi:

| Model | WER Indonesia | Catatan |
|---|---|---|
| whisper-small (stock) | ~30% | terlalu lemah untuk Indonesia |
| whisper-medium (stock) | ~12% (CV-id) | |
| `cahya/whisper-medium-id` (fine-tune) | **3,83%** (CV-id) / 9,74% (FLEURS) | ada versi CTranslate2 siap pakai: `cahya/faster-whisper-medium-id` |
| whisper-large-v3 | ~7,7% (FLEURS) | |
| large-v3-turbo | ≈ large-v2, 6–8× lebih cepat, ~1,5 GB int8 | degradasi hanya dilaporkan di Thai/Kanton, bukan Indonesia |
| ElevenLabs Scribe (API) | klaim 2,4% (FLEURS) | angka Indonesia terbaik yang dipublikasikan + diarization |

Kualitas turun drastis di audio percakapan spontan/tumpang-tindih (~30% bahkan untuk model tuned) — set ekspektasi user untuk rekaman rapat ramai.

**Strategi tiga provider di balik satu interface:**

1. **`GroqProvider` (default MVP)** — `whisper-large-v3-turbo` $0.04/jam audio, ~216× real-time. Limit file 25 MB (free) / 100 MB (dev tier): ffmpeg pre-encode 16 kHz mono **Opus** ~32 kbps ⇒ ~14 MB/jam, rekaman 3 jam ≈ 43 MB = satu panggilan; fallback chunking di batas silence. (FLAC tidak bisa dipakai di sini — lossless, tak bisa target bitrate, 3 jam ≈ 150 MB+.)
2. **`LocalWhisperProvider`** — faster-whisper `compute_type=int8`, `vad_filter=True`; model configurable: `large-v3-turbo` (sweet spot CPU) / `cahya/faster-whisper-medium-id` (akurasi Indonesia) / `small` (mesin kecil). Realita CPU 4 vCPU shared: small ≈ 2–3× RT, medium ≈ ~1× RT — rekaman 3 jam bisa berjam-jam; karenanya lokal = fallback, bukan default.
3. **`WhisperXProvider` (M4)** — GPU: batching cepat, word-timestamp forced-alignment <100 ms (model alignment Indonesia tersedia), diarization pyannote terpadu.

**ffmpeg** = standar tunggal ekstraksi; panggil via `subprocess` (wrapper `ffmpeg-python` dorman, pydub tidak perlu). Perintah kanonik: `ffmpeg -i in.mp4 -vn -ac 1 -ar 16000 ...`. faster-whisper sebenarnya bisa baca mp4 langsung (PyAV), tapi pre-extract memberi kita probe durasi + normalisasi + payload kecil.

## 5. Layer AI (desain extensible — alasan utama BE dipisah)

Prinsip: **ports & adapters dari hari pertama, fiturnya belakangan.** Komitmen MVP hanya: skema `segments` yang bersih + tiga protocol:

```python
class ASRProvider:       def transcribe(path, lang) -> list[Segment]
class LLMProvider:       def complete(messages, stream=False) -> str | Iterator
class EmbeddingProvider: def embed(texts) -> list[vector]
```

- **LLM**: OpenAI SDK + `base_url` configurable — DeepSeek, Groq, Ollama, OpenRouter semua kompatibel; lokal vs cloud = swap URL (pola yang sama dipakai Scriberr/Meetily/Vibe). LiteLLM baru dipertimbangkan kalau butuh cost-tracking/fallback-routing lintas provider.
- **Ringkasan** = job Procrastinate biasa (pakai ulang seluruh mesin job/progress), hasil disimpan di `summaries` beserta model + prompt yang dipakai.
- **Chunking untuk ringkasan umumnya tak perlu di 2026** (konteks model ≥128 rb token); siapkan fallback map-reduce sebagai strategi yang bisa ditukar di `summarize(segments)`.
- **RAG**: pgvector (Postgres sudah jalan; Qdrant/Chroma baru menang di skala jauh lebih besar). Chunk di batas segmen; simpan timestamp; retrieval hybrid (vector + FTS) dengan filter `transcript_id`.
- **Kunci API selalu di server** — jangan pola client-side key (anti-pattern yang terlihat di AI-Video-Transcriber).

## 6. Deployment & biaya (verifikasi Juli 2026)

| # | Opsi | Spek | Biaya/bulan | Rekaman 3 jam selesai dalam |
|---|---|---|---|---|
| **B ★** | **VPS kecil + Groq API** | Hetzner CX23 (2 vCPU/4 GB) €4.49 + $0.04/jam audio | **~$7–13** (50–200 jam audio/bln) | **menit** |
| A | VPS CPU self-host whisper | CX33/CX43 4–8 vCPU | ~$8–14 flat | 1–6 jam, akurasi id lebih rendah |
| A3 | VPS Indonesia (latensi upload Jakarta, tagihan IDR) | Biznet Gio / IDCloudHost 4 vCPU/8 GB | ~Rp 200–400 rb | sama dengan A |
| C | VPS + serverless GPU (Modal/RunPod) large-v3 | L4 $0.80/GPU-jam, kredit gratis Modal $30/bln | VPS + ~$0.03–0.10/jam audio | 6–12 menit |
| E | PaaS (Railway/Render/Fly) | — | $7–20 | ❌ upload 2 GB & job panjang melawan limit platform |

**Rekomendasi: opsi B.** VPS Indonesia (A3) layak dipilih kalau latensi upload dari user Indonesia atau tagihan IDR penting — payload besar mengalir user→server. Provider lokal ASR bisa naik kelas ke serverless GPU (C) untuk tier privasi, tanpa mengubah kode selain config.

Operasional: Docker Compose + Caddy (TLS otomatis) + GitHub Action `ssh && docker compose up -d --build`. Backup: `pg_dump` harian + rsync media (media toh auto-expire).

## 7. Hasil riset repo existing (kenapa tidak fork)

| Proyek | Stack | Status Juli 2026 | Verdict |
|---|---|---|---|
| [Whishper](https://github.com/pluja/whishper) | Svelte + Go + Python worker, MongoDB | main **beku** sejak Sep 2024; v4 rewrite belum rilis | Skip; scope produk & arsitektur v4-nya (API + queue + worker ASR terpisah) justru validasi desain kita |
| [Scriberr](https://github.com/rishikanthc/Scriberr) | Go binary + Python sidecar, SQLite | **pause** Des 2025 | Skip fork (Go); **fitur AI-nya = spec produk de facto kita** (summarize, chat, template prompt) |
| [TranscriptionStream](https://github.com/transcriptionstream/transcriptionstream) | glue-script Python, GPU wajib, image 26 GB | dorman | Skip; ide bagus: summary sebagai pipeline stage + Meilisearch |
| [Speaches](https://github.com/speaches-ai/speaches) | Python, OpenAI-compatible ASR server | aktif, MIT | **Adopsi sebagai komponen** — opsi pengganti `LocalWhisperProvider` sebagai sidecar |
| [whisper-asr-webservice](https://github.com/ahmetoner/whisper-asr-webservice) | FastAPI, 3 engine, WhisperX+diarization | aktif, MIT | **Adopsi sebagai komponen** — jalur diarization termudah (M4) |
| [LinTO](https://github.com/linto-ai/linto-studio) | microservices enterprise | aktif | Terlalu berat utk solo dev; validasi pola arsitektur |
| [Vibe](https://github.com/thewh1teagle/vibe) / [Meetily](https://github.com/Zackriya-Solutions/meeting-minutes) | desktop Tauri | sangat aktif | Bukan webapp; referensi terbaik pola LLM multi-provider |
| [AI-Video-Transcriber](https://github.com/wendy7756/AI-Video-Transcriber) | FastAPI stateless | aktif | Contek: SSE progress + subtitle-first URL ingestion |

Komponen FE: **hyperaudio-lite** (MIT, satu-satunya yang masih aktif — viewer word-click-to-seek) untuk pola tampilan; BBC react-transcript-editor & slate-transcript-editor sudah tak terawat — jangan jadi dependency. Export: **pysubs2** (satu lib untuk SRT/VTT/ASS+, rilis Mar 2026, bisa load output Whisper langsung).

## 8. Roadmap milestone

| Milestone | Isi | Kriteria selesai |
|---|---|---|
| **M0 — fondasi** | Scaffold monorepo baru: compose (caddy/api/worker/postgres), FastAPI skeleton, Procrastinate wiring, model DB + Alembic, constants/config | `docker compose up` → healthcheck hijau; job dummy jalan lewat queue |
| **M1 — MVP transkrip** (spec aktif: [webapp-transkrip-mvp](../../.agent/spec/active/webapp-transkrip-mvp/rules.md)) | Upload → ffmpeg → Groq/lokal → segments → FE: upload UI, progress polling, tampilan transkrip + player sinkron, export, riwayat, auth sederhana, cleanup retention | Upload mp4 1 jam dari browser → transkrip id akurat < 5 menit **dihitung sejak upload selesai** (durasi upload tergantung koneksi user) → export SRT valid |
| **M2 — AI ringkasan** | LLMProvider, `/summarize`, prompts, judul otomatis, SSE | Ringkasan + action items tersimpan & tampil di FE |
| **M3 — second brain** | FTS, embeddings + pgvector, chat dengan sitasi timestamp → seek player | Tanya "kapan X dibahas?" → jawaban + klik → player lompat |
| **M4 — pendalaman** | Diarization, editor segmen, tusd resumable, R2, (multi-user) | Label pembicara di transkrip & ringkasan per pembicara |
| **M5 — go online** *(bisa maju setelah M1)* | VPS + Caddy TLS + CI deploy + backup | URL publik dipakai dari HP/laptop mana pun |

Catatan urutan: M5 (deploy) sengaja bisa langsung setelah M1 — "ku upload online" adalah bagian dari ide inti, jangan ditunda di belakang fitur AI.

## 9. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Groq berubah harga/limit/tutup | Interface provider + fallback lokal sudah jalan dari hari-1; kandidat pengganti terpetakan (OpenAI $0.18–0.36/jam, Deepgram ~$0.26, ElevenLabs ~$0.22–0.40) |
| Audio rapat ramai → WER jelek | Ekspektasi di UI; M4 diarization + eksperimen `cahya/faster-whisper-medium-id`; benchmark dengan audio sendiri |
| Upload 2 GB putus di tengah | MVP: batasi & kompres di klien tidak realistis → segera M4 tusd resumable; sementara: pesan error jelas + retry |
| VPS 4 GB kehabisan RAM saat fallback lokal | Model int8 + `small` untuk mesin kecil; concurrency worker = 1 |
| Rekaman berisi data sensitif | Retensi media N hari, transkrip tidak di-log level INFO (aturan repo), tier privasi = provider lokal |
| Scope creep fitur AI | Komitmen hari-1 hanya skema segments + 3 protocol; fitur AI selalu fase terpisah |

## 10. Privasi & etika

- Mode Groq/DeepSeek mengirim **audio/teks ke cloud** — tampilkan jelas di UI provider mana yang aktif; tier privasi = LocalWhisperProvider + Ollama.
- Aturan repo tetap berlaku: hanya untuk audio yang user **berhak** rekam; jangan log isi transkrip di INFO.
- Auto-delete media default N hari; transkrip milik user, bisa dihapus kapan pun.

## 11. Sumber utama

Engine & bahasa Indonesia: [faster-whisper](https://github.com/SYSTRAN/faster-whisper) · [WhisperX](https://github.com/m-bain/whisperX) · [whisper-large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo) · [cahya/whisper-medium-id](https://huggingface.co/cahya/whisper-medium-id) · [cahya/faster-whisper-medium-id](https://huggingface.co/cahya/faster-whisper-medium-id) · [evaluasi ASR Indonesia (arXiv 2410.08828)](https://arxiv.org/html/2410.08828v1) · [ElevenLabs id benchmark](https://elevenlabs.io/speech-to-text/indonesian) · [Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) · [Meta Omnilingual ASR](https://arxiv.org/abs/2511.09690) · [pyannote community-1](https://huggingface.co/pyannote/speaker-diarization-community-1)
API & harga: [Groq STT](https://console.groq.com/docs/speech-to-text) · [OpenAI pricing](https://developers.openai.com/api/docs/pricing) · [Deepgram Nova-3 id](https://deepgram.com/learn/deepgram-expands-nova-3-with-italian-turkish-norwegian-and-indonesian-support) · [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) · [Modal](https://modal.com/pricing) · [RunPod](https://www.runpod.io/pricing) · [Hetzner 2026](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/) · [Biznet Gio](https://www.biznetgio.com/pricelist) · [IDCloudHost](https://idcloudhost.com/pricing/) · [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
Arsitektur: [Procrastinate](https://github.com/procrastinate-org/procrastinate) · [survei task queue 2026](https://aleksul.space/posts/choosing-python-task-queue-library/) · [Uppy](https://uppy.io/docs/guides/choosing-uploader/) · [tusd](https://github.com/tus/tusd) · [polling/SSE/WS](https://dev.to/benriemer/stop-defaulting-to-websockets-a-practical-guide-to-sse-polling-and-knowing-when-you-actually-nln) · [MinIO maintenance mode](https://www.infoq.com/news/2025/12/minio-s3-api-alternatives/) · [pgvector vs vector DB 2026](https://jangwook.net/en/blog/en/vector-db-comparison-2026-qdrant-chroma-pgvector/) · [pysubs2](https://github.com/tkarabela/pysubs2) · [hyperaudio-lite](https://github.com/hyperaudio/hyperaudio-lite) · [sinkron transkrip-audio React](https://www.metaview.ai/resources/blog/syncing-a-transcript-with-audio-in-react) · [timed-text editor domain problem](https://github.com/pietrop/slate-transcript-editor/blob/master/docs/guides/the-timed-text-editor-domain-problem.md)
Repo existing: lihat tabel §7 (link inline).
