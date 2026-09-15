# ADR 0019 — Pencarian semantic context: embedding Ollama + index JSONL in-process

- Status: accepted
- Tanggal: 2026-09-15
- Terkait: [ADR 0015](0015-mcp-context-provider.md), [ADR 0018](0018-labeling-dua-lapis.md), [ADR 0013](0013-extraction-transkrip.md)
- Rencana: [mcp-context-provider](../planning/mcp-context-provider.md) (Fase 3 — penutup)

## Konteks

`EmbeddingProvider` adalah stub sejak ADR 0009; `search_context` adalah tool terakhir yang
dijanjikan ADR 0015 ("cari context lama dari library" — kebutuhan eksplisit user). Word-matching
di `chat.py` diakui sementara dan hanya per-rekaman; agent perlu menjawab "keputusan soal X
sepanjang arsip" lintas rekaman.

## Keputusan

1. **Provider embedding = Ollama `/api/embed`, model `nomic-embed-text`.** Lokal, gratis, tanpa
   kunci — konsisten prinsip default-lokal repo (ASR lokal, LLM default Ollama). Satu jalur
   `embed()` memenuhi `EmbeddingProvider` Protocol; provider cloud menyusut jadi kelas baru bila
   suatu saat dibutuhkan, tanpa menyentuh pemanggil.

2. **Unit index = SATU ITEM EXTRACT, bukan segmen transkrip.** Butir yang dicari agent adalah
   butir context ("keputusan soal database di menit 12"), bukan kalimat mentah. Segmen tetap
   bisa dicari lewat chat per-rekaman; menduplikasinya ke index global hanya menggandakan
   penyimpanan tanpa menambah jawaban.

3. **Index in-process + persist JSONL (`data/embeddings.jsonl`), TANPA vector DB.** Brute-force
   cosine di NumPy atas ribuan item puluhan milidetik — pgvector/hnswlib adalah dependensi yang
   belum dibayar volumenya (pola ADR 0013: jangan bawa dependensi sebelum scale membenarkan).
   JSONL append saat ekstraksi; drop menulis ulang file (jarang, kecil).

4. **Index diperbarui otomatis di ujung `_save_extract` (REST) dan `get_context` (MCP).** Kedua
   jalur lahir dengan index; tidak ada langkah "build index" terpisah yang bisa dilupakan.
   Kegagalan index TIDAK menggagalkan ekstraksi — extract tetap tersimpan dan bisa dicari lewat
   label; index adalah pelengkap, kegagalannya dicatat log (kebalikan kontrak extract inti di
   ADR 0013 yang gagal keras).

5. **Label & kategori menyaring DI DEPAN cosine** (ADR 0015 keputusan 6): ruang disaring murah
   dan deterministik dulu, embedding hanya memeringkat di dalamnya. Ini juga membuat label jadi
   bagian dari kontrak pencarian, bukan dekorasi.

6. **`search_context` menyertakan judul rekaman di tiap hasil.** Hasil pencarian harus berdiri
   sendiri bagi agent — tanpa itu, agent harus memanggil `list_recordings` lagi hanya untuk tahu
   item datang dari rekaman mana.

7. **`nomic-embed-text` tidak di-pull otomatis oleh backend.** Model 274 MB sekali unduh; backend
   hanya memanggil `/api/embed` dan melaporkan kegagalan dengan pesan yang menyebut Ollama.
   Menarik model sendiri di startup menambah kompleksitas (progress, retry, disk) untuk hal yang
   dilakukan satu perintah `ollama pull` — dicatat di README/doc fitur.

## Alternatif yang ditimbang

- **pgvector sekarang** — ditolak; menuntut Postgres (repo sadar SQLite-MVP, ADR overview §9)
  sebelum volume membenarkan.
- **SQLite + sqlite-vec / FTS5 hybrid** — FTS5 bukan semantic (sinonim gagal: "database" vs
  "penyimpanan data"); sqlite-vec ekstensi binary lintas-platform yang rapuh di Windows. Ditunda
  bersama pgvector.
- **hnswlib/FAISS in-process** — ditolak untuk awal; brute-force NumPy cukup di skala ini,
  penggantinya jelas kalau profil waktu nyata terasa.
- **Index per segmen (bukan per item)** — ditolak; lihat keputusan 2.
- **Auto-pull model saat startup** — ditolak; lihat keputusan 7.
- **Pencarian via LLM (prompt seluruh arsip)** — ditolak; tidak diskalakan (context window) dan
  mahal per pertanyaan.

## Konsekuensi

- **Ollama harus hidup agar pencarian jalan** (bukan agar extract jalan — hanya pencarian).
  `search_context` melaporkan ini jelas; pengguna tanpa Ollama tetap punya filter label.
- **Item extract bahasa berbeda campur di satu index** — disengaja (pertanyaan bisa lintas
  bahasa, embedding multibahasa nomic menangkap sebagian besar); filter `category` dan label
  tetap bekerja.
- **File JSONL tumbuh linear** (± 3 KB/item termasuk vector 768 float). 10.000 item ≈ 30 MB —
  jauh dari masalah; saat melewati itu, waktunya pgvector.
- **RAM index = items × dim × 4 byte** — 10.000 item ≈ 30 MB. Diterima.
- **Reindex total butuh "Buat ulang" per rekaman** — tidak ada tombol reindex-all; kalau model
  embedding diganti, index lama bercampur dimensi baru. Mitigasi: hapus `embeddings.jsonl` +
  buat ulang extract; dicatat di doc fitur.
- **Test dengan provider dummy** (`qa_embeddings.py`) menutup logika index tanpa jaringan;
  tes dengan Ollama sungguhan manual (butuh model terpasang).
