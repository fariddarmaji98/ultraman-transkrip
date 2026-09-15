# Ekstraksi Terstruktur Transkrip (transcript as context) — Fase 1

## Main

- fitur: LLM ekstraksi `{decisions, requirements, constraints, open_questions}` dari transkrip,
  tiap item bersitasi `at_ms`, tersimpan per `(recording_id, lang)`, dirender di panel asisten,
  diekspor sebagai brief markdown.
- jenis: `backend-analysis` (+ route + store + ekspor + UI panel asisten)
- modul baru: `backend/analysis/extract.py`
- modul disentuh: `backend/store/models.py`, `backend/app/routes/recordings.py`,
  `backend/app/schemas.py`, `backend/export/render.py`, `backend/constants/__init__.py`,
  frontend panel asisten (`frontend/web/src/components/`)
- referensi clone: `backend/analysis/summarize.py` (map-reduce + prompt),
  `backend/app/routes/recordings.py::summarize_recording` (route + simpan),
  `store/models.py::Summary` (pola tabel per lang)
- dokumen: [planning](../../../docs/planning/transcript-as-context.md) ·
  [ADR 0013](../../../docs/adr/0013-extraction-transkrip.md)

## Interface

### Endpoint

- `POST /api/recordings/{rid}/extract?lang=id` → `200 ExtractOut` (sinkron, pola summarize)
  - 404 rekaman tidak ada; 409 belum ada transkrip (status bukan `done`); 502 `LLMError`
- `GET /api/recordings/{rid}` (RecordingDetail) → tambah field `extract: ExtractOut | null`
- `GET /api/recordings/{rid}/export?format=brief&lang=id` → markdown `text/markdown`
  - bagian dari `format` existing (txt/srt/json) — tambah `brief`

### Skema ExtractOut

```json
{
  "recording_id": 1,
  "lang": "id",
  "decisions": [{"text": "...", "at_ms": 125000}],
  "requirements": [{"text": "...", "at_ms": 301000}],
  "constraints": [{"text": "...", "at_ms": 89000}],
  "open_questions": [{"text": "...", "at_ms": 512000}],
  "provider": "ollama",
  "model": "llama3.1",
  "created_at": "..."
}
```

### Prompt (extract.py)

- system: rules Inggris — jawab HANYA dari transkrip, salin timestamp dari baris `[mm:ss]`,
  keluarkan JSON valid dengan tepat empat kunci, kategori kosong = `[]`, jangan mengarang item,
  perintah bahasa paling akhir (pola ADR 0011).
- user: transkrip bergaya `[mm:ss] text` (satu segmen per baris) → model menyalin menit sumber.
- map-reduce: potong per `EXTRACT_CHUNK_CHARS` (baris utuh); union array per kategori di Python,
  urutkan `at_ms` — TANPA panggilan merge LLM (ADR 0013 keputusan 6).

## Store

- tabel `recording_extracts`:
  `id PK`, `recording_id FK→recordings.id`, `lang` (default `id`),
  `data` (Text, JSON tervalidasi), `provider` (String 32), `model` (String 64),
  `created_at` (datetime)
  - `UniqueConstraint("recording_id", "lang", name="uq_extract_recording_lang")` — pola `summaries`
- migrasi instalasi lama: script `scripts/` (pola ALTER repo) — `create_all` hanya untuk DB baru.

## Config / Constants

- `EXTRACT_CHUNK_CHARS = 12000` (samakan basis dengan `SUMMARY_CHUNK_CHARS` — aman untuk
  provider context 8k)
- `EXTRACT_MAX_CHUNKS = 12` (>12: pangkas transkrip, beri catatan terpotong — pola `_TRUNCATED`)
- `EXTRACT_CATEGORIES = ("decisions", "requirements", "constraints", "open_questions")`
- label kategori untuk UI & ekspor: dict id → label Indonesia (heading ekspor mengikuti bahasa
  extract via label per lang — minimal `id` + `en`, pola `LANGUAGE_BY_ID`)

## Recovery

- LLM gagal / timeout → `LLMError` → 502 dengan pesan provider (pola summarize).
- Balikan bukan JSON valid / schema meleset → `LLMError("format balikan LLM tidak sesuai")` → 502;
  kategori hilang di-backfill `[]`; item rusak = gagal total (ADR 0013 keputusan 5).
- `at_ms` di luar rentang [0, durasi] → item dibuang + dicatat log warning (bukan gagal total).
- Transkrip kosong → 409 dengan pesan jelas.
- "Buat ulang" = UPSERT baris `(recording_id, lang)` — menimpa provider/model/created_at.

## Note

- Privasi: provider LLM aktif dari popup Setelan (default Ollama lokal); UI panel menampilkan
  provider aktif — teks transkrip tidak keluar mesin kecuali user memilih cloud.
- Ekstraksi eksplisit via tombol (tidak otomatis pasca-transkrip) — ADR 0013 keputusan 8.
- UI: blok extract di panel asisten sebagai tab/section baru ("Context") bersebelahan
  Ringkasan/Chat; menit render `[mm:ss]` klik-able (komponen sitasi chat dipakai ulang).
- Ekspor `brief`: markdown — judul rekaman + heading per kategori + daftar item `- [mm:ss] text`.
- Fase 2 (brief lintas-rekaman) & Fase 3 (embedding) TIDAK termasuk spec ini.
