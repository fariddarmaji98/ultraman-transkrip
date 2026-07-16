# F3 — Mobile App (Flutter)

Langkah kedua frontend. Aplikasi Flutter dengan UI & alur sama seperti chrome extension, mengonsumsi backend yang sama. **Mulai setelah chrome extension (F1) + backend (B0) stabil.**

## Main

- aplikasi Flutter: transkrip di device + ringkas via backend
- modul: `frontend/mobile/` (project Flutter standar: `lib/`, `pubspec.yaml`)
- referensi: UI mengikuti `chrome-extension/ui-map.md` (2 tab: Transkrip + Config)

## Transkrip

- speech-to-text on-device via plugin (mis. `speech_to_text`) — pakai engine platform (Android/iOS)
- bahasa dari setting (locale) — sejajar dengan setting bahasa di extension
- streaming hasil → area transkrip

## Wiring

- HTTP client → backend `POST /transcripts` + `POST /summarize` (reuse kontrak `backend-summarize/apicontract.md`)
- setting (bahasa, endpoint backend) di local storage (mis. `shared_preferences`)

## UI (2 tab)

- Tab Transkrip: tombol sumber (mobile: terutama `Voice`/mic) + area transkrip + tombol Summarize
- Tab Config: pemilih bahasa + endpoint backend
- mengikuti layout `chrome-extension/ui-map.md`

## Note

- Detail digali saat F1+B0 selesai (TBD sebagian).
- Capture audio sistem/meeting di mobile lebih terbatas (OS restriction) — kemungkinan fokus ke mic/Voice dulu.
- Jaga kontrak backend identik supaya extension & mobile berbagi backend tanpa cabang logic.
