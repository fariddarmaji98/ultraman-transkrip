# Todo — Video Downloader Fase A

Scope: **unduh berdiri sendiri**. Selesai = tempel URL → video masuk tab Unduh → bisa ditonton.
Transkrip bukan scope (Fase B). Aturan mengikat di [rules.md](rules.md).

## 1. Fondasi data ✅

- [x] `constants`: `DOWNLOAD_MAX_HEIGHT=720`, `DOWNLOAD_MAX_DURATION_S`, `JOB_DOWNLOADING`,
      `JOB_DOWNLOADED`, `SOURCE_UPLOAD`/`SOURCE_URL`, `JOB_KIND_FETCH`
- [x] **pecah `ACTIVE_STATUSES`** → `ACTIVE_STATUSES` (+`downloading`, untuk requeue) dan
      `TRANSCRIBE_BUSY_STATUSES` (tanpa `downloading`, untuk guard 409 ganti model ASR)
- [x] update pemakai keduanya: `worker/queue.requeue_pending`, `app/routes/health._active_count`
- [x] `store/models.Recording`: `source_url`, `source_kind`
- [x] skrip migrasi sekali-jalan `scripts/migrate_add_source_columns.py` — idempoten, sudah
      dijalankan di DB dev
- [x] `schemas`: `RecordingOut`/`RecordingDetail` tambah `source_kind`+`source_url`; `FromUrlIn`

## 2. Modul capture ✅

- [x] `yt-dlp` (channel nightly `2026.7.20`) ke `requirements.txt` + terpasang di venv
- [x] `capture/base.py`: Protocol `MediaSource` + `MediaInfo` + `CaptureError`/`UnsupportedUrl`/`NeedsAuth`
- [x] `capture/ytdlp.py`:
  - [x] `probe(url)` → judul, durasi, perkiraan ukuran, platform (tanpa mengunduh)
  - [x] `fetch_video(url, dst_dir, stem, on_progress)` → cap 720p, merge ffmpeg, **unduh ke temp lalu pindah**
  - [x] petakan exception yt-dlp → pesan Indonesia per-platform + logger senyap
  - [x] progress dijaga monoton (video & audio = dua stream, persennya reset di stream kedua)
- [x] `capture/__init__.get_source()`

## 3. Endpoint + worker ✅

- [x] `POST /api/recordings/from-url`: **probe sinkron** → tolak 422 bila kepanjangan/kebesaran/
      tak didukung → buat Recording(`downloading`)+Job(`fetch`) → enqueue
- [x] `worker/pipeline.run_fetch(recording_id)`: unduh → `upload_path` → status `downloaded`
- [x] progress: `progress_hooks` (thread) → holder dict + poller async (`_poll` dipakai bersama)
- [x] `worker_loop` memilih `run_fetch` vs `run_transcribe` berdasarkan `Job.kind`
- [x] idempoten: `_fetch` melewati unduhan bila file sudah ada; `_load` memilih job per-kind

## 4. Retensi & disk ✅

- [x] `GET /api/storage`: jumlah berkas + terpakai + sisa disk (endpoint sendiri, bukan `/api/config`
      — agar pemindaian folder tidak jalan tiap kali panel Engine dimuat)
- [x] tampilkan di tab Unduh (`StorageInfo`)
- [x] **kebijakan retensi diputuskan: belum ada penghapusan otomatis.** Menghapus file besar milik
      user diam-diam lebih berbahaya daripada disk penuh yang kelihatan. Angka disk ditampilkan dulu;
      kebijakan menyusul saat polanya terlihat. Alasan lengkap di ADR 0008.

## 5. FE — tab ✅

- [x] `SidebarTabs` di bawah `Brand`, tab aktif di `localStorage` (`useLocalState`)
- [x] `UploadPanel`/`EnginePanel`/`StatsGrid`/`RecordingList` pindah ke `TranscribeTab` apa adanya
- [x] `StatsGrid` hanya menghitung item tab Transkrip (unduhan tak ikut "Diproses")
- [x] Riwayat filter `inTranscriptPhase`; badge jumlah di tiap tab
- [x] `RecordingList` diberi prop `emptyText`/`confirmTitle`/`confirmMessage` supaya dipakai ulang
      dua tab tanpa komponen kembar

## 6. FE — tab Unduh ✅

- [x] `UrlForm`: input URL + tombol + **notice ToS**; error tampil, isian tidak dihapus
- [x] daftar `source_kind === 'url'` dengan bar progres unduhan (`MiniBar`)
- [x] `StatusBadge` tambah `downloading` (spinner) + `downloaded` (ikon unduh)
- [x] `StorageInfo` pemakaian disk
- [x] `TranscriptView` menangani `downloading` (bar) dan `downloaded` (catatan jujur, tanpa stepper
      transkrip yang tidak relevan)
- [x] polling daftar saat ada job aktif (App) supaya bar bergerak tanpa reload

## 7. Uji

- [x] BE: probe menolak video >4 jam & >2 GB **sebelum** mengunduh (2 jam & 500 MB tetap lolos)
- [x] BE: URL ngawur → 422 "URL tidak valid"; platform tak didukung → 422 dengan pesan jelas
- [x] BE: unduh end-to-end (Big Buck Bunny CC-BY, 597 dtk) → 46 MB di `upload_path`, status
      `downloaded`, `duration_ms` terisi dari probe, `/source` balas 206 `video/mp4`
- [x] BE: unduhan gagal **tidak** meninggalkan file (dst_dir kosong setelah CaptureError)
- [x] BE: guard 409 ganti model ASR **tidak** aktif saat `downloading` (diuji saat unduhan jalan)
- [x] BE: `downloaded` tidak diantre ulang setelah restart
- [x] BE: restart tepat saat `downloading` → requeue melanjutkan. Diuji sungguhan: backend dibunuh
      saat progres 33%, DB tersangkut `downloading` dengan `upload_path` kosong dan **tanpa file
      separuh** di `uploads`; setelah restart unduhan dipungut lagi dan tuntas (61% → 99% → 100%)
- [x] FE: pindah tab, tab aktif bertahan setelah reload (`sidebar-tab` = `unduh`)
- [x] FE: unduh lewat UI → bar bergerak tanpa reload → video muncul di tab Unduh → diputar di kolom
      kanan dari `/api/recordings/{id}/source`
- [x] FE: rekaman `downloaded` **tidak** muncul di Riwayat (2 dari 3) dan **tidak** dihitung
      "Diproses" (Total 2, Diproses 0)
- [x] FE: URL salah → pesan Indonesia tampil, isian tidak dihapus
- [x] FE: hapus dari tab Unduh → konfirmasi "Hapus video?", file hilang dari disk, angka disk ikut
      turun
- [x] FE: 0 error konsol

## 8. Dokumentasi ✅

- [x] [ADR 0008](../../../../docs/adr/0008-video-downloader-dua-langkah.md): yt-dlp sebagai library,
      video-first, alur dua langkah, status baru, alasan menolak API downloader pihak ketiga
- [x] `docs/architecture/overview.md`: modul `capture/`, tabel endpoint, model data + status
- [x] `docs/architecture/ui.md`: sidebar bertab + peta komponen
- [x] `apicontract.md`: `/api/storage` + `progress` di daftar
- [x] README: fitur + index ADR
- [x] `commits.md`

## 9. Fase B — tombol transkrip ✅

- [x] `POST /api/recordings/{id}/transcribe`: buat job `transcribe`, status `queued`, enqueue;
      404 / 409 (sedang diproses) / 422 (file sumber hilang)
- [x] FE: tombol **"Transkrip sekarang"** pada rekaman `downloaded` di kolom kanan
- [x] FE: tombol **"Transkrip ulang"** di header untuk status `done`/`failed`
- [x] polling `TranscriptView` bisa dimulai ulang (state `round`) setelah tombol ditekan
- [x] uji: video terunduh → transkrip jalan penuh (`extracting → transcribing → done`)
- [x] uji: transkrip ulang rekaman Indonesia 5:43 → **104 segmen → 104 segmen**, tidak menggandakan
- [x] uji: guard 404 / 409 / 422

## 10. Fase C — pengerasan ✅ (kecuali PO token)

- [x] jeda acak 3–10 dtk sejak unduhan terakhir **selesai** (`_throttle`) — teruji 7,8 / 4,1 / 9,4 dtk
- [x] versi yt-dlp + umurnya tampil di tab Unduh; kuning bila lewat `YTDLP_STALE_DAYS`
- [x] `scripts/update_ytdlp.py` (nightly, laporkan versi sebelum/sesudah)
- [x] cookies per-platform: unggah/hapus, disimpan server-side, dipilih otomatis dari domain URL;
      validasi format Netscape; isi tidak pernah dikirim balik
- [ ] **PO token — ditunda ke fase deploy** (keputusan user). Docker absen; manfaatnya tak bisa
      diverifikasi dari IP rumah. Pasang bersamaan kerja VPS agar teruji dari IP pusat data.

## Sisa untuk fase berikutnya
- [ ] Fase D: Instagram/Facebook, subtitle-first sebagai opsi
- [ ] Fase E: SSE, cancel job, batch/playlist, proxy, pilih kualitas
