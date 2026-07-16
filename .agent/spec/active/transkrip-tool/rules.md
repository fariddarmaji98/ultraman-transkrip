# Ultraman Transkrip — Spec Umbrella

Spec payung untuk keseluruhan tool. Tiap milestone punya spec sendiri (`backend-summarize`, `chrome-extension`, `mobile-flutter`).
Dokumen ini menahan keputusan arsitektur lintas-milestone.

## Main

- Tool transkrip **dua sisi**: frontend menangani **transkrip**, backend menangani **summarize + simpan**.
- Tujuan: *second brain* — transkrip tersimpan, bisa diringkas & ditanya + kutipan sumber.
- Urutan pengerjaan (dari user): **Chrome extension dulu**, lalu **mobile Flutter**.

## Pembagian Sisi

| Sisi | Tugas | Stack |
|---|---|---|
| Frontend | capture audio + transkrip real-time, tampilkan, kirim ke backend, tombol Summarize | Chrome Extension (MV3) → Flutter |
| Backend | summarize (LLM), simpan transkrip, Q&A/search (lanjut) | Python + FastAPI |

## Arsitektur

```
 frontend (transkrip)                 backend (summarize + store)
 Chrome Extension / Flutter   ──HTTP──►  FastAPI
  - capture + ASR klien                  POST /transcripts  simpan (SQLite)
  - UI tab Transkrip + Config            POST /summarize    ringkas (DeepSeek|Ollama)
  - tombol Summarize           ◄──────   POST /ask          Q&A (lanjut)
```

## Keputusan desain (default awal, bisa direvisi via ADR)

1. **Monorepo**: `backend/` + `frontend/chrome-extension/` + `frontend/mobile/` dalam repo ini.
2. **Backend**: Python + FastAPI. Selaras DeepSeek/Ollama, preferensi Python user, reuse konvensi `constants/`.
3. **LLM**: provider-agnostik di `backend/analysis/`. DeepSeek API (OpenAI-compatible) + Ollama lokal, pilih via config.
4. **Transkrip frontend**: di sisi klien.
   - Chrome extension MVP: `Voice` (mic) pakai **Web Speech API** (`SpeechRecognition`), `lang` dari setting bahasa.
   - **Batasan**: Web Speech API hanya menangkap **mikrofon**, bukan audio tab. `Zoom`/`Meet` (suara lawan bicara) butuh `chrome.tabCapture` + ASR on-device (whisper WASM) atau scrape live-caption Meet → milestone **F2**, bukan MVP.
5. **Penyimpanan**: SQLite di backend. Search full-text dulu, semantik nanti.
6. **Centralized constants** (backend): lihat `docs/adr/0001-centralized-constants.md`.

## UI (dari mockup user, 2026-06-21)

UI hidup di chrome extension popup (lalu Flutter). **2 tab**. Detail: `.agent/spec/active/chrome-extension/ui-map.md`.

- **Tab Transkrip**: 3 tombol sumber (`Voice`, `Zoom`, `Google Meet`) + area transkrip + tombol `Summarize`.
- **Tab Config**: pemilih **bahasa transkrip** (prioritas — akurasi ASR bergantung bahasa cocok) + endpoint/provider backend.
- `Zoom` & `Google Meet` capture-nya sama (tab audio) → jangan duplikasi modul; beda hanya label metadata sumber.

## Milestone (detail di README Roadmap)

- B0 — Backend summarize + store. Spec: `backend-summarize`.
- F1 — Chrome extension: Voice transkrip + UI 2 tab + Summarize. Spec: `chrome-extension`.
- F2 — Chrome extension: tab audio Zoom/Meet (tabCapture + ASR on-device).
- B1 — Backend Q&A/search.
- F3 — Mobile Flutter. Spec: `mobile-flutter`.
- B2 — Robustness, auth, deploy.

## Note

- Privasi: Web Speech API → server Google; Ollama lokal → di mesin; DeepSeek → cloud. Dokumentasikan saat menyentuh `analysis/`.
- Tiap milestone: clone modul terdekat dulu, baru ubah logic (AGENTS.md → Core Workflow).
- Transkrip file/YouTube lokal (ide awal) tidak hilang — bisa kembali sebagai endpoint backend whisper di fase lanjut, di luar scope MVP frontend-transkrip.
