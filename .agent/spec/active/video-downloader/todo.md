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

## 4. Retensi & disk (rules §Aturan wajib no.6 — jangan ditunda)

- [ ] hitung pemakaian disk `upload_dir` → endpoint atau field di `/api/config`
- [ ] tampilkan di tab Unduh
- [ ] putuskan kebijakan retensi `upload_path` (dan catat keputusannya, walau hasilnya "belum
      dihapus otomatis")

## 5. FE — tab

- [ ] `SidebarTabs` di bawah `Brand`, tab aktif di `localStorage`
- [ ] pindahkan `UploadPanel`/`EnginePanel`/`StatsGrid`/`RecordingList` jadi isi tab Transkrip
      (**pindah, bukan tulis ulang**)
- [ ] `StatsGrid` abaikan `downloading`/`downloaded`
- [ ] `RecordingList` (Riwayat) filter: status di luar `downloading`/`downloaded`

## 6. FE — tab Unduh

- [ ] `UrlForm`: input URL + tombol Unduh + **notice ToS** (satu baris, tidak bisa disembunyikan)
- [ ] `DownloadList`: semua `source_kind === 'url'`, progress unduhan, klik → buka di kolom kanan
- [ ] `StatusBadge` tambah ikon `downloading` (spinner) + `downloaded`
- [ ] tampilkan pemakaian disk
- [ ] pesan error dari 422/502 ditampilkan apa adanya (sudah diterjemahkan di BE)

## 7. Uji

- [x] BE: probe menolak video >4 jam & >2 GB **sebelum** mengunduh (2 jam & 500 MB tetap lolos)
- [x] BE: URL ngawur → 422 "URL tidak valid"; platform tak didukung → 422 dengan pesan jelas
- [x] BE: unduh end-to-end (Big Buck Bunny CC-BY, 597 dtk) → 46 MB di `upload_path`, status
      `downloaded`, `duration_ms` terisi dari probe, `/source` balas 206 `video/mp4`
- [x] BE: unduhan gagal **tidak** meninggalkan file (dst_dir kosong setelah CaptureError)
- [x] BE: guard 409 ganti model ASR **tidak** aktif saat `downloading` (diuji saat unduhan jalan)
- [x] BE: `downloaded` tidak diantre ulang setelah restart
- [ ] BE: restart tepat saat `downloading` → requeue melanjutkan (belum diuji langsung; himpunan
      status & `_kind_for` sudah diverifikasi)
- [ ] FE: pindah tab, tab aktif bertahan setelah reload
- [ ] FE: unduh lewat UI → progress jalan → video muncul di tab Unduh → bisa diputar di kolom kanan
- [ ] FE: rekaman `downloaded` **tidak** muncul di Riwayat dan **tidak** dihitung "Diproses"
- [ ] FE: 0 error konsol

## 8. Dokumentasi

- [ ] ADR 0008: yt-dlp sebagai library + video-first + alur dua langkah + status baru
- [ ] `docs/architecture/overview.md`: modul `capture/`, tabel endpoint, status baru
- [ ] `docs/architecture/ui.md`: sidebar bertab
- [ ] README: fitur + env baru (bila ada)
- [ ] `commits.md`
