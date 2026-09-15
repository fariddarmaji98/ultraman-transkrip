# Pencarian Semantic Context — Fase 3 (`search_context`)

- Tanggal: 15-09-2026
- Status: implemented (unit QA pass; QA Ollama menunggu model terunduh)
- Terkait: [ADR 0019](../../adr/0019-semantic-search-embedding.md), [ADR 0015](../../adr/0015-mcp-context-provider.md), [ADR 0018](../../adr/0018-labeling-dua-lapis.md)

## Summary

Tool MCP **`search_context(query)`** — pencarian semantic lintas rekaman atas arsip context.
Menutup `EmbeddingProvider` (stub sejak awal) dan janji terakhir ADR 0015: "cari context lama
dari library". Agent kini bisa bertanya "keputusan soal database sepanjang arsip?" dan menerima
item context paling relevan + sitasi menit + rekaman asalnya.

## Motivation

Word-matching (chat per-rekaman) tidak lintas rekaman dan gagal pada sinonim. Label memfilter
tetapi tidak memeringkat makna. Agent yang membangun project dari banyak sumber video butuh
jawaban dari SELURUH arsip, bukan satu rekaman.

## Proposed Solution

1. `analysis/embeddings.py` — `OllamaEmbeddings` (`/api/embed`, `nomic-embed-text`) memenuhi
   `EmbeddingProvider` Protocol; `EmbeddingIndex` in-process + persist JSONL.
2. Unit index = **item extract** (bukan segmen): butir yang dicari agent.
3. Index otomatis di ujung ekstraksi (REST `_save_extract` + MCP `get_context` auto-extract).
4. `search_context` MCP: label & kategori filter dulu → cosine NumPy memeringkat → hasil
   menyertakan judul rekaman.

## Architecture Overview

```
ekstraksi (REST / MCP)
   └─ _save_extract ──► EmbeddingIndex.index_extract(rec, lang, payload, labels)
                          └─ OllamaEmbeddings.embed([item.text…])   (batch 32)
                          └─ append data/embeddings.jsonl + matrix NumPy in-memory

agent ── MCP search_context("keputusan soal database", label?)
           └─ filter items (label/kategori) → cosine vs query vector → top-k
           └─ [{recording_id, recording_title, category, at_ms, text, score}]
```

## Module / File Structure

| File | Isi |
|---|---|
| `backend/analysis/embeddings.py` | `EmbeddingProvider` Protocol, `OllamaEmbeddings`, `EmbeddingIndex` (index/drop/search/persist), singleton |
| `backend/app/routes/recordings.py` | `_index_extract()` di ujung `_save_extract` (gagal ≠ gagal ekstraksi) |
| `backend/mcp_server.py` | Tool `search_context(query, label?, category?, limit?)` |
| `backend/scripts/qa_embeddings.py` | 7 unit test dengan provider dummy (tanpa jaringan) |
| `backend/requirements.txt` | + `numpy>=1.26` (sudah ada di venv via faster-whisper) |

## Config & Setting

- Model embedding: `nomic-embed-text` (hardcode default di `OllamaEmbeddings`) — pasang sekali:
  `ollama pull nomic-embed-text` (274 MB).
- Ollama harus hidup di `127.0.0.1:11434` **untuk pencarian saja**; ekstraksi/label tetap jalan
  tanpa Ollama.
- File index: `backend/data/embeddings.jsonl` (ikut tergitignore bersama `data/`).

## Recovery & Edge Cases

| Kasus | Perilaku |
|---|---|
| Ollama mati saat ekstraksi | Ekstraksi tetap sukses & tersimpan; index dilewati, warning di log — BUKAN kegagalan |
| Ollama mati saat search | `{ok:false, "pencarian gagal (Ollama hidup?)…": detail}` |
| Index kosong | Pesan "jalankan ekstraksi context dulu" |
| Re-index rekaman yang sama | Item lama diganti (idempoten per recording+lang) |
| Ganti model embedding | Hapus `embeddings.jsonl` + buat ulang extract (dimensi beda tak boleh campur) |
| Query kosong / label fiktif | Ditolak jelas / hasil kosong |

## QA

- **Unit** (`scripts/qa_embeddings.py`, provider dummy): 7/7 — index multi-bahasa, idempotensi
  re-index, search berperingkat, filter label & kategori, drop + persist + reload konsisten.
- **Integrasi Ollama**: menunggu `ollama pull nomic-embed-text` selesai (jaringan lambat);
  langkah verifikasi: ekstrak rec #6/#7 → `search_context("keputusan soal mesin")` → hasil
  relevan bersitasi.

## Comments / Discussions

- Brutus-force cosine NumPy: ribuan item puluhan ms — pgvector menyusul kalau `embeddings.jsonl`
  menembus puluhan MB (ADR 0019 keputusan 3).
- Item `en` dan `id` campur di satu index — disengaja; nomic multibahasa, dan filter tetap bekerja.
- Kebutuhan RAM: ± 3 KB/item di disk, 768×4 byte/item di memori — 10 ribu item ≈ 30 MB, aman.
