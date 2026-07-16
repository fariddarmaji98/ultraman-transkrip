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
