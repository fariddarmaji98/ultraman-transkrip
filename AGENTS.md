# Repository Guidelines

## Project Structure & Module Organization

**Monorepo dua sisi.** Frontend menangani **transkrip** (real-time di klien), backend menangani **summarize & penyimpanan** (LLM). Lihat arsitektur di `README.md`.

```
backend/                    Python + FastAPI — summarize, store, Q&A
  app/                      FastAPI: routes + schemas
  analysis/                 integrasi LLM (DeepSeek / Ollama), provider-agnostic
  prompts/                  template prompt LLM
  store/                    persistensi transkrip + metadata (SQLite)
  constants/                konstanta & default terpusat (single source of truth)
  config/                   default.yaml
frontend/
  chrome-extension/         Langkah 1: MV3 — capture + transkrip + UI + client backend
  mobile/                   Langkah 2: Flutter
docs/                       dokumentasi + ADR
.agent/                     konfigurasi agent (skills, spec)
```

Urutan pengerjaan (dari user): **Chrome extension dulu**, lalu **mobile Flutter**. Backend `/summarize` menyusul/paralel karena tombol Summarize butuh itu.

## Backend (Python + FastAPI)

- `app/`: FastAPI app. Route + pydantic schema. Endpoint inti: `POST /transcripts` (simpan), `POST /summarize` (ringkas), `POST /ask` (Q&A — lanjut).
- `analysis/`: integrasi LLM provider-agnostic. DeepSeek API (OpenAI-compatible) **atau** Ollama lokal, dipilih via config. **Satu interface**, bukan if-else provider tersebar.
- `prompts/`: template prompt LLM (ringkasan, Q&A). Jangan hardcode prompt panjang di logic.
- `store/`: SQLite — transkrip + metadata + (index pencarian lanjut).
- `constants/`: magic number/string (endpoint, model default, bahasa default, path) terpusat. Tidak mengimpor `app/`/`analysis/`. Lihat `docs/adr/0001-centralized-constants.md` + `docs/architecture/constants.md`.
- `config/`: `default.yaml` override runtime; default-nya dari `constants/`.

Commands:
- `python -m venv .venv && .venv\Scripts\activate`
- `pip install -r backend/requirements.txt`
- `uvicorn app.main:app --reload` (dari `backend/`) — jalankan API.
- Verifikasi: panggil `POST /summarize` dengan transkrip sampel + amati respons + log.

## Frontend — Chrome Extension (Langkah 1)

- Manifest V3: `manifest.json`, service worker (`background/`), popup UI (`popup/`), options (`options/`), `content/` (inject ke halaman Meet bila perlu), `lib/` (wrapper transkrip + client backend).
- **Transkrip di sisi klien.** `Voice` = mikrofon via Web Speech API (`SpeechRecognition`), real-time, `lang` dari setting bahasa.
- **Batasan penting**: Web Speech API **hanya** menangkap mikrofon, bukan audio tab. `Zoom`/`Meet` (suara lawan bicara) butuh `chrome.tabCapture` + ASR on-device (whisper WASM) atau scrape live-caption Meet — itu milestone F2, jangan diklaim selesai di F1.
- UI 2 tab: `Transkrip` (3 tombol sumber + area transkrip + tombol Summarize) dan `Config` (pemilih bahasa = prioritas, lalu provider/endpoint backend). Lihat `.agent/spec/active/chrome-extension/ui-map.md`.
- `Summarize` → POST transkrip ke backend `/summarize` → tampilkan ringkasan.
- Simpan setting di `chrome.storage`. Jangan hardcode endpoint backend di banyak tempat — satu modul config.

Commands:
- Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → `frontend/chrome-extension/`.
- Verifikasi: rekam suara pendek lewat `Voice` → transkrip muncul → Summarize → ringkasan dari backend.

## Frontend — Mobile (Flutter, Langkah 2)

- Aplikasi Flutter mengonsumsi backend yang sama. Transkrip via speech-to-text plugin (on-device/platform), ringkas via backend `/summarize`.
- Mulai setelah chrome extension + backend stabil. Detail spec menyusul (`mobile-flutter`).

## Core Workflow

Default untuk fitur baru adalah **clone modul terdekat**, bukan mulai dari nol.

- **Backend**: clone route/handler existing terdekat di `app/`, rename konsisten, daftarkan ke router, tambah schema, baru ubah logic. Provider LLM baru → tambah adapter di `analysis/` + entry di `constants/`.
- **Chrome extension**: clone komponen/handler terdekat (mis. tombol sumber, panel) sebelum bikin pola baru.

Jangan refactor abstraksi besar (ganti engine ASR, ganti framework) tanpa ADR atau permintaan user.

## Coding Style & Feature Rules

- Backend: type hints + `loguru`, satu interface LLM di `analysis/`, magic number → `constants/`. `constants/` tidak impor `app/`/`analysis/`.
- Chrome extension: modul kecil, satu sumber = satu handler; config endpoint backend & bahasa terpusat (jangan tersebar).
- Prompt LLM panjang → `prompts/`, bukan inline string.
- Gunakan `rg` untuk cari pemakaian simbol/route/setting.

## Privasi & Etika

- Tool untuk audio yang user **berhak** rekam. Jangan tambah fitur merekam diam-diam pihak lain.
- Web Speech API memproses audio via server Google; Ollama lokal (backend) menjaga ringkasan di mesin; DeepSeek mengirim teks transkrip ke cloud. Dokumentasikan saat menyentuh `analysis/`.
- Jangan log isi transkrip mentah ke level INFO default; bisa sensitif. DEBUG + opt-in.

## Documentation & ADR

- `docs/` untuk dokumentasi fitur, perubahan, dan ADR.
- Buat ADR saat: pilih library/engine baru (ASR on-device, vector store), pindah framework, ubah arsitektur frontend↔backend, ubah cara abstraksi provider LLM, atau menyimpang dari clone-modul.

## Testing

Unit test belum jadi gate wajib (banyak logic bergantung audio/LLM live). Verifikasi manual: backend lewat call endpoint sampel + log; extension lewat load unpacked + rekam pendek. Jika user minta test, batasi ke unit feasible (parsing, formatting, adapter LLM dengan mock) dan jelaskan gap.

# Agent Config

Semua file konfigurasi agent ada di `.agent/`:

```
.agent/
  skills/       ← skill files (dibaca agent sesuai konteks)
  context/      ← referensi konteks
  spec/
    active/     ← spec fitur yang sedang dibangun
    archive/    ← spec fitur yang sudah selesai (semua commit sudah di main)
```

## Skills

| Skill | File | Kapan Dipakai |
|---|---|---|
| `spec-generator` | `.agent/skills/spec-generator/SKILL.md` | Generate folder spec fitur baru secara interaktif |
| `documentation` | `.agent/skills/documentation/SKILL.md` | Dokumentasi perubahan atau fitur baru |

## Spec Workflow

- Mulai fitur baru → `spec-generator` membuat `.agent/spec/active/[nama-fitur]/`.
- File spec: **selalu** `rules.md` + `todo.md` + `commits.md`; **opsional** `card.md` (task mentah) + `apicontract.md` (jika sentuh API — backend endpoint, DeepSeek/Ollama).
- Task selesai → update `todo.md` (`[x]`) + tambah commit ke `commits.md`.
- Semua commit fitur masuk `main` → pindahkan folder ke `.agent/spec/archive/`.

## Catatan Verifikasi

- Pahami `docs/` sebelum mengerjakan task relevan.
- Verifikasi default = jalankan komponen nyata (call endpoint / load extension) + baca log, bukan unit test.
- Jangan blokir task hanya karena test/linter belum sehat repo-wide.
