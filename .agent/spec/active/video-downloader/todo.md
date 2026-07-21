# Todo — Video Downloader Fase A

Scope: **unduh berdiri sendiri**. Selesai = tempel URL → video masuk tab Unduh → bisa ditonton.
Transkrip bukan scope (Fase B). Aturan mengikat di [rules.md](rules.md).

## 1. Fondasi data

- [ ] `constants`: `DOWNLOAD_MAX_HEIGHT=720`, `DOWNLOAD_MAX_DURATION_S`, `JOB_DOWNLOADING`,
      `JOB_DOWNLOADED`, `SOURCE_UPLOAD`/`SOURCE_URL`, `JOB_KIND_FETCH`
- [ ] **pecah `ACTIVE_STATUSES`** → `ACTIVE_STATUSES` (+`downloading`, untuk requeue) dan
      `TRANSCRIBE_BUSY_STATUSES` (tanpa `downloading`, untuk guard 409 ganti model ASR)
- [ ] update pemakai keduanya: `worker/queue.requeue_pending`, `app/routes/health._active_count`
- [ ] `store/models.Recording`: `source_url`, `source_kind`
- [ ] skrip migrasi sekali-jalan di `backend/scripts/` (ALTER TABLE) — `create_all` tidak mengubah
      tabel lama; jalankan di DB yang sudah ada
- [ ] `schemas`: `RecordingOut`/`RecordingDetail` tambah `source_kind`+`source_url`; `FromUrlIn`

## 2. Modul capture

- [ ] `yt-dlp` (channel nightly) ke `requirements.txt` + install ke venv
- [ ] `capture/base.py`: Protocol `MediaSource` + dataclass `MediaInfo`
- [ ] `capture/ytdlp.py`:
  - [ ] `probe(url)` → judul, durasi, perkiraan ukuran, platform (tanpa mengunduh)
  - [ ] `fetch_video(url, dst, on_progress)` → cap 720p, merge ffmpeg, **unduh ke temp lalu pindah**
  - [ ] petakan exception yt-dlp → pesan Indonesia per-platform (rules §Aturan wajib no.4)
- [ ] `capture/__init__.get_source()`

## 3. Endpoint + worker

- [ ] `POST /api/recordings/from-url`: validasi URL → **probe sinkron** → tolak 422 bila kepanjangan/
      kebesaran/tak didukung → buat Recording(`downloading`)+Job(`fetch`) → enqueue
- [ ] `worker/pipeline.run_fetch(recording_id)`: unduh → `upload_path` → status `downloaded`;
      gagal → `failed` + pesan
- [ ] progress: `progress_hooks` (thread) → holder dict + poller async (pola `_transcribe`)
- [ ] `worker_loop` memilih `run_fetch` vs `run_transcribe` berdasarkan `Job.kind`
- [ ] idempoten: job diulang setelah restart tidak menggandakan file

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

- [ ] BE: probe menolak video >4 jam & >2 GB **sebelum** mengunduh (curl)
- [ ] BE: URL ngawur → 422; platform tak didukung → 422 dengan pesan jelas
- [ ] BE: unduh TikTok pendek end-to-end → file ada di `upload_path`, status `downloaded`,
      `duration_ms` terisi
- [ ] BE: unduhan gagal di tengah **tidak** meninggalkan file di `upload_path`
- [ ] BE: guard 409 ganti model ASR **tidak** ikut aktif saat status `downloading`
- [ ] BE: restart saat `downloading` → requeue jalan
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
