# Rules Dokumentasi Fitur

Gunakan panduan ini saat user meminta dokumentasi fitur baru atau modul existing yang belum terdokumentasi.

## Workflow

1. Tentukan sisi fitur: **backend** (`backend/app|analysis|store`) atau **frontend** (`frontend/chrome-extension|mobile`)
2. Baca modul utama yang relevan + wiring-nya (route ↔ analysis ↔ store, atau UI ↔ lib transkrip ↔ client backend)
3. Pahami flow: transkrip (frontend) → kirim → simpan/ringkas (backend)
4. Cek config/constants + kontrak endpoint (`apicontract.md` spec terkait)
5. Tulis dokumentasi dalam Bahasa Indonesia dan Inggris

## Output Default

```text
docs/[nama-fitur]/[hari-DD-MM-YYYY]/
  doc-id.md
  doc-en.md
```

## Struktur Wajib

1. Summary
2. Motivation
3. Proposed Solution
4. Architecture Overview (sisi backend/frontend + alur)
5. Module / File Structure
6. Transkrip / Capture (frontend: mic Web Speech / tabCapture / plugin STT) — jika relevan
7. Backend Flow (endpoint, LLM provider, store) — jika relevan
8. Analysis (ringkasan/Q&A, prompt, provider) — jika relevan
9. Config & Setting (constants, chrome.storage)
10. Recovery & Edge Cases
11. Comments / Discussions

## Rule Repo Transkrip

- Jelaskan dari sudut pandang alur frontend↔backend, bukan hanya nama file
- Sebutkan provider LLM (DeepSeek/Ollama) + apakah teks transkrip keluar mesin (privasi)
- Untuk frontend, sebutkan batasan (mis. Web Speech API hanya mic, bukan audio tab)
- Sebutkan bahasa transkrip (akurasi ASR bergantung ini)
- Jika fitur tidak punya setting khusus, tulis eksplisit

## Verifikasi

- Backend: `uvicorn app.main:app --reload` + call endpoint sampel
- Extension: load unpacked + rekam pendek
- Jangan menjadikan unit test sebagai asumsi wajib repo ini
