# Planning — Transcript as Context (transkrip → context untuk membangun project)

> Fitur: hasil transkrip tidak berhenti sebagai arsip yang dibaca — ia diangkat menjadi **context
> terstruktur** yang bisa dipakai untuk membangun project: keputusan, kebutuhan, batasan, dan
> pertanyaan terbuka terekstrak dengan sitasi menit, lalu digabung lintas-rekaman menjadi satu
> **Project Brief** siap-tempel untuk agent coding / dokumen kerja.
> Selaras [ADR 0003](../adr/0003-modular-monolith-not-microservices.md) — fitur tumbuh sebagai
> modul `analysis/` di atas core transkripsi, bukan layanan terpisah.

> **Status 2026-09-15**: Fase 1 ✅ selesai + QA (ADR 0013, doc fitur `fitur/transcript-as-context/`).
> Fase 2 digeser ke project AI agent sebagai konsumen context (ADR 0015). Fase 3 menyusul.

## 1. Ringkasan masalah

Saat ini tiap rekaman adalah pulau: transkrip → ringkasan bebas-format → chat per-rekaman. Pola itu
bagus untuk *membaca kembali*, tetapi gagal untuk use case yang makin nyata: **"aku baru nonton
rekaman / meeting / video tutorial, dan mau menjadikannya bahan bakar membangun project."**

Yang dibutuhkan konsumen context (agent coding, rekan tim, diri sendiri minggu depan) bukan
ringkasan naratif, melainkan jawaban terstruktur atas empat pertanyaan:

1. **Apa yang diputuskan?** (decisions — beserta menitnya)
2. **Apa yang diminta / dibutuhkan?** (requirements — fitur, deliverable)
3. **Apa batasannya?** (constraints — stack, deadline, budget, kebijakan)
4. **Apa yang masih menggantung?** (open questions — jangan sampai agent mengarang di titik ini)

Dan karena context project hampir selalu lahir dari **banyak** rekaman (kickoff → review →
keputusan), ekstraksi per-rekaman saja tidak cukup: butuh agregasi lintas-rekaman yang
mengonsolidasi duplikasi dan menjaga sitasi ke sumber asal.

## 2. Posisi terhadap fitur yang sudah ada

| Kemampuan existing | Status | Hubungan dengan fitur ini |
|---|---|---|
| Ringkasan map-reduce multibahasa | ✅ | Format bebas (Summary/Key points/Action items) — **bukan** struktur yang bisa dipakai mesin. Extract adalah saudaranya yang terstruktur. |
| Chat dengan sitasi `[mm:ss]` | ✅ | Membuktikan pola sitasi menit bisa diandalkan — extract memakai format yang sama persis. |
| Pemilihan konteks relevan (word-match) | ✅ sementara | Cukup untuk chat; embedding menyusul di Fase 3 bersama search. |
| `LLMProvider` seam (Ollama/Groq/DeepSeek/Claude/OpenAI) | ✅ | Dipakai ulang apa adanya — tidak ada adapter baru. |
| `EmbeddingProvider` seam | ⚠️ stub | Baru diimplementasi di Fase 3. |
| Diarisasi pembicara | ❌ (M4 Colibri) | Rekaman meeting ekstensi sudah stereo (kiri=peserta, kanan=saya) — pemisahan 2 kanal bisa jadi pratinjau diarisasi murah, **di luar scope fase ini**. |

## 3. Roadmap tiga fase

### Fase 1 — Ekstraksi terstruktur per-rekaman (MVP, mulai di sini)

- Modul `analysis/extract.py`: satu panggilan LLM (map-reduce untuk transkrip panjang, pola
  `summarize.py`) → JSON dengan empat kategori, tiap item membawa sitasi `[mm:ss]`.
- Tabel `recording_extracts` — satu baris per `(recording_id, lang)`, pola `summaries`.
- Tombol "Ekstrak" di panel asisten (sejajar "Ringkas"); hasil dirender sebagai empat blok dengan
  menit yang bisa diklik (komponen sitasi chat dipakai ulang).
- Ekspor **brief markdown** per-rekaman via `export/render.py` (`?format=brief`).
- Keputusan teknis lengkap: [ADR 0013](../adr/0013-extraction-transkrip.md).

### Fase 2 — Project Brief lintas-rekaman

- Endpoint `POST /api/briefs`: pilih N rekaman → LLM mengonsolidasi extract N rekaman menjadi
  satu brief: requirement duplikat disatukan, keputusan terbaru menang atas yang lama, setiap item
  tetap membawa sitasi `(judul rekaman, mm:ss)`.
- Prinsip konsolidasi: **extract per-rekaman adalah sumber kebenaran** — brief hanya menggabung
  dan memeringkat, tidak boleh menghasilkan klaim tanpa jejak ke salah satu extract sumber.
- Output: markdown siap-tempel (`AGENTS.md`-style / dokumen kerja) + JSON untuk agent.

### Fase 3 — Embedding + semantic search lintas-transkrip

- Implementasi `EmbeddingProvider` (Ollama embeddings lokal — privat, gratis; provider cloud
  opsional via seam yang sama).
- Index segmen + extract → pertanyaan semantic ("keputusan soal database sepanjang 3 meeting
  terakhir?") dijawab dari library, bukan satu rekaman.
- Sejalan dengan M3 Colibri (library searchable); pgvector/Postgres menyusul saat volume
  membenarkan — SQLite FTS5 dipakai dulu untuk pratinjau.

## 4. Skema extract (kontrak Fase 1)

```json
{
  "decisions":     [{"text": "...", "at_ms": 125000}],
  "requirements":  [{"text": "...", "at_ms": 301000}],
  "constraints":   [{"text": "...", "at_ms": 89000}],
  "open_questions":[{"text": "...", "at_ms": 512000}]
}
```

Ketentuan:

- `at_ms` (milidetik, konsisten dengan `segments.start_ms`) — dirender `[mm:ss]` di UI dan ekspor.
  Milidetik disimpan, bukan string `[mm:ss]`, supaya bisa diklik, diurutkan, dan digabung bebas
  oleh Fase 2 tanpa parsing balik.
- Kategori kosong adalah jawaban sah — `[]`, bukan dihilangkan; "tidak ada keputusan" adalah
  informasi, bukan kegagalan.
- Validasi ketat di Python (pydantic): balikan LLM yang menyimpang → error yang jelas ke user,
  sama seperti pola verifikasi blok terjemahan (ADR 0011 — kegagalan senyap tidak boleh).
- Prompt rules berbahasa Inggris (pola ADR 0011), keluaran mengikuti bahasa yang diminta.

## 5. Privasi & biaya

- Jalur LLM sama dengan ringkasan: provider aktif dari popup Setelan, default **Ollama lokal** —
  teks transkrip tidak keluar mesin kecuali user memilih provider cloud. UI menampilkan provider
  aktif (pola existing dipertahankan).
- Biaya: satu panggilan LLM per `(recording_id, lang)` — disimpan, dipakai ulang; "Buat ulang"
  menimpa baris lama (pola `summaries`).
- Transkrip panjang: map-reduce per kategori tidak perlu — ekstraksi dilakukan per potongan lalu
  digabung **tanpa LLM** (union + dedup kasar per kategori), karena struktur JSON bisa digabung
  secara mekanis, beda dengan prosa ringkasan.

## 6. Yang sengaja TIDAK dikerjakan di fase ini

| Hal | Alasan |
|---|---|
| Diarisasi speaker di extract | Menunggu M4 Colibri; stereo-2-kanal meeting capture adalah jalur cepatnya nanti. |
| Auto-extract setelah transkrip selesai | Ekstraksi eksplisit (tombol) dulu — biaya LLM harus tetap di tangan user, pola "unduh video dulu, transkrip terpisah" (ADR 0008). |
| Vector store baru / pgvector | Fase 3; jangan bawa dependensi sebelum volume membenarkan. |
| Brief otomatis lintas-rekaman | Fase 2 — perlu extract Fase 1 mati dulu sebagai fondasi. |
