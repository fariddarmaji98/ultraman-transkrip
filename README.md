# Ultraman Transkrip

Tools transkrip dua sisi: **frontend** menangani **transkrip** (real-time, di sisi klien), **backend** menangani **summarize & penyimpanan** (LLM: DeepSeek API atau Ollama lokal).

Tujuan utamanya: jadi *second brain*. Kamu sering lupa hasil meeting/diskusi/video — dengan tool ini transkrip tersimpan + bisa diringkas & ditanya, lengkap dengan **referensi transkrip** sumbernya.

## Arsitektur

```
                 frontend (transkrip)                backend (summarize + store)
 ┌─────────────────────────────────┐        ┌──────────────────────────────────┐
 │ Chrome Extension (Langkah 1)     │        │ FastAPI (Python)                 │
 │  - Voice (mic, Web Speech API)   │  HTTP  │  POST /transcripts  simpan       │
 │  - Zoom / Meet (tab audio)*      │ ─────► │  POST /summarize    ringkas LLM  │
 │  - UI: tab Transkrip + Config    │ ◄───── │  POST /ask          Q&A (lanjut) │
 │                                  │ ringks │  analysis/ → DeepSeek | Ollama   │
 │ Mobile App / Flutter (Langkah 2) │        │  store/ → SQLite                 │
 └─────────────────────────────────┘        └──────────────────────────────────┘
```

\* `Zoom`/`Meet` menangkap suara lawan bicara dari tab butuh `tabCapture` + ASR on-device (Web Speech API hanya dengar mikrofon). Lihat milestone F2.

## Pembagian Tanggung Jawab

| Sisi | Tugas | Stack |
|---|---|---|
| **Frontend** | capture audio + **transkrip** real-time, tampilkan, kirim ke backend, tombol Summarize | Chrome Extension (MV3, JS) → Flutter (mobile) |
| **Backend** | **summarize** (LLM), simpan transkrip, Q&A/search (lanjut) | Python + FastAPI |

- **Lokal-first**: backend bisa pakai Ollama lokal → data tidak keluar mesin. Mode DeepSeek mengirim teks transkrip ke cloud.
- **LLM fleksibel**: provider dipilih via config backend (DeepSeek API / Ollama).
- **Bisa dicari**: transkrip tersimpan di backend, jadi bisa diringkas & ditanya ulang.

## Struktur Repo (monorepo)

```
backend/                    Python + FastAPI
  app/                      FastAPI: routes + schemas (transcripts, summarize, ask)
  analysis/                 integrasi LLM (DeepSeek / Ollama) — provider-agnostic
  prompts/                  template prompt LLM (ringkasan, Q&A)
  store/                    persistensi transkrip + metadata (SQLite)
  constants/                konstanta & default terpusat (single source of truth)
  config/                   default.yaml (provider LLM, endpoint, bahasa default)
frontend/
  chrome-extension/         Langkah 1: capture + transkrip + UI + kirim ke backend
  mobile/                   Langkah 2: aplikasi Flutter
docs/                       dokumentasi fitur & perubahan + ADR
.agent/                     konfigurasi agent (skills, spec) — lihat AGENTS.md
```

## Roadmap

Urutan dari user: **transkrip dulu via Chrome extension**, lalu mobile Flutter.

- **B0** — Backend: endpoint `/transcripts` (simpan) + `/summarize` (DeepSeek/Ollama) + SQLite.
- **F1** — Chrome extension: transkrip `Voice` (mic, Web Speech API) + UI 2 tab (Transkrip + Config bahasa) + tombol Summarize → backend.
- **F2** — Chrome extension: capture audio tab untuk Zoom/Meet (`tabCapture` + ASR on-device / scrape caption Meet).
- **B1** — Backend: Q&A/search atas transkrip tersimpan (the "second brain").
- **F3** — Aplikasi mobile Flutter: transkrip + ringkas (konsumsi backend yang sama).
- **B2** — Robustness, auth, deploy.

## Requirements

- **Backend**: Python 3.11+, DeepSeek API key **atau** Ollama lokal.
- **Frontend (chrome-extension)**: Chrome (Manifest V3). Web Speech API butuh koneksi internet.
- **Frontend (mobile)**: Flutter SDK (langkah 2).

## Project Status

Draft / scaffolding awal. Spec aktif ada di `.agent/spec/active/`.

## Catatan Privasi & Etika

- Merekam percakapan/meeting bisa terikat hukum & kebijakan consent. Pastikan kamu berhak merekam.
- Web Speech API memproses audio lewat server Google; Ollama lokal di backend menjaga ringkasan tetap di mesin. Mode DeepSeek mengirim teks transkrip ke server eksternal. Dokumentasikan trade-off saat menyentuh `analysis/`.
