# Video Downloader — Fase A (unduh berdiri sendiri)

Breakdown teknis Fase A dari [planning](../../../../docs/planning/video-downloader.md).
**Transkrip BUKAN scope spec ini** — Fase A selesai saat video terunduh, masuk daftar, dan bisa
ditonton. Tombol transkrip menyusul di Fase B.

## Main

- fitur: tempel URL sosmed → backend mengunduh video (cap 720p) → masuk tab Unduh → bisa ditonton
- modul baru: `backend/capture/` (nama dari peta modul [ADR 0003](../../../../docs/adr/0003-modular-monolith-not-microservices.md))
- FE: sidebar dibagi tab `[Transkrip] [Unduh]`; **kolom kanan tidak disentuh** (ADR 0006)
- target uji Fase A: **TikTok & X** (paling mulus). YouTube boleh dicoba tapi kegagalannya
  bukan blocker — itu Fase C

## Stack

- **yt-dlp sebagai library** (`import yt_dlp`), bukan subprocess — structured info + progress hooks
  tanpa parsing stdout
- pin channel **nightly** di `requirements.txt`; extractor rusak saat situs berubah adalah normal
- ffmpeg (sudah ada) untuk merge video+audio yang terpisah
- tidak ada dependensi lain

## Store

- `Recording` tambah: **`source_url`** (nullable, String 1024), **`source_kind`** (String 8,
  default `upload`, nilai `upload|url`)
- `create_all` tidak mengubah tabel yang sudah ada → **tulis skrip migrasi kecil sekali-jalan**
  (`ALTER TABLE recordings ADD COLUMN …`) di `backend/scripts/`, jangan andalkan `create_all`.
  Alembic tetap ditunda (konsisten deviasi terukur webapp-transkrip-mvp)
- `Job.kind` mulai dipakai sungguhan: **`fetch`** (baru) di samping `transcribe`

## Status

Status baru: **`downloading`** dan **`downloaded`**. Urutan penuh:

```
url    : downloading → downloaded → [Fase B: queued → extracting → transcribing → done]
upload : queued → extracting → transcribing → done          (tidak berubah)
gagal  : failed (dari mana saja)
```

- **`ACTIVE_STATUSES` WAJIB dipecah dua** — sekarang satu konstanta dipakai dua tujuan yang mulai
  berbeda:
  - `ACTIVE_STATUSES` (requeue saat startup) → **termasuk** `downloading`
  - `TRANSCRIBE_BUSY_STATUSES` (guard 409 ganti model ASR, [ADR 0005](../../../../docs/adr/0005-model-asr-runtime.md)) → **tanpa** `downloading`, karena mengunduh tidak memakai Whisper
- `downloaded` **bukan** status aktif: jangan masuk requeue, jangan dihitung "Diproses"

## Endpoint / Interface

(detail di [apicontract.md](apicontract.md))

- `POST /api/recordings/from-url` `{url}` → 201 `{recording, job_id}`; enqueue job `fetch`
- endpoint lain tidak berubah — `/source`, `/media`, `DELETE`, `PATCH` rename semuanya sudah bekerja
  untuk rekaman hasil unduhan karena filenya ditaruh di `upload_path` yang sama

```python
class MediaSource(Protocol):
    def probe(self, url: str) -> MediaInfo:                        # judul, durasi, ukuran, platform
    def fetch_video(self, url: str, dst: Path, on_progress) -> Path
```

`capture/__init__.get_source()` = cermin `asr/__init__.get_provider()`. Di balik interface ini
yt-dlp bisa ditukar tanpa mengubah pemanggil.

## Aturan wajib (jangan dilanggar)

1. **Probe dulu, tolak sebelum mengunduh.** `extract_info(url, download=False)` → tolak bila durasi
   > `DOWNLOAD_MAX_DURATION_S` (4 jam) atau perkiraan ukuran > `MAX_UPLOAD_BYTES` (2 GB). Satu URL
   playlist panjang tidak boleh bisa memenuhi disk. Probe juga yang mengisi `duration_ms` di 201.
2. **Unduh ke temp, pindah saat sukses.** Unduhan gagal/terputus tidak boleh meninggalkan file
   separuh di `upload_path`. Bersihkan temp di `finally`.
3. **Cap 720p** lewat konstanta `DOWNLOAD_MAX_HEIGHT`, bukan string format yang di-hardcode.
4. **Pesan error spesifik per-platform.** "gagal" generik dilarang — user harus tahu apakah perlu
   cookies, platform tidak didukung, atau videonya privat. Petakan pesan yt-dlp ke pesan Indonesia.
5. **Notice ToS di form URL.** Satu baris, tidak bisa disembunyikan.
6. **Retensi `upload_path` harus diputuskan di fase ini**, bukan ditunda — `MEDIA_RETENTION_DAYS`
   yang ada hanya membersihkan `media_path`. Minimal: tampilkan pemakaian disk di tab Unduh supaya
   masalahnya kelihatan sebelum jadi parah.
7. **1 fungsi ≤ 20 baris** (aturan repo, berlaku BE dan FE).
8. **Jangan memanggil API situs downloader pihak ketiga** (vidssave/ytdown/sejenis) sebagai backend.

## FE

- `SidebarTabs` di bawah `Brand`, di atas area scroll. Ikon gerigi tetap di `Brand` (berlaku
  lintas-tab). Tab aktif disimpan di `localStorage` (sepola `usePanelWidth`).
- Tab **Transkrip** = isi sidebar sekarang, **dipindah apa adanya**: `UploadPanel`, `EnginePanel`,
  `StatsGrid`, `RecordingList`. Tidak ada komponen yang ditulis ulang.
- Tab **Unduh** (baru): form URL + notice ToS, daftar unduhan, pemakaian disk.
- Filter daftar (dikerjakan di FE dari data yang sudah di-fetch, tanpa endpoint baru):

  | Daftar | Menampilkan |
  |---|---|
  | tab Unduh | semua `source_kind === 'url'` — apa pun statusnya |
  | tab Transkrip → Riwayat | status **di luar** `downloading`/`downloaded` |

- `StatsGrid` ikut pindah ke tab Transkrip → hitungannya harus mengabaikan `downloading`/`downloaded`
- Progress unduhan pakai `ProgressBar` yang sudah ada (fase "Mengunduh… X%")
- `StatusBadge` tambah ikon untuk `downloading` (spinner) dan `downloaded` (ikon unduhan selesai)

## Worker

- `pipeline.run_fetch(recording_id)` di samping `run_transcribe`; `worker_loop` memilih berdasarkan
  `Job.kind`. Antrean dan concurrency=1 dipakai ulang, tidak ada antrean kedua.
- `progress_hooks` yt-dlp dipanggil dari **thread**, bukan event loop → jembatani dengan pola holder
  dict + poller async yang sudah terbukti di `_transcribe`.
- Idempoten: job yang diulang setelah restart tidak boleh menggandakan file.

## Di luar scope Fase A

- tombol transkrip + `POST /{id}/transcribe` (Fase B)
- PO token, cookies, rate-limit, auto-update yt-dlp (Fase C)
- Instagram/Facebook, subtitle-first (Fase D)
- SSE, cancel, batch/playlist, proxy, pilih kualitas per-unduhan (Fase E)
