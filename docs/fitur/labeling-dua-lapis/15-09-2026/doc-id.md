# Labeling Dua Lapis (Auto-Tag LLM + Label Manual) — Fase 2b

- Tanggal: 15-09-2026
- Status: implemented (backend + MCP; UI web menyusul)
- Terkait: [ADR 0018](../../adr/0018-labeling-dua-lapis.md), [ADR 0015](../../adr/0015-mcp-context-provider.md)

## Summary

Rekaman kini punya **labeling dua lapis**: `auto_tags` (2–4 topik dari LLM, lahir otomatis saat
ekstraksi context) dan label manual (user/agent, PUT-semantik). Keduanya dipakai memfilter arsip
— dari UI REST maupun tool MCP `list_recordings(label=…)`. `get_context` mengembalikan keduanya
sebagai satu daftar `auto_tags`.

## Motivation

Agent perlu mencari "context soal project X" di arsip yang terus bertambah. Status filter saja
tidak cukup; tagging topik otomatis menutupi "tentang apa", label manual menutupi "milik project
mana" — yang tidak bisa ditebak mesin.

## Proposed Solution

1. Prompt ekstraksi ditambah kunci kelima `topics` (2–4 tag lowercase) — satu panggilan LLM.
2. `sanitize_topics()`: normalisasi ketat (lowercase, alnum+hyfen, maks 32, maks 4, dedup) —
   dipakai bersama oleh ekstraksi, REST, dan MCP.
3. Tabel `recording_labels` + kolom `recording_extracts.auto_tags` + migrasi.
4. REST: `GET/PUT /api/recordings/{rid}/labels`; `RecordingDetail.labels` +
   `ExtractOut.auto_tags`.
5. MCP: tool `label_recording` + filter `list_recordings(label=…)` (cari di dua lapis sekaligus)
   + `get_context.auto_tags` (gabungan).

## Architecture Overview

```
ekstraksi (analysis/extract.py)
   └─ LLM balas {4 kategori…, topics: [2-4 tag]}   ← SATU panggilan
        └─ sanitize_topics() → recording_extracts.auto_tags (JSON array)

user / agent ── PUT /labels {labels:[…]} ──► recording_labels (manual)
agent ── MCP label_recording(id, […]) ─────► (tabel yang sama)

pencarian: list_recordings(label='x')
   └─ recording_labels.label == 'x'  OR  auto_tags contains '"x"'
```

## Module / File Structure

| File | Perubahan |
|---|---|
| `backend/analysis/extract.py` | Prompt 5 kunci; `ExtractData.topics` + `sanitize_topics()`; union tag lintas potongan |
| `backend/store/models.py` | `RecordingExtract.auto_tags`; tabel `RecordingLabel` (unik per recording+label) |
| `backend/scripts/migrate_add_labels.py` | ALTER + CREATE TABLE (aman berulang) |
| `backend/app/routes/recordings.py` | `GET/PUT /recordings/{rid}/labels`; labels+auto_tags di detail |
| `backend/app/schemas.py` | `LabelsIn`; `ExtractOut.auto_tags/labels`; `RecordingDetail.labels` |
| `backend/mcp_server.py` | Tool `label_recording`; filter label di `list_recordings`; `get_context.auto_tags` |

## Config & Setting

- Tidak ada konstanta/env baru. Batasan sanitasi (32 char, maks 4) hidup di
  `ExtractData.sanitize_topics` — satu tempat, tiga pemakai.

## Recovery & Edge Cases

| Kasus | Perilaku |
|---|---|
| LLM memberi tag aneh (`AI Team!`, 40 char) | Dibuang/dipotong oleh sanitize; ekstraksi tetap sukses |
| Model lama tidak mengirim `topics` | Backfill `[]` — extract valid, hanya tanpa tag |
| Extract lama (pra-2b) | `auto_tags='[]'`; terisi setelah "Buat ulang" |
| Label sama ditambah dua kali | Unik constraint — tidak menduplikasi |
| `PUT /labels` dengan list kosong | Menghapus semua label manual (memang semantiknya) |
| Filter label tak dikenal | Hasil kosong, bukan error |
| Tag = substring tag lain (`ai` vs `ai-agent`) | Dibatasi quote pengapit di JSON; risiko kecil, hilang di Fase 3 |

## Verifikasi (dijalankan)

- REST `PUT /labels`: `['Project AI Team','riset-2026']` → `['riset-2026']` (normalisasi benar).
- Ekstraksi ulang rec #6: `auto_tags: ['ai-agent','hermes','setup','telegram']` — akurat.
- MCP `label_recording`: set + balik list bersih.
- MCP `list_recordings(label='project-ai-team')` → 1 rekaman; label fiktif → 0.
- MCP `get_context` rec #6 → gabungan `['ai-agent','hermes','project-ai-team','setup','telegram']`.

## Comments / Discussions

- Tag cenderung berbahasa Inggris (instruksi lowercase) — disengaja: kunci mesin, bukan bacaan.
- UI web untuk label manual + tampilan tag belum dibangun (endpoint siap); menyusul bersama
  polish tab Context.
- `search_context` (embedding, Fase 3) akan memakai label sebagai filter di depan vector search.
