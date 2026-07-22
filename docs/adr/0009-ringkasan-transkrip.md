# ADR 0009 — Ringkasan transkrip (M2): sinkron, map-reduce, tabel sendiri

- Status: accepted
- Tanggal: 2026-07-22
- Terkait: [ADR 0006](0006-workspace-tiga-kolom.md), [ADR 0007](0007-mesin-ai-dipilih-dari-ui.md), [colibri-direction.md](../planning/colibri-direction.md)

## Konteks

Kolom tengah workspace ([ADR 0006](0006-workspace-tiga-kolom.md)) sengaja dikunci sampai ada mesin
AI. [ADR 0007](0007-mesin-ai-dipilih-dari-ui.md) menyediakan mesinnya (pilih provider + kunci API,
dengan tes koneksi). Yang belum ada: **pemakainya**.

Ini M2 di roadmap — ringkasan + poin aksi di atas transkrip yang sudah jadi.

Kendala nyata yang harus dijawab: transkrip 28 menit = 945 segmen ≈ 20.000 karakter. Muat di
DeepSeek (context panjang), **tidak** muat di Ollama lokal yang default-nya sering hanya 8k token.
Padahal keduanya harus sama-sama didukung.

## Keputusan

1. **Endpoint sinkron** `POST /api/recordings/{id}/summarize`, bukan job di antrean worker.
   Terukur: transkrip 5:43 selesai **4,9 detik**, transkrip 28 menit **16 detik** — jauh di bawah
   timeout 120 detik. Menambah jenis job ketiga (`fetch`/`transcribe`/`summarize`) beserta status,
   progress, dan polling-nya tidak sepadan untuk pekerjaan belasan detik.
2. **Map-reduce untuk transkrip panjang**: dipotong per baris (kalimat tidak terbelah), tiap potongan
   diringkas, lalu ringkasan-ringkasan digabung jadi satu.
3. **Ambang potongan dibuat untuk provider terkecil, bukan terbesar** —
   `SUMMARY_CHUNK_CHARS = 12000`, aman untuk Ollama 8k. Menyetelnya ke kapasitas DeepSeek akan
   membuat mode lokal gagal, padahal mode lokal justru yang privat.
4. **Pemotongan tidak senyap.** Bila transkrip melebihi `SUMMARY_MAX_CHUNKS`, ringkasan diakhiri
   catatan bahwa hanya bagian awal yang tercakup.
5. **Tabel `summaries` sendiri**, bukan kolom di `recordings`. Satu baris per recording (dibuat ulang
   = baris lama diganti). Bonus praktis: `create_all` **membuat tabel baru** tanpa masalah, sementara
   menambah kolom ke tabel lama butuh skrip ALTER manual seperti di [ADR 0008](0008-video-downloader-dua-langkah.md).
6. **Provider & model ikut disimpan.** Hasil dari mesin berbeda tidak sebanding; tanpa jejak ini
   tidak ada cara tahu ringkasan lama dibuat oleh apa. Ditampilkan juga di UI.
7. **Prompt melarang mengarang** secara eksplisit ("jangan menambahkan informasi yang tidak ada di
   transkrip; bila sesuatu tidak disebutkan, katakan tidak ada").
8. **Renderer Markdown mini sendiri** (`SummaryText`) untuk tiga bentuk yang memang kita minta:
   `## judul`, `- butir`, paragraf.

## Alternatif yang ditimbang

- **Job di antrean worker** — ditolak untuk sekarang, bukan selamanya. Pemicunya jelas: begitu ada
  transkrip yang mendekati timeout 120 detik, atau begitu chat (M3) butuh streaming, pindahkan.
  Antrean, `Job.kind`, dan pola polling sudah ada tinggal dipakai.
- **Kolom `summary` di `recordings`** — ditolak; kehilangan provenance provider/model, dan menambah
  kolom ke tabel yang sudah berisi data butuh migrasi manual.
- **Kirim seluruh transkrip mentah tanpa potong** — ditolak; berhasil di DeepSeek, gagal di Ollama.
  Fitur yang cuma jalan di satu provider bukan fitur yang bisa dijanjikan.
- **Potong berdasarkan token, bukan karakter** — ditunda; butuh tokenizer per-provider. Ambang
  karakter yang konservatif memberi hasil yang sama dengan jauh lebih sedikit mesin.
- **Library Markdown (`react-markdown` dkk.)** — ditolak; puluhan KB untuk tiga jenis blok yang
  formatnya kita sendiri yang tentukan lewat prompt.
- **Streaming jawaban** — ditunda ke M3 bersama chat, sesuai ADR 0007 yang sengaja menyederhanakan
  Protocol `LLMProvider` jadi `async complete()`.
- **Ringkasan otomatis begitu transkrip selesai** — ditolak; tiap panggilan berbiaya (API berbayar)
  dan tidak semua rekaman perlu diringkas. Biarkan user yang memutuskan.

## Konsekuensi

- **Panel AI sekarang setengah hidup**: ringkasan berfungsi, chat masih terkunci. Penanda merah
  "belum aktif" di header panel dihapus karena tidak lagi benar; keterangan "segera" tinggal di
  bagian chat saja.
- **Tiap klik "Buat ulang" memanggil API berbayar.** Tidak ada cache selain baris `summaries` yang
  tersimpan — menekan tombol itu artinya membayar lagi.
- **Ganti mesin AI tidak membatalkan ringkasan lama.** Ringkasan lama tetap ada dengan nama model
  lamanya tertera; user yang memutuskan mau dibuat ulang atau tidak.
- **Ringkasan belum ikut ekspor.** TXT/SRT/JSON masih berisi transkrip saja.
- **Makin panjang transkrip, makin banyak panggilan API** (map-reduce = N+1 panggilan). Untuk rekaman
  sangat panjang ini terasa di biaya maupun waktu.
- `analysis/` kini berisi seam (`base`), adapter (`openai_compat`), dan pemakai pertamanya
  (`summarize`) — pola yang sama akan dipakai chat di M3.
