# Ekstraksi Terstruktur Transkrip — Fase 1 (Transcript as Context)

- Tanggal: 15-09-2026
- Status: implemented + QA pass
- Terkait: [ADR 0013](../../adr/0013-extraction-transkrip.md), [ADR 0018](../../adr/0018-labeling-dua-lapis.md), [planning](../../planning/transcript-as-context.md)

## Summary

Tab **Context** di panel asisten: transkrip diangkat jadi context terstruktur untuk membangun
project — empat kategori (Keputusan, Kebutuhan, Batasan, Pertanyaan terbuka), tiap item bersitasi
`[mm:ss]` yang bisa diklik untuk melompat ke player. Tersimpan per `(recording_id, lang)`,
diekspor sebagai brief markdown, auto-tag topik dari LLM, plus label manual (Fase 2b).

## Motivation

Ringkasan prosa enak dibaca manusia, tapi konsumen kedua konteks adalah agent / generator spec —
dan mereka butuh struktur tetap + jejak menit, bukan narasi bebas. "Apa yang diputuskan vs apa
yang masih menggantung" adalah informasi yang berbeda dan tidak boleh dicampur.

## Proposed Solution (implementasi)

1. `analysis/extract.py` — satu jalur LLM (map-reduce tanpa LLM merge: array JSON di-union mekanis,
   diurutkan `at_ms`), validasi pydantic ketat (gagal keras, bukan senyap).
2. Tabel `recording_extracts` — `data` JSON + `auto_tags` per `(recording_id, lang)`; "Buat ulang"
   menimpa.
3. Route `POST /recordings/{rid}/extract` (sinkron, pola summarize) + field `extract` di detail.
4. `render_brief` — markdown per kategori, sitasi `[mm:ss]`, heading ikut bahasa extract.
5. UI tab "Context" (AiPanel) — tombol Ekstrak/Buat ulang, kategori, TimeStamp klik-able.
6. Labeling (Fase 2b): auto-tag `topics` (kunci kelima prompt) + label manual REST/MCP.

## QA (2026-09-15, `scripts/qa_extract.py` + integration)

| Area | Hasil |
|---|---|
| `_split` unit | >12 chunk dipangkas ke 12 + flag terpotong; transkrip pendek 1 chunk; baris tak terbelah |
| `_parse` unit | Menolak jelas: bukan-JSON, at_ms negatif, text hilang/kosong, kunci asing, bukan objek. Menerima: fences ```json```, kategori hilang (backfill `[]`), JSON di tengah kalimat, topics kotor disanitasi |
| Extract `en` vs `id` | Dua bahasa hidup berdampingan tanpa saling menimpa (pola `summaries`); brief en heading English |
| Rekaman tanpa extract | `extract: null`, `labels: []` — tidak error |
| Kunci LLM invalid | 502 pesan jelas; extract lain tidak terdampak |
| Ekstraksi nyata | rec #6 (video 21 menit): 19-21 keputusan, 17-28 kebutuhan, auto-tags akurat (`ai-agent, hermes, setup, telegram`) |

Tematan QA: proxy yang menolak kunci membalas HTML → pesan error "format balikan LLM tidak
berupa JSON" (jelas, tapi bisa lebih spesifik kelak).

## Module / File Structure

| File | Isi |
|---|---|
| `backend/analysis/extract.py` | Prompt 5 kunci, `ExtractData`/`ExtractItem`, sanitize, `_split`/`_parse` |
| `backend/store/models.py` | `RecordingExtract` (data, auto_tags, provider, model) |
| `backend/scripts/migrate_add_extracts.py` · `migrate_add_labels.py` | Migrasi |
| `backend/app/routes/recordings.py` | `POST /extract`, `GET/PUT /labels`, field di detail, `_export_brief` |
| `backend/export/render.py` | `render_brief` |
| `frontend/web/src/components/AiPanel.jsx` | Tab Context: `ExtractPane`/`ExtractCard`/`Category`/`TimeStamp` |
| `backend/scripts/qa_extract.py` | 12 unit test QA (murni, tanpa jaringan) |

## Recovery & Edge Cases

| Kasus | Perilaku |
|---|---|
| Balikan LLM menyimpang | `LLMError` → 502; kategori hilang di-backfill `[]` (jawaban sah); item rusak = gagal total (by design — context setengah benar lebih berbahaya daripada gagal) |
| Transkrip >12 potongan | Dipangkas, catatan terpotong ditempel di item pertama |
| Kategori kosong semua | Tampil "tidak menghasilkan item" — informasi, bukan error |
| Tombol sebelum transkrip selesai | Disabled dengan alasan ("Menunggu transkrip selesai") |

## Comments / Discussions

- Fase 2 (brief lintas-rekaman di app) digeser ke project agent — sesuai arah "transkrip =
  context provider, agent = konsumen" (ADR 0015).
- Fase 3 (`search_context` embedding) menyusul; labeling sudah jadi fondasi filternya.
- Todo tersisa: tombol ekspor Brief di UI (#11 spec), UI editor label manual (#3 roadmap).
