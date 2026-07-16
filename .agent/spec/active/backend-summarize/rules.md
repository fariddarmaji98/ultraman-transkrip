# B0 — Backend Summarize + Store

Sisi backend (Python + FastAPI). Terima transkrip dari frontend, simpan, dan ringkas via LLM (DeepSeek/Ollama). Q&A/search = B1 (lanjut).

## Main

- service FastAPI: simpan transkrip + endpoint summarize
- modul: `backend/app/` (routes + schemas), `backend/analysis/` (LLM), `backend/store/` (SQLite), `backend/prompts/`
- referensi clone: belum ada — route summarize jadi template route LLM berikutnya

## Endpoints (lihat `apicontract.md`)

- `POST /transcripts` — simpan transkrip + metadata → kembalikan `id`
- `POST /summarize` — terima `transcript_id` atau teks transkrip → kembalikan ringkasan
- `GET /transcripts/{id}` — ambil transkrip tersimpan
- (B1) `POST /ask` — Q&A atas transkrip

## Analysis (LLM)

- interface provider-agnostik di `analysis/` (mis. `summarize(text, lang) -> str`)
- provider via config `llm.provider`: `deepseek` (OpenAI-compatible `/v1/chat/completions`) atau `ollama` (`/api/generate` / `/api/chat`)
- prompt ringkasan di `prompts/summary.md` (jangan inline) — minta poin kunci + action item + bahasa output ikut transkrip
- endpoint/model/timeout di `constants/llm.py`

## Store

- SQLite: tabel `transcripts` (id, source_label, language, text/segments json, duration, created_at) + `summaries` (id, transcript_id, text, provider, created_at)
- skema awal sederhana; index full-text (FTS5) untuk search disiapkan B1

## Config

- `config/default.yaml`: `llm.provider`, `llm.deepseek.api_key`/`base_url`/`model`, `llm.ollama.base_url`/`model`, `language` default
- default dari `constants/` (ADR 0001); api key dari env, jangan commit

## Recovery

- provider gagal (API down / Ollama mati / timeout) → 502 + pesan jelas, jangan crash
- transkrip kosong → 422
- DeepSeek tanpa api key → 400 dengan pesan setup

## Note

- CORS: izinkan origin chrome-extension (atau `*` untuk dev) supaya extension bisa call.
- Privasi: mode DeepSeek mengirim teks transkrip ke cloud; Ollama lokal tidak. Dokumentasikan di response/docs.
- Tombol Summarize di F1 bergantung endpoint `/summarize` ini.
