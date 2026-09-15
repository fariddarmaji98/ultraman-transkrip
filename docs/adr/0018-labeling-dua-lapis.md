# ADR 0018 — Labeling dua lapis: auto-tag LLM + label manual (Fase 2b)

- Status: accepted
- Tanggal: 2026-09-15
- Terkait: [ADR 0013](0013-extraction-transkrip.md), [ADR 0015](0015-mcp-context-provider.md), [ADR 0017](0017-mcp-server-fase2a.md)
- Rencana: [mcp-context-provider](../planning/mcp-context-provider.md) (Fase 2b)

## Konteks

`list_recordings` (ADR 0017) hanya memfilter per status — agent tidak punya cara mencari
"context soal project X". User memutuskan (diskusi 2026-09-14): labeling **dua lapis** —
auto-tag dari LLM (topik, gratis, konsisten) dan label manual dari user/agent (project,
niat yang tidak bisa ditebak mesin). Keduanya adalah metadata retrieval, fondasi filter
di depan Fase 3 (embedding).

## Keputusan

1. **Auto-tag = kunci kelima `topics` di JSON ekstraksi, bukan panggilan LLM kedua.**
   Satu prompt, satu biaya — konsisten dengan ADR 0015 keputusan 5 (digabung sampai terbukti
   menurunkan kualitas empat kategori inti). Balikan 2–4 tag pendek; lintas potongan map-reduce
   di-union lalu dipotong 4.

2. **Tag menyimpang DIBUANG, bukan menggagalkan ekstraksi.** `sanitize_topics()`: lowercase,
   alnum+hyfen, maks 32 char, maks 4 buah, dedup. Topik adalah pelengkap — `['AI Team!']`
   yang mengandung spasi dibuang diam-diam, tapi 19 keputusan di bawahnya tetap tersimpan.
   Beda dengan item kategori inti (ADR 0013 keputusan 5: gagal keras) — di sana item rusak
   berarti data yang dikonsumsi agent salah; di sini tag rusak hanya berarti filter kurang akurat.

3. **`auto_tags` kolom tersendiri di `recording_extracts`, bukan di dalam `data`.** Pemakainya
   lintas-rekaman dan tidak berbahasa; menaruhnya di `data` berarti filter harus parse JSON
   semua baris. Kolom Text berisi JSON array tetap (bukan tabel anak) — tidak pernah diakses
   item-per-item.

4. **Label manual = tabel `recording_labels`, PUT-semantik.** List baru menggantikan seluruhnya
   (`PUT /recordings/{rid}/labels`) — sederhana untuk klien dan tidak butuh endpoint delete
   per label. Label dinormalkan dengan `sanitize_topics()` yang sama supaya filter tidak pecah
   karena variasi ejaan. Bebas-string tanpa katalog (ADR 0015 keputusan 4).

5. **`list_recordings(label=…)` mencari di KEDUA lapis sekaligus** (manual ATAU auto-tag) —
   satu konsep bagi pemanggil. Auto-tag dicocokkan `auto_tags.contains('"label"')` pada JSON
   array string; cukup untuk skala SQLite sekarang, bukan kontrak — Fase 3 menggantinya dengan
   pencarian bermakna.

6. **`get_context` mengembalikan `auto_tags` = gabungan auto-tag + label manual.** Agent tidak
   perlu tahu dua lapis itu ada; yang relevan baginya "rekaman ini tentang apa + milik project mana".

## Alternatif yang ditimbang

- **Auto-tag sebagai panggilan LLM terpisah setelah ekstraksi** — ditolak; biaya ganda untuk
  data yang lahir dari konteks yang sama.
- **Tabel `tags` ternormalisasi (tag_id ↔ recording)** — ditolak; keuntungan join tidak dibayar
  siapa pun di skala ini, dan unik `(recording_id, label)` sudah cukup mencegah duplikat.
- **Tag menyimpang = ekstraksi gagal** — ditolak; lihat keputusan 2. Konsistensi kegagalan
  dipertahankan hanya untuk kontrak inti.
- **Label manual additive (POST per label)** — ditolak; PUT-semantik lebih sedikit endpoint dan
  tidak bisa menghasilkan state setengah ter-update.
- **Katalog label tetap (pilihan terbatas)** — ditolak di ADR 0015; label project user
  bertambah terus.

## Konsekuensi

- **Skema `recording_extracts` berubah** — migrasi `migrate_add_labels.py` (ALTER + tabel
  baru); extract lama ber-`auto_tags='[]'` dan hanya terisi setelah "Buat ulang".
- **Auto-tag berbahasa Inggris kecuali diperintahkan lain** — instruksi prompt "lowercase tags"
  cenderung menghasilkan Inggris; diterima karena tag adalah kunci mesin, bukan teks bacaan.
- **`contains('"label"')` bisa false-positive pada tag yang adalah substring tag lain di JSON** —
  dibatasi oleh quote yang mengapit; risiko nyatanya kecil dan hilang di Fase 3.
- **UI label manual belum ada** — endpoint REST + tool MCP jadi dulu (kebutuhan agent);
  pengeditan dari web menyusul bersama polish UI Context.
- **`ExtractData.sanitize_topics` jadi API bersama** (route REST, MCP, ekstraksi) — perubahan
  aturan sanitasi berlaku serentak di tiga tempat; itu memang tujuannya.
