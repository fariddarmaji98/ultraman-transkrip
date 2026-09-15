# Todo — Ekstraksi Terstruktur Transkrip (Fase 1)

Urutan pengerjaan; centang + catat commit hash di `commits.md`.

## Backend

- [x] 1. `constants`: `EXTRACT_CHUNK_CHARS`, `EXTRACT_MAX_CHUNKS`, `EXTRACT_CATEGORIES`, label kategori
- [x] 2. `store/models.py`: tabel `RecordingExtract` + UniqueConstraint `(recording_id, lang)`
- [x] 3. `scripts/`: migrasi `CREATE TABLE recording_extracts` untuk instalasi lama
- [x] 4. `analysis/extract.py`: prompt + `extract(segments, llm, lang)` + validasi pydantic
      (`ExtractItem`, `ExtractData`) + map-reduce union tanpa LLM merge
- [x] 5. `app/schemas.py`: `ExtractItemOut`, `ExtractOut`
- [x] 6. `app/routes/recordings.py`: `POST /recordings/{rid}/extract` + field `extract` di
      `RecordingDetail` (pola `_summary_of`)
- [x] 7. `export/render.py`: format `brief` (markdown per kategori)
- [x] 8. Tes manual: ekstrak rekaman sampel via curl → cek JSON + sitasi + export brief

## Frontend

- [x] 9. `api.js`: `extractRecording(id, lang)`, `exportUrl(id, 'brief', lang)` (sudah ada generic)
- [x] 10. Panel asisten: tab "Context" — tombol "Ekstrak", render 4 kategori,
       item `[mm:ss]` klik-able (komponen TimeStamp), tombol "Buat ulang"
- [x] 11. Tombol ekspor "Brief (md)" di samping ekspor existing
       — commit 7e82304: tombol BRIEF di TranscriptHeader (muncul saat extract ada)

## Penutup

- [x] 12. Update `docs/planning/transcript-as-context.md` status Fase 1 → selesai
       — commit 6d230c8 (bersama dokumen fitur)
- [x] 13. QA: rekaman lama tanpa extract (field null, tidak error), transkrip panjang (>12 chunk),
       LLM mati (pesan error jelas), bahasa `en` (extract terpisah dari `id`)
       — 12 unit test (scripts/qa_extract.py) + QA integration 2026-09-15:
       extract en terpisah & tidak menimpa id; rec tanpa extract = null aman;
       kunci LLM invalid → 502 pesan jelas; brief en heading English
- [x] 14. Commit berjenjang: backend → frontend → docs; update `commits.md`
       — e3eddc7 backend, 09ef8fd frontend, 336e35e spec, 6d230c8 docs, 25d79a6 QA
