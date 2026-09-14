# ADR 0015 — Transkrip sebagai MCP Context Provider (dengan labeling)

- Status: accepted
- Tanggal: 2026-09-14
- Terkait: [ADR 0003](0003-modular-monolith-not-microservices.md), [ADR 0013](0013-extraction-transkrip.md)
- Rencana: [mcp-context-provider](../planning/mcp-context-provider.md)

## Konteks

Transkrip app kini bisa menghasilkan context terstruktur (ADR 0013), tapi hanya untuk dibaca
**manusia** lewat UI. Di sisi lain user membangun project AI agent terpisah yang butuh context
itu sebagai bahan kerja: kirim URL video, dapat context, lalu hasilkan PRD dan eksekusi.

Menghubungkan dua project lewat impor kode atau REST kustom berarti menulis klien khusus untuk
tiap kombinasi. Padahal transkripsi adalah **pekerjaan menit**, sementara agent terbiasa
bekerja **interaktif** — kontraknya harus bisa ditanya (discovery) dan menampung poll status,
bukan satu HTTP call yang menggantung.

## Keputusan

1. **Antarmuka = MCP (Model Context Protocol), bukan REST kustom.** Standar lintas tool (Claude,
   Cursor, Copilot, Hermes), punya discovery tool otomatis, dan Hermes — agent user — mendukung
   `hermes mcp` native. REST tetap ada untuk UI; MCP adalah **lapisan tipis** yang memanggil
   fungsi internal yang sama, bukan logika duplikat (pola `yt2ctx`: satu pipeline, banyak
   permukaan).

2. **Tool async: `transcribe_url` → `job_id`, lalu `get_job` poll.** Transkripsi video menit,
   bukan milidetik. Submit mengembalikan job_id seketika dan antre ke worker existing; agent
   poll `get_job` (pembungkus `GET /api/jobs/{id}`) sampai `done`, baru `get_context`. Ini pola
   `video-context-mcp` (`ingest_video` → `get_ingest_status`) — sinkron HTTP yang menunggu
   transkripsi adalah kegagalan desain yang terulang di lapangan.

3. **Tool read-only, kecuali ingest.** `get_context`, `get_job`, `list_recordings`,
   `search_context` tidak mengubah apa pun. Hanya `transcribe_url` (menambah recording) dan
   `label_recording` (menambah label) yang menulis. Agent tidak diberi kemampuan hapus/edit —
   arsip context adalah sumber kebenaran, dan side-effect yang tak perlu adalah jebakan
   (pola `aegis` "read-only MCP server").

4. **Labeling dua lapis, satu sumber metadata.** `auto_tags` (kolom JSON di `recording_extracts`,
   diisi LLM saat ekstraksi) dan `recording_labels` (tabel many-to-many, manual dari UI/agent).
   Label bebas-string tanpa katalog — katalog project terus bertambah dan katalog justru
   menghambat. Keduanya dipakai sebagai filter `list_recordings` dan nanti `search_context`.

5. **Auto-tag digabung ke prompt ekstraksi, dipisah hanya bila kualitas turun.** Satu panggilan
   LLM lebih murah dan konsisten dengan keputusan ADR 0011 (satu panggilan per tugas bila
   kontraknya bersih). Tag topik diminta sebagai kunci kelima di JSON extract — bukan panggilan
   kedua — sampai terbukti menurunkan kualitas empat kategori inti.

6. **`search_context` diwariskan ke Fase 3 (embedding), dan labeling jadi filter di depannya.**
   Urutan benar: label menyaring ruang (murah, deterministik), embedding memeringkat di dalam
   ruang tersaring (mahal, relevan). Embedding dulu tanpa label = membayar vector search untuk
   seluruh corpus setiap pertanyaan.

7. **Pola tarik (pull), bukan dorong (push).** Transkrip tidak menotifikasi agent saat selesai;
   agent poll. Push butuh webhook + retry + dedup; pull idempoten dan cukup untuk skala user
   tunggal. Ditinjau ulang hanya bila jumlah recording/agent tumbuh.

## Alternatif yang ditimbang

- **REST kustom + dokumentasi manual** — ditolak; tiap agent perlu klien sendiri, dan discovery
  (tool apa yang ada) hilang — agent tak bisa menanyakan kontrak.
- **Transkripsi sinkron dalam satu tool call** — ditolak; HTTP call menunggu menit akan timeout
  di sisi agent dan tidak ada cara menampilkan progress. Async + poll adalah satu-satunya
  kontrak yang jujur untuk pekerjaan panjang.
- **Push webhook balik ke agent** — ditolak untuk MVP; lihat keputusan 7.
- **Katalog label tetap** — ditolak; lihat keputusan 4.
- **Auto-tag sebagai panggilan LLM terpisah** — ditolak untuk awal; lihat keputusan 5.

## Konsekuensi

- **MCP server = dependensi runtime baru** (`mcp` Python SDK) di backend. Perlu diverifikasi
  kompatibel dengan Python 3.11 venv existing sebelum diterima final.
- **`recording_extracts` berubah schema** — menambah kolom `auto_tags` berarti migrasi `ALTER`
  (pola scripts/ existing) + ekstraksi ulang untuk rekaman lama yang belum punya tag. Rekaman
  lama dengan extract tetap terbaca (tag kosong = `[]`).
- **Agent bisa mengingest tanpa batas lewat MCP** — batas gerbang tol existing (rate-limit,
  queue-guard) tetap berlaku karena MCP memanggil fungsi internal yang sama, bukan jalan pintas.
- **Label manual tersebar di dua penulis** (UI + agent) — tabel `recording_labels` adalah sumber
  tunggal, keduanya lewat endpoint `label_recording`; tidak ada jalur tulis samping.
- **Otorisasi lintas-mesin belum diputuskan** — MVP lokal (agent & app satu mesin) tidak butuh;
  token bearer dibahas saat Fase 2a dikerjakan, bukan sekarang.
- **Fase 3 (embedding) tetap menunggu** — labeling membangun fondasi filter-nya lebih dulu,
  tapi `search_context` belum tersedia sampai `EmbeddingProvider` diimplementasi.
