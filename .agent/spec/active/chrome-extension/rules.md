# F1 — Chrome Extension (transkrip)

Langkah pertama frontend. Extension Manifest V3 yang transkrip di sisi klien + UI 2 tab sesuai mockup user. Layout detail di `ui-map.md`.

## Main

- transkrip real-time di klien + kirim ke backend untuk disimpan & diringkas
- struktur MV3: `manifest.json`, `background/` (service worker), `popup/` (UI), `options/` (config), `content/` (inject Meet bila perlu), `lib/` (wrapper transkrip + client backend)
- referensi clone: belum ada di repo ini — pola popup + storage standar MV3

## Scope F1 (MVP)

- **Hanya `Voice`** (mikrofon) yang fungsional penuh via Web Speech API.
- `Zoom`/`Google Meet` tampil di UI tapi capture tab audio = **F2** (butuh `tabCapture` + ASR on-device). Di F1 tombolnya boleh disabled / tampil "coming soon".
- UI 2 tab lengkap + setting bahasa + tombol Summarize → backend.

## Transkrip (Voice)

- `navigator.mediaDevices.getUserMedia` (mic) + `SpeechRecognition` (Web Speech API)
- `recognition.lang` = setting bahasa dari Config (mis. `id-ID`, `en-US`) — **kritikal untuk akurasi**
- `interimResults = true`, `continuous = true` → streaming ke area transkrip
- batasan: Web Speech API butuh internet, proses audio via server Google (catat di privasi)

## UI (2 tab)

- **Tab Transkrip**: baris 3 tombol sumber (`Voice` aktif; `Zoom`/`Meet` disabled di F1) → area transkrip read-only streaming → tombol `Summarize`
- **Tab Config**: dropdown **bahasa** (id/en/auto) + endpoint backend + provider info
- detail layout: `ui-map.md`

## Wiring

- transkrip final → `POST {backend}/transcripts` (simpan)
- tombol `Summarize` → `POST {backend}/summarize` dengan transkrip aktif → tampilkan ringkasan
- setting tersimpan di `chrome.storage.local`; endpoint backend & bahasa dari **satu** modul config (`lib/config`), jangan tersebar
- permissions manifest: `activeTab`, (`tabCapture` untuk F2), host permission ke endpoint backend

## Flow Rekam → Transkrip → Ringkas

1. user klik `Voice` → minta izin mic → mulai `SpeechRecognition`
2. hasil interim/final → append ke area transkrip (auto-scroll)
3. user klik stop → finalize → `POST /transcripts`
4. user klik `Summarize` → `POST /summarize` → tampilkan ringkasan (panel)
5. ubah bahasa di Config → simpan ke `chrome.storage`, berlaku untuk rekaman berikutnya

## Recovery

- izin mic ditolak → pesan jelas, jangan diam
- Web Speech API error/`no-speech`/`network` → tampilkan status, tawarkan retry
- backend tidak reachable → error toast, transkrip tetap aman di UI (jangan hilang)

## Note

- `Summarize` butuh backend B0 jalan. Kalau backend belum ada, stub respons untuk dev UI.
- `Zoom`/`Meet` jangan diklaim selesai di F1 — itu F2.
- Global hotkey / rekam di background = enhancement, bukan blocker F1.
