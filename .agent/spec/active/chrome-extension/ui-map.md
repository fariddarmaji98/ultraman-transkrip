# UI Map — Chrome Extension (popup)

Sumber kebenaran layout dari mockup user (2026-06-21). Popup punya **2 tab**: `Transkrip` dan `Config`. UI yang sama jadi acuan untuk Flutter (F3).

## Tab 1 — Transkrip

```
┌───────────────────────────────────────────┐
│  [ Voice ]  [ Zoom ]  [ Google Meet ]      │  ← tombol sumber (F1: hanya Voice aktif)
├───────────────────────────────────────────┤
│                                           │
│            Text transkrip disini          │  ← area transkrip (read-only, scroll,
│            (streaming, real-time)         │     auto-scroll saat merekam)
│                                           │
├───────────────────────────────────────────┤
│              [   Summarize   ]            │  ← POST transkrip ke backend /summarize
└───────────────────────────────────────────┘
```

### Tombol sumber

| Tombol | Audio | Status F1 |
|---|---|---|
| `Voice` | mikrofon (Web Speech API) | **aktif** |
| `Zoom` | tab audio (tabCapture + ASR on-device) | disabled / "coming soon" → F2 |
| `Google Meet` | tab audio (sama dengan Zoom) | disabled / "coming soon" → F2 |

- Klik `Voice` → minta izin mic → mulai `SpeechRecognition`, tombol jadi state aktif ("■ Stop").
- Klik lagi → stop, finalize, `POST /transcripts`.
- `Zoom` & `Google Meet` capture identik (tab audio) → satu handler, beda label metadata sumber. Jangan duplikasi.

### Area transkrip

- Read-only, menampilkan hasil interim + final saat masuk (streaming, auto-scroll).
- Idle → tampilkan transkrip terakhir / placeholder "Text transkrip disini".

### Tombol Summarize

- Aktif kalau ada transkrip.
- Klik → `POST {backend}/summarize` → tampilkan ringkasan (panel/expand di bawah).
- Disable + spinner selama proses; tangani error (backend down / provider LLM gagal).

## Tab 2 — Config

```
┌───────────────────────────────────────────┐
│  Bahasa transkrip:   [ Indonesia ▼ ]      │  ← prioritas: akurasi ASR bergantung ini
│  Backend endpoint:   [ http://localhost.. ]│
│  Provider info:      [ DeepSeek / Ollama ] │  (provider sebenarnya diset di backend)
│                          [ Simpan ]        │
└───────────────────────────────────────────┘
```

### Setting bahasa (prioritas MVP)

- Dropdown → `recognition.lang` Web Speech API (mis. `id-ID`, `en-US`, atau auto).
- **Alasan**: akurasi ASR naik signifikan kalau bahasa cocok dengan audio.
- Opsi minimal: `Indonesia (id-ID)`, `English (en-US)`, `Auto`.
- Default dari modul config; disimpan ke `chrome.storage.local`.

### Setting lain

- Backend endpoint (default `http://localhost:8000`).
- Info provider LLM (DeepSeek/Ollama) — pemilihan aktual ada di config backend, di sini sekadar tampilan/optional override.

## Catatan implementasi (MV3)

- `popup/` = QTabWidget-nya web: 2 tab via HTML/CSS/JS. `lib/transcribe.js` = wrapper `SpeechRecognition`. `lib/backend.js` = client `fetch` ke backend. `lib/config.js` = baca/tulis `chrome.storage`.
- Transkrip & permission mic berjalan di konteks popup/offscreen; jangan blok UI — update DOM dari event `onresult`.
- Semua setting via modul config, bukan hardcode di tiap file.
- Endpoint backend & bahasa = satu sumber (`lib/config.js`).
