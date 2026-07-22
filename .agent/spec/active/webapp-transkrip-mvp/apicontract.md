# upload recording

- api: `/api/recordings`
- method: POST
- auth: session cookie
- params / body (multipart/form-data, streaming):
  - file: binary (audio/video, ≤ 2 GB)
  - language: string opsional (`auto` default | `id` | `en` | kode ISO lain; FE hanya menampilkan 3 preset)
  - title: string opsional (default: nama file)
- catatan: ffprobe jalan sinkron saat upload — validasi media + `duration_ms` sudah terisi di response
- response 201:

```json
{
  "recording": { "id": 1, "title": "meeting.mp4", "status": "queued", "duration_ms": 3600000, "language": "auto", "created_at": "..." },
  "job_id": 10
}
```

- error: 401 belum login · 413 melebihi cap · 422 bukan media valid (ffprobe gagal)

# poll job

- api: `/api/jobs/{id}`
- method: GET
- auth: session cookie
- response 200:

```json
{ "id": 10, "kind": "transcribe", "status": "transcribing", "progress": 42, "error": null }
```

- status: `queued | extracting | transcribing | done | failed`

# detail recording + transkrip

- api: `/api/recordings/{id}`
- method: GET
- auth: session cookie
- response 200:

```json
{
  "id": 1, "title": "meeting.mp4", "status": "done", "duration_ms": 3600000,
  "language": "id", "media_available": true, "media_expires_at": "...",
  "segments": [
    { "idx": 0, "start_ms": 0, "end_ms": 4200, "text": "Selamat pagi semuanya", "speaker": null }
  ]
}
```

# list recordings

- api: `/api/recordings`
- method: GET
- auth: session cookie
- response 200:

```json
[ { "id": 1, "title": "meeting.mp4", "status": "done", "duration_ms": 3600000, "created_at": "..." } ]
```

# delete recording

- api: `/api/recordings/{id}`
- method: DELETE
- auth: session cookie
- response: 204 — hapus media + transkrip; 404 tidak ada

# export transkrip

- api: `/api/recordings/{id}/export?format=txt|srt|vtt|json`
- method: GET
- auth: session cookie
- response: file download (Content-Disposition); `json` = segments mentah

# serve media (player)

- api: `/api/recordings/{id}/media`
- method: GET (support `Range`)
- auth: session cookie
- response: audio hasil ekstraksi (Opus; verifikasi playback iOS Safari — fallback copy m4a/AAC bila perlu); 404 jika sudah kena retensi

# info engine (panel ENGINE di FE)

- api: `/api/config`
- method: GET
- auth: session cookie
- response 200:

```json
{
  "asr_provider": "local",
  "model": "large-v3-turbo",
  "max_upload_mb": 2048,
  "models": [
    { "id": "large-v3-turbo", "label": "Large v3 Turbo", "size": "~1,6 GB", "note": "terbaik untuk Indonesia" }
  ]
}
```

- `models`: daftar model lokal yang boleh dipilih (`constants.LOCAL_MODEL_CHOICES`); **kosong** saat provider `groq` (model dikunci di sisi Groq)

# ganti model lokal

- api: `/api/config`
- method: PATCH
- auth: session cookie
- body: `{ "model": "small" }` — harus salah satu `id` dari `models`
- efek: set model aktif, kosongkan cache model faster-whisper, simpan ke `data/runtime.json` (bertahan lintas-restart)
- response 200: payload sama seperti GET
- error: 422 model tidak dikenal · 409 provider Groq / ada transkrip berjalan
- catatan: env `TRANSKRIP_LOCAL_WHISPER_MODEL` menang saat startup — bila diset, `runtime.json` diabaikan

# setelan mesin AI (popup Setelan di FE)

- api: `/api/llm`
- method: GET
- auth: session cookie
- response 200:

```json
{
  "provider": "ollama",
  "model": "llama3.1",
  "base_url": "http://localhost:11434/v1",
  "providers": [
    { "id": "ollama", "label": "Ollama (lokal)", "base_url": "…", "default_model": "llama3.1",
      "needs_key": false, "note": "…", "key_set": false }
  ]
}
```

- **Nilai kunci API tidak pernah dikirim** — hanya `key_set` per provider

# ganti mesin AI

- api: `/api/llm`
- method: PATCH
- auth: session cookie
- body: `{ "provider": "deepseek", "model": "deepseek-chat", "api_key": "…" }` — `api_key` opsional,
  kosong = pertahankan yang tersimpan
- efek: simpan pilihan + kunci ke `data/runtime.json`
- response 200: payload sama seperti GET
- error: 422 provider tidak dikenal
- catatan: env `TRANSKRIP_LLM_PROVIDER` / `TRANSKRIP_LLM_API_KEY` menang saat startup

# tes koneksi mesin AI

- api: `/api/llm/test`
- method: POST
- auth: session cookie
- body: sama seperti PATCH (memakai isian form, bukan yang tersimpan)
- efek: completion kecil (`max_tokens: 5`) ke provider sungguhan
- response 200: `{ "ok": true, "detail": "deepseek-chat merespons" }` — **gagal juga 200**
  (`{"ok": false, "detail": "…"}`), karena ini hasil diagnostik bukan request yang gagal
- error: 422 provider tidak dikenal

# hapus kunci API tersimpan

- api: `/api/llm/{provider}/key`
- method: DELETE
- auth: session cookie
- response: 204; 422 provider tidak dikenal

# ringkasan AI (M2)

- api: `/api/recordings/{id}/summarize`
- method: POST (tanpa body)
- auth: session cookie
- efek: ringkas transkrip pakai mesin AI aktif; simpan ke tabel `summaries`
  (satu baris per recording — dibuat ulang = **mengganti**, bukan menumpuk)
- **sinkron**: 4,9 detik untuk transkrip 5:43; 16 detik untuk 28 menit (map-reduce)
- response 200:

```json
{ "text": "## Ringkasan\n…", "provider": "deepseek", "model": "deepseek-chat", "created_at": "…" }
```

- error:
  - `404` rekaman tidak ditemukan
  - `422 belum ada transkrip untuk diringkas` — segmen kosong
  - `422 mesin AI belum punya kunci API — atur di popup Setelan`
  - `502` provider gagal (pesan aslinya diteruskan)
- transkrip melebihi `SUMMARY_MAX_CHUNKS`: ringkasan diakhiri catatan bahwa hanya bagian awal
  yang tercakup — pemotongan tidak senyap ([ADR 0009](../../../../docs/adr/0009-ringkasan-transkrip.md))

# detail recording — tambahan

`GET /api/recordings/{id}` kini menyertakan `summary` (objek seperti di atas) atau `null`.

# login

- api: `/api/auth/login`
- method: POST
- auth: none
- body: `{ "password": "..." }` (single user, password dari env)
- response: 204 + Set-Cookie session; 401 salah

# Groq transcription (eksternal)

- api: `https://api.groq.com/openai/v1/audio/transcriptions`
- method: POST (multipart)
- auth: api key (`GROQ_API_KEY`, server-side)
- params / body:
  - file: audio ≤ 100 MB (dev tier) — kirim hasil ekstraksi 16 kHz mono ~32 kbps
  - model: `whisper-large-v3-turbo`
  - language: kode ISO (skip utk auto-detect)
  - response_format: `verbose_json` (berisi segments + timestamps)
- response (dipangkas):

```json
{ "text": "...", "segments": [ { "start": 0.0, "end": 4.2, "text": "..." } ], "language": "id", "duration": 3600.0 }
```

- harga: $0.04/jam audio (turbo) — cek ulang https://console.groq.com/docs/speech-to-text
