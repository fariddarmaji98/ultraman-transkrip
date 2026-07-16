# POST /transcripts

- api: `/transcripts`
- method: POST
- auth: none (dev) / token (lanjut)
- body:
  - `text`: string (transkrip; atau `segments`)
  - `segments`: array `{start, end, text}` (opsional)
  - `source_label`: string (`voice` | `zoom` | `google_meet` | `file` | `youtube`)
  - `language`: string (mis. `id`, `en`)
  - `duration`: number (detik, opsional)
- response:

```json
{ "id": "trx_abc123", "created_at": "2026-06-21T10:00:00Z" }
```

# GET /transcripts/{id}

- api: `/transcripts/{id}`
- method: GET
- response:

```json
{ "id": "trx_abc123", "source_label": "voice", "language": "id", "text": "...", "segments": [], "duration": 123.4, "created_at": "..." }
```

# POST /summarize

- api: `/summarize`
- method: POST
- body (salah satu):
  - `transcript_id`: string  (ringkas transkrip tersimpan), ATAU
  - `text`: string           (ringkas teks langsung)
  - `language`: string (opsional; default ikut transkrip)
  - `style`: string (opsional: `bullets` | `paragraph` | `action_items`)
- response:

```json
{ "summary": "...", "provider": "deepseek", "model": "deepseek-chat", "transcript_id": "trx_abc123" }
```

- error: `400` (no api key / bad input), `422` (transkrip kosong), `502` (provider gagal/timeout)

# POST /ask (B1 — lanjut)

- api: `/ask`
- method: POST
- body:
  - `question`: string
  - `scope`: `all` | `transcript_id`
- response:

```json
{ "answer": "...", "references": [ { "transcript_id": "trx_abc123", "quote": "...", "start": 12.3 } ] }
```

---

## Provider eksternal (dipakai `analysis/`)

# DeepSeek chat

- api: `https://api.deepseek.com/v1/chat/completions` (OpenAI-compatible)
- method: POST
- auth: `Authorization: Bearer <DEEPSEEK_API_KEY>`
- body: `{ "model": "deepseek-chat", "messages": [...] }`

# Ollama generate

- api: `http://localhost:11434/api/chat`
- method: POST
- auth: none (lokal)
- body: `{ "model": "llama3.1", "messages": [...], "stream": false }`
