# Pemeliharaan yt-dlp Otomatis (Auto-Update + Splashscreen Maintenance)

- Tanggal: 15-09-2026
- Status: implemented
- Terkait: [ADR 0016](../../adr/0016-auto-update-ytdlp.md), [ADR 0012](../../adr/0012-resilience-fix-download-blank-page.md)

## Summary

yt-dlp kini diperbarui **otomatis**: setiap backend start (selalu) dan setiap 24 jam saat server
hidup. Selama pembaruan berlangsung, frontend menampilkan **splashscreen maintenance** yang
menghalangi interaksi dan **hilang sendiri** setelah selesai. Setelah versi berubah, backend
**restart otomatis** via launcher Task Scheduler — pengguna tidak pernah melihat instruksi
operasional (`scripts/update_ytdlp.py`) yang sebelumnya muncul di kartu "Mesin Unduh".

## Motivation

Aplikasi hendak dipublikasikan. Aturan channel NIGHTLY (extractor rusak tiap situs berubah,
`YTDLP_STALE_DAYS = 14`) berarti versi basi = unduhan gagal — dan perbaikan sebelumnya berupa
peringatan + instruksi manual di UI, yang tidak layak tampil ke pengguna akhir.

## Proposed Solution

1. `app/updater.py` — task asyncio di lifespan backend (satu proses, tidak ada layanan tambahan).
2. `GET /api/maintenance` — status updater untuk frontend.
3. `MaintenanceOverlay.jsx` — splashscreen state-driven (poll 2 detik), bukan timer.
4. Self-restart: setelah versi berubah, proses keluar dengan rapi → watchdog Task Scheduler
   (`ultraman-transkrip-watchdog`, interval 5 menit, idempoten) membangkitkan ulang.
5. Kartu "Mesin Unduh" menampilkan pesan pemeliharaan otomatis, tanpa instruksi manual.

## Architecture Overview

```
lifespan (app/main.py)
   └─ updater.maintenance_loop()
        ├─ startup: run_update(force=True)          ← selalu
        └─ tiap 24 jam: cek umur versi ≥ 1 hari → run_update()

run_update()
   ├─ _state: updating=True → /api/maintenance → FE poll → SPLASHSCREEN
   ├─ uv pip install -U --prerelease=allow yt-dlp   (CORE saja, bukan [default])
   ├─ versi berubah?
   │    └─ _request_restart(): delay 3s → os._exit(0)
   │         → Task Scheduler watchdog → backend baru (yt-dlp baru aktif)
   └─ _state: updating=False → splashscreen hilang otomatis

App.jsx ── poll /api/maintenance (2s) ──► <MaintenanceOverlay status={…} />
```

## Module / File Structure

| File | Perubahan |
|---|---|
| `backend/app/updater.py` | **Baru** — loop maintenance, install, self-restart, status |
| `backend/app/main.py` | Task `maintenance_loop()` di lifespan |
| `backend/app/routes/health.py` | `GET /maintenance` |
| `frontend/web/src/api.js` | `getMaintenance()` (null-safe saat backend restart) |
| `frontend/web/src/components/MaintenanceOverlay.jsx` | **Baru** — splashscreen fullscreen |
| `frontend/web/src/App.jsx` | Poll 2 detik + render overlay |
| `frontend/web/src/components/DownloaderInfo.jsx` | Pesan tanpa instruksi manual |
| `scripts/start-servers.{ps1,cmd}` | **Baru** — launcher (ONLOGON + watchdog) |

## Backend Flow

1. Backend start → lifespan menjalankan `maintenance_loop()`.
2. Startup: install nightly terbaru (core saja). `updating=true` selama berlangsung.
3. Versi berubah → catat `last_result` → `_request_restart()`: tunggu 3 detik → `os._exit(0)`.
4. Watchdog (maks 5 menit) menjalankan launcher → backend baru memakai yt-dlp baru →
   `requeue_pending()` melanjutkan job yang terputus.
5. Versi sama → `updated=false`, tanpa restart, splashscreen berlalu seketika.

## Config & Setting

- Tidak ada env/konstanta baru yang wajib diset. Ambang internal di `updater.py`:
  `_DAILY_S = 24 jam`, `_DAILY_MAX_AGE_DAYS = 1`.
- `YTDLP_STALE_DAYS = 14` (constants) tetap dipakai `/api/config` untuk status kartu Mesin Unduh.
- Launcher `scripts/start-servers.ps1` — idempoten (cek health dulu), log di `.logs/`.

## Recovery & Edge Cases

| Kasus | Perilaku |
|---|---|
| PyPI down / jaringan gagal saat update | `last_result.ok=false`, tanpa restart; dicoba lagi 24 jam berikutnya; server tetap hidup dengan versi lama |
| Backend mati saat window self-restart | Watchdog membangkitkan dalam ≤ 5 menit; job di-requeue otomatis |
| FE terbuka saat backend restart | Poll gagal = status terakhir dipertahankan; request berikutnya berhasil begitu hidup |
| Versi sudah terbaru | `updated=false`, splashscreen hanya sekejap (tidak ada unduhan) |
| Upstream tidak merilis nightly berhari-hari | `stale=true` tetap jujur tampil, teks "akan diperbarui saat tersedia" |
| Update ikut mengganti dependensi | Tidak terjadi — hanya core `yt-dlp` (pelajaran insiden websockets/uvicorn, ADR 0016 keputusan 3) |

## Privasi

- Tidak ada data keluar: proses update hanya menghubungi index paket (PyPI) lewat `uv`.
- Teks transkrip/LLM tidak tersentuh sama sekali oleh jalur ini.

## Comments / Discussions

- `importlib.reload` sempat dipilih ("tanpa restart") dan **gagal di uji nyata**: modul lain
  memegang referensi lama, `/api/config` melaporkan versi basi. Self-restart + watchdog dipilih
  karena sudah tersedia gratis dari launcher permanen. Detail di ADR 0016.
- Pola tes siklus penuh: pasang versi lama (`uv pip install yt-dlp==2026.8.4…`), restart, amati
  `/api/maintenance` → `/api/config` melaporkan versi baru.
- `scripts/update_ytdlp.py` dipertahankan sebagai jalur manual/debugging, tidak lagi disebut UI.
