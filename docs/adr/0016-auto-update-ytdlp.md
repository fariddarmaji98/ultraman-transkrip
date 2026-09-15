# ADR 0016 — Pemeliharaan yt-dlp otomatis: update in-process + self-restart terjadwal

- Status: accepted
- Tanggal: 2026-09-15
- Terkait: [ADR 0008](0008-video-downloader-dua-langkah.md), [ADR 0012](0012-resilience-fix-download-blank-page.md)
- Rencana: — (otomasi operasional pada jalur unduhan yang sudah ada)

## Konteks

Repo ini memakai yt-dlp channel **NIGHTLY** dengan aturan eksplisit: "extractor rusak tiap situs
berubah — update rutin, bukan opsional" (`requirements.txt`, `YTDLP_STALE_DAYS = 14`). Sampai
sekarang pembaruannya manual: kartu status di UI memperingatkan umur versi dan menyuruh pengguna
menjalankan `scripts/update_ytdlp.py` lalu restart backend.

App ini hendak dipublikasikan. Instruksi operasional semacam itu tidak boleh sampai ke pengguna
akhir — mereka tidak punya akses terminal, dan versi basi yang dibiarkan adalah penyebab kegagalan
unduh nomor satu. Pemeliharaan harus menjadi urusan sistem, bukan manusia.

Tiga kebutuhan user (eksplisit): update **setiap server start**, cek **harian** saat server hidup
terus, dan **splashscreen maintenance** di UI selama pembaruan berlangsung — lalu otomatis kembali
ke tampilan semula.

## Keputusan

1. **Updater hidup di dalam proses backend** (`app/updater.py`, task asyncio di lifespan) — bukan
   cron eksternal, bukan container sidecar. Server ini single-user MVP dengan launcher Task
   Scheduler; menambah proses pemeliharaan terpisah berarti menambah satu lagi hal yang bisa mati
   diam-diam, dan update yang dilakukan proses luar tetap butuh restart backend untuk dipakai —
   tidak ada yang dihemat.

2. **Siklus: update saat startup (selalu), lalu cek tiap 24 jam** (update bila versi ≥ 1 hari).
   Startup selalu karena momen paling aman untuk mengganti paket adalah saat tidak ada request;
   harian dengan ambang umur supaya `uv` tidak menunggu jaringan tiap hari saat upstream diam.

3. **Install HANYA core `yt-dlp`, tanpa extras `[default]`.** Pelajaran dari insiden: updater
   pertama memakai `yt-dlp[default]` yang ikut meng-upgrade `websockets` — paket yang sedang
   di-import uvicorn — Windows menimpa filenya, dan backend crash saat restart. Extras
   (curl_cffi, mutagen, dst.) di-install sekali lewat `requirements.txt` dan tidak berubah
   sepeserpun antar rilis nightly.

4. **Setelah versi berubah: proses keluar dengan rapi, launcher membangkitkan ulang.**
   `importlib.reload(yt_dlp)` dicoba dan **terbukti tidak cukup**: modul lain
   (`capture/ytdlp.py`, `health.py`) memegang referensi objek lama hasil `from yt_dlp import …`,
   sehingga `/api/config` melaporkan versi basi padahal disk sudah baru. Self-exit tertunda 3
   detik (respons terakhir sempat terkirim) + watchdog Task Scheduler (tiap 5 menit, idempoten)
   = restart yang andal tanpa supervisor tambahan.

5. **Status diekspos lewat `GET /api/maintenance`** (`{updating, message, last_result}`), dipoll
   frontend tiap 2 detik. Splashscreen `MaintenanceOverlay` dirender dari state itu — hilang
   sendiri saat `updating` kembali false, tanpa timer, tanpa reload, apa pun lamanya proses.

6. **Pesan umur versi di UI tidak lagi menyebut instruksi manual.** `stale: true` tetap
   dilaporkan jujur (fakta versi), tapi teksnya kini "pembaruan otomatis akan memperbarui saat
   rilis nightly tersedia" — kejujuran tanpa pekerjaan rumah untuk pengguna.

## Alternatif yang ditimbang

- **Cron/scheduled task eksternal menjalankan update_ytdlp.py + restart** — ditolak; butuh
  mekanisme restart eksternal yang mengelola hidup-mati server (duplikasi launcher), dan window
  "disk baru, proses lama" tetap ada tanpa splashscreen yang koheren.
- **`importlib.reload` tanpa restart** — ditolak setelah diuji; lihat keputusan 4. Terlihat
  paling elegan di atas kertas, gagal diam-diam di praktik.
- **Restart via uvicorn `--reload` watcher** — ditolak; dirancang untuk development, memantau
  file sumber (bukan site-packages), dan perilakunya lintas platform tidak menjanjikan.
- **Hot-swap dengan mengganti `sys.modules` + re-import di semua pemanggil** — ditolak;
  menyebar logika reload ke banyak modul untuk menghindari satu restart yang sudah gratis dari
  launcher.
- **Extras ikut di-update tiap siklus** — ditolak; insiden websockets (keputusan 3).

## Konsekuensi

- **Ada window 3 detik + hingga 5 menit (interval watchdog) di mana backend mati setelah update.**
  Frontend sudah menangani: poll gagal = status maintenance terakhir tetap tampil, dan request
  berikutnya berhasil begitu proses baru hidup. Untuk MVP single-user ini diterima; interval
  watchdog bisa diperseketika bila mengganggu.
- **Update harian yang gagal (jaringan, PyPI down) tidak mengulang sampai 24 jam berikutnya.**
  Sengaja: retry agresif hanya menambah beban, dan kegagalan satu hari tidak membuat versi
  "basi" secara berbahaya (ambang stale 14 hari).
- **`scripts/update_ytdlp.py` tetap ada** sebagai jalur manual (debugging, environment tanpa
  launcher) — tapi bukan lagi jalur utama dan tidak lagi disebut UI.
- **Self-restart memakai `os._exit(0)`** — kasar untuk asyncio (task tidak di-cancel rapi), tapi
  di kasih delay 3 detik dan antrean job bersifat requeue-able (`requeue_pending()`), jadi tidak
  ada pekerjaan yang hilang; job berjalan dilanjutkan saat proses baru menyala.
- **Tes siklus penuh butuh versi lama dipasang dulu** (turunkan versi manual → restart →
  amati). Dokumentasikan pola tes ini kalau updater diubah kelak.
