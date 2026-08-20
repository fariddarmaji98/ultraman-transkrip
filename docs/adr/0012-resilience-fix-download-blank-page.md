# ADR 0012 — Ketahanan frontend terhadap 429 gerbang tol & rate-limit polling

- Status: accepted
- Tanggal: 2026-08-20
- Terkait: [ADR 0006](0006-workspace-tiga-kolom.md) (polling progres), [ADR 0008](0008-video-downloader-dua-langkah.md) (unduh dari URL)

## Konteks

Tiga gejala yang dilaporkan bersamaan pada fitur "unduh video dari URL":

1. **Halaman putih (blank page)** saat memilih unduhan.
2. **Proses terlihat macet** setelah halaman di-refresh.
3. Unduhan YouTube tidak pernah selesai padahal `probe` (pra-unduh) berjalan normal.

Penyelidikan menemukan dua akar yang saling menguatkan:

- **Rate-limit gerbang tol (posA) terlalu rapat untuk pola polling aplikasi.**
  Frontend menyegarkan `/api/recordings` (dari `App`) dan `/api/recordings/{id}`
  (dari `TranscriptView`) **tiap 2 detik** selama ada job berjalan — sudah ±60 permintaan/menit
  tanpa menghitung panggilan lain. `RATE_LIMIT_MAX = 60` per 60 detik membuat polling itu sendiri
  kena **429**, sehingga progres tidak pernah ter-update → tampak "macet".

- **Frontend tidak tahan terhadap respons non-OK, dan 429 membuatnya crash.**
  `listRecordings()` tidak memeriksa `res.ok`; saat kena 429, ia mengembalikan objek
  `{detail: ...}` alih-alih array. `App` lalu memanggil `recordings.some(...)` dan `Sidebar`
  memanggil `recordings.filter(...)` — keduanya meledak (`xxx is not a function`) pada non-array.
  Tanpa error boundary, satu TypeError saat render = **seluruh halaman putih**.

Akar ketiga, yang memperparah "macet", sudah didokumentasikan di arsitektur: worker adalah
**satu konsumen** (`concurrency=1`), jadi transkripsi panjang memblokir job unduhan berikutnya di
antrean. Itu perilaku yang disengaja ([ADR 0003](0003-modular-monolith-not-microservices.md)) dan
di luar lingkup ADR ini; ADR ini menutup dua lubang yang bisa diperbaiki langsung.

## Keputusan

1. **Frontend harus toleran terhadap respons non-OK pada endpoint yang mengisi state "daftar".**
   - `listRecordings()` mengembalikan `[]` bila `!res.ok`.
   - `getConfig()` mengembalikan `null` bila `!res.ok`.
   Pemanggil (`recordings.some/filter`) selalu melihat tipe yang benar, apa pun status HTTP-nya.
   Endpoint lain yang sudah melempar `Error` pada `!res.ok` (mis. `getRecording`) tidak diubah.

2. **Rate-limit global dinaikkan agar muat polling, bukan ditekan.** `RATE_LIMIT_MAX` 60 → **300**
   per 60 detik per IP. Ini menyetel gerbang ke *dimensi pemakaian nyata aplikasi* (polling 2 detik ×
   2 endpoint + beban lain), bukan mematikan perlindungannya. `UPLOAD_LIMIT_MAX` dan `QUEUE_MAX_PENDING`
   tidak disentuh: jalur mahal (upload) dan antrean tetap dibatasi dengan maksud aslinya.

3. **Tidak menambah error boundary / retry di frontend.** Mengembalikan nilai aman di lapisan API
   sudah menghilangkan kelas crash-nya; retry otomatis dan error boundary adalah penanganan sekunder
   yang bisa menyembunyikan masalah di balik layar.

## Alternatif yang ditimbang

- **Menambah error boundary di akar `App`** — ditolak untuk sekarang. Itu mencegah halaman putih,
  tetapi hanya menyembunyikan akar: daftar tetap bisa menjadi non-array dan fitur berhenti bekerja.
  Memperbaiki tipe di sumber (`listRecordings`) lebih langsung.
- **Menurunkan frekuensi polling (mis. 2 → 4 detik)** — ditimbang dan ditolak. Memperlambat
  responsivitas UI demi menghindari angka yang salah disetel. Menyesuaikan ambang rate-limit ke
  pemakaian nyata lebih jujur daripada melambatkan fitur agar muat di ambang yang terlalu rendah.
- **Memisahkan worker jadi beberapa konsumen / jalur unduh terpisah** — ditunda. Itu solusi untuk
  akar ketiga (unduhan terblokir transkripsi panjang) dan berubah signifikan pada arsitektur queue.
  Layak dipertimbangkan terpisah bila antrean belakang jadi keluhan berulang.

## Konsekuensi

- **Halaman putih pada 429 hilang.** State daftar selalu bertipe benar, dan polling yang kena 429
  hanya melewatkan satu siklus (daftar kosong sekejap) lalu pulih sendiri.
- **Polling tidak lagi kena 429.** Dengan 300/menit ada ruang ~5× dari beban polling normal, jadi
  progres unduhan/transkrip terus ter-update.
- **Proteksi gerbang tol tetap hidup** — hanya batas global yang dilonggarkan. Upload (12/10 menit)
  dan antrean (20 pending) masih membatasi penyalahgunaan.
- **Keterbatasan worker satu-konsumen tetap ada**: unduhan baru menunggu transkripsi panjang yang
  sedang berjalan. Bila ini mengganggu, solusinya adalah memisahkan jalur worker (lihat alternatif),
  bukan menurunkan rate-limit lebih jauh.
