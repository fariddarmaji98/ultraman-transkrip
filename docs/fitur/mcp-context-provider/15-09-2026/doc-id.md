# MCP Context Provider — Fase 2a (Server + Tool Ingest/Context)

- Tanggal: 15-09-2026
- Status: implemented
- Terkait: [ADR 0017](../../adr/0017-mcp-server-fase2a.md), [ADR 0015](../../adr/0015-mcp-context-provider.md), [ADR 0013](../../adr/0013-extraction-transkrip.md)

## Summary

Backend kini menyediakan **MCP server** (`python mcp_server.py`, streamable HTTP :8100) yang
mengekspos pipeline transkrip sebagai 4 tool untuk AI agent: kirim URL video → poll status →
terima context terstruktur. Semua hasil tersimpan di arsip yang sama dengan alur manual —
video, transkrip, ringkasan, dan context bisa dilihat kembali lewat UI web.

## Motivation

Project AI agent user (terpisah) butuh context dari video sebagai bahan kerja (PRD, insight).
Sebelum MCP: export manual + copy-paste. Sesudah: agent memanggil tool, transkrip mengerjakan
semuanya, context kembali terstruktur bersitasi menit.

## Architecture Overview

```
AI Agent (Hermes / klien MCP apa pun)
   │  MCP streamable HTTP :8100/mcp
   ▼
mcp_server.py (proses terpisah, venv sama)
   ├─ transcribe_url(url)      → probe (capture/) → Recording + 2 job berantai
   │                             (fetch → transcribe, worker :8000 yang mengerjakan)
   ├─ get_job(job_id)          → status/progress/error (baca Recording.status)
   ├─ get_context(rec_id)      → recording_extracts (auto-ekstrak bila kosong) + summary
   └─ list_recordings(status?) → arsip terbaru dulu
   ▼ (DB SQLite sama, sesi sendiri)
backend FastAPI :8000 — worker antrean, REST untuk UI, updater yt-dlp
```

Proses MCP **tidak** menjalankan transkripsi sendiri — ia hanya membuat Recording + Job dan
meng-antre; worker di backend :8000 yang mengerjakan. Itulah kenapa backend harus hidup
agar `transcribe_url` berguna.

## Module / File Structure

| File | Perubahan |
|---|---|
| `backend/mcp_server.py` | **Baru** — MCPServer + 4 tool + entrypoint (`TRANSKRIP_MCP_PORT`, default 8100) |
| `backend/requirements.txt` | + `mcp>=2` |

## Tool Contract

| Tool | Input | Output | Catatan |
|---|---|---|---|
| `transcribe_url` | `url`, `language?` (default auto) | `{ok, recording_id, job_id, title, duration_ms}` | Async — balik seketika; probe URL sinkron (tolak cepat URL rusak) |
| `get_job` | `job_id` | `{ok, status, progress, error, title}` | Poll tiap beberapa detik sampai `done` |
| `get_context` | `recording_id`, `lang?` (default id) | `{ok, summary, context{4 kategori, at_ms}, brief_url}` | **Auto-ekstrak** bila belum ada (butuh detik, biaya LLM) |
| `list_recordings` | `status?`, `limit?` (default 20, maks 100) | `{ok, count, recordings[]}` | Terbaru dulu |

## Backend Flow (agent perspective)

1. `transcribe_url("https://youtube.com/…")` → `{recording_id: 8, job_id: 31}`
2. Poll `get_job(31)` → `downloading` → `transcribing` → `done`
3. `get_context(8)` → context 4 kategori + sitasi `[mm:ss]` + ringkasan + brief_url
4. (opsional) `list_recordings()` untuk menemukan lagi nanti

Rekaman hasil agent muncul di UI web dengan status/source seperti unduhan manual, prefix nama
file `mcp-` sebagai penanda asal.

## Config & Setting

- `TRANSKRIP_MCP_PORT` (env, default `8100`) — port streamable HTTP.
- Bind `127.0.0.1` (satu mesin dengan agent) — token lintas-mesin menyusul (ADR 0017 keputusan 6).
- Menjalankan manual: `cd backend && .venv/Scripts/python.exe mcp_server.py`

## Recovery & Edge Cases

| Kasus | Perilaku |
|---|---|
| URL tidak bisa diprobe | `{ok:false, detail}` seketika — tidak ada recording liar |
| Transkripsi gagal di worker | `get_job` melaporkan `failed` + error; recording tetap ada (bisa diulang manual dari UI) |
| `get_context` dipanggil sebelum done | `{ok:false, "transkrip belum selesai — poll get_job dulu"}` |
| Extract belum ada | Dibuat otomatis + disimpan (request berikutnya gratis) |
| LLM gagal saat auto-ekstrak | `{ok:false, detail}` — tidak ada state setengah jadi |
| Backend :8000 mati | MCP hidup tapi `transcribe_url` meng-antre tanpa pemroses — job berjalan saat backend kembali (antrean requeue) |

## Privasi

- MCP server read-only terhadap arsip; menulis hanya via `transcribe_url` (recording + job).
- Jalur LLM extract = mesin AI aktif dari setelan (default Ollama lokal) — sama seperti UI.
- Tidak ada file media yang dikirim ke agent — hanya teks context + sitasi.

## Comments / Discussions

- Tes end-to-end sukses: `list_recordings` (arsip asli), `get_context` rec #6 (extract yang
  sudah ada), `get_context` rec #7 (auto-extract jalur baru — 3/5/12/10 item ter-sitasi).
- MCP SDK 2.x: klien streamable HTTP v2 mengembalikan `(read, write)` — 2 nilai, beda dari
  dokumentasi v1 yang 3. Tercatat di ADR 0017 konsekuensi.
- `label_recording` + `search_context` menyusul di Fase 2b/3 (ADR 0017 keputusan 5).
- Launcher `start-servers.ps1` belum menjalankan MCP server — todo spec.
