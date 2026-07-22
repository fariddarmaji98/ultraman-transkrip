# ADR 0008 — Video downloader: yt-dlp sebagai library, video-first, alur dua langkah

- Status: accepted
- Tanggal: 2026-07-22
- Terkait: [ADR 0003](0003-modular-monolith-not-microservices.md), [ADR 0005](0005-model-asr-runtime.md), [ADR 0006](0006-workspace-tiga-kolom.md), [planning](../planning/video-downloader.md), [spec Fase A](../../.agent/spec/active/video-downloader/rules.md)

## Konteks

Untuk mentranskrip video sosmed, alurnya selama ini manual: buka situs downloader pihak ketiga →
unduh file → unggah ke aplikasi. Jejaknya masih terlihat di data: judul rekaman lama berawalan
`vidssave.com` sampai `clean_title()` dibuat untuk membersihkannya.

Revisi pertama planning memilih **subtitle-first + audio-only**: ambil caption bawaan platform bila
ada, kalau tidak unduh audio saja. Setelah dibahas, user memilih arah berbeda — **unduh videonya,
transkrip belakangan** — karena videonya sendiri memang ingin disimpan, bukan cuma teksnya.

## Keputusan

**yt-dlp sebagai library di balik interface `MediaSource`, mengunduh video (cap 720p), berhenti di
status `downloaded`; transkrip adalah aksi terpisah.**

1. **yt-dlp sebagai library** (`import yt_dlp`), bukan subprocess — dapat info terstruktur dan
   progress hook tanpa mem-parse stdout. Di balik Protocol `MediaSource`, jadi bisa ditukar
   (Cobalt dll) tanpa mengubah pemanggil — pola yang sama dengan `ASRProvider` dan `LLMProvider`.
2. **Video, cap 720p** (`DOWNLOAD_MAX_HEIGHT`). Ukurannya sepadan: file hasil unduhan **identik
   dengan file hasil upload**, disimpan ke `upload_path` yang sama — sehingga ffprobe, ffmpeg,
   ASRProvider, player, `/source`, Range request, rename, dan hapus semuanya jalan **tanpa satu pun
   perubahan**. Jalur audio-only justru lebih repot karena player jadi kasus khusus.
3. **Alur dua langkah.** Unduhan berhenti di `downloaded`; transkrip dijalankan terpisah (Fase B).
   User bisa mengunduh beberapa video lalu memilih mana yang perlu ditranskrip, dan pekerjaan berat
   (CPU) tidak dipaksa jalan untuk video yang cuma ingin disimpan.
4. **Probe dulu, tolak sebelum mengunduh.** `extract_info(url, download=False)` menolak >4 jam atau
   >2 GB dengan **422** sebelum sebyte pun turun, sekaligus mengisi `duration_ms` di respons 201 —
   cermin ffprobe sinkron di jalur upload.
5. **Unduh ke temp, pindah saat sukses.** Unduhan gagal/terputus tidak pernah meninggalkan file
   separuh di `upload_path`.
6. **`ACTIVE_STATUSES` dipecah dua**: `ACTIVE_STATUSES` (requeue startup, **termasuk**
   `downloading`) dan `TRANSCRIBE_BUSY_STATUSES` (guard 409 ganti model ASR, **tanpa**
   `downloading` — mengunduh tidak memakai Whisper).
7. **Sidebar dibagi tab** `[Transkrip] [Unduh]`; hasil unduhan **tetap tinggal di tab Unduh** sebagai
   arsip. Riwayat di tab Transkrip hanya menampilkan yang sudah masuk pipeline transkrip.
8. **Tidak ada penghapusan otomatis.** Sebagai gantinya pemakaian disk ditampilkan di tab Unduh
   lewat `GET /api/storage`.

## Alternatif yang ditimbang

- **Memanggil API situs downloader** (vidssave/ytdown dan sejenisnya) sebagai backend — **ditolak
  tegas**. Godaannya besar (tinggal hit endpoint, gratis, langsung jalan), tapi itu menumpang
  infrastruktur orang lain, hampir pasti melanggar ToS mereka, dan rusak begitu mereka berubah —
  ketergantungan yang tidak bisa kita perbaiki sendiri.
- **Subtitle-first + audio-only** (rencana revisi pertama) — dipertahankan sebagai fase belakangan,
  bukan strategi utama. Konsekuensinya diterima sadar: merip stream video justru bagian yang paling
  dijaga YouTube, jadi bot-check ketemu lebih cepat daripada kalau kita cuma mengambil caption.
- **Transkrip otomatis setelah unduh** — ditolak; user eksplisit ingin bisa mengunduh tanpa
  mentranskrip.
- **Kualitas terbaik (1080p/4K)** — ditolak; file membengkak tanpa menambah kualitas transkrip
  sedikit pun, dan 720p sudah cukup untuk ditonton sambil membaca transkrip.
- **Antrean terpisah untuk unduhan** — ditolak; antrean in-process yang ada cukup, `worker_loop`
  tinggal memilih pipeline berdasarkan `Job.kind`. Dua antrean = dua hal yang bisa macet.
- **Hapus otomatis video lama** — ditunda. Menghapus file besar milik user diam-diam lebih berbahaya
  daripada disk penuh yang kelihatan. Angka pemakaian disk dulu; kebijakan retensi menyusul saat
  polanya terlihat.
- **Satu daftar untuk semua rekaman** — ditolak; user minta pemisahan tegas lewat tab.

## Konsekuensi

- **Satu recording kini bisa punya dua job** (`fetch` lalu `transcribe`). Semua kode yang dulu
  berasumsi "satu job per recording" harus memilih per-`kind` atau mengambil job terbaru — termasuk
  `_load` di pipeline dan pengambilan progress di route.
- **Progress di daftar butuh query tambahan.** `GET /api/recordings` mengambil progress job terbaru
  per recording lewat subquery `MAX(id)`, karena tanpa itu bar unduhan di sidebar tidak bergerak.
- **`downloaded` adalah status "diam"**: bukan aktif (tidak di-requeue, tidak dihitung "Diproses"),
  tapi juga belum selesai. Ini status pertama di aplikasi yang menunggu aksi user, bukan menunggu
  mesin.
- **Disk tumbuh tanpa batas.** `MEDIA_RETENTION_DAYS` hanya membersihkan `media_path` (audio hasil
  ekstraksi), bukan video di `upload_path`. Ini utang yang disengaja dan sekarang kelihatan angkanya.
- **YouTube belum tahan banting.** Berhasil dari IP rumah saat diuji, tapi PO token, cookies, dan
  rate-limit (Fase C) belum ada — dari IP datacenter kemungkinan besar gagal. UI menyebutkan ini
  apa adanya ("TikTok dan X paling mulus; YouTube kadang minta login") daripada menjanjikan.
- **yt-dlp wajib di-update rutin.** Extractor rusak tiap situs berubah; channel nightly di-pin di
  `requirements.txt` dan ini bukan opsional.
- Kolom kanan (ADR 0006) **tidak berubah sama sekali** — video hasil unduhan tampil di player yang
  sudah ada karena filenya diperlakukan persis seperti hasil upload.
