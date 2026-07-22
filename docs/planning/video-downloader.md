# Planning — Video Downloader (ingest dari URL sosmed)

> Fitur: tempel URL (YouTube/TikTok/X/Instagram/Facebook/…) → sistem **mengunduh videonya** →
> masuk riwayat dan langsung bisa ditonton. Transkrip dijalankan **terpisah** lewat tombol.
> Riset per-platform: Juli 2026 — sumber di §13.
> Selaras arah modular monolith ([ADR 0003](../adr/0003-modular-monolith-not-microservices.md)):
> URL ingestion = salah satu metode modul `capture/`.

## 1. Revisi 2026-07-21 — apa yang berubah

Revisi pertama dokumen ini memilih **subtitle-first + audio-only**. Setelah dibahas, user memilih
arah berbeda: **unduh video dulu, transkrip belakangan sebagai langkah terpisah**. Alasannya alur
itu yang selama ini dipakai manual (unduh via situs pihak-ketiga → upload), dan videonya sendiri
memang ingin disimpan, bukan cuma teksnya.

| Hal | Revisi lama | **Sekarang** |
|---|---|---|
| Yang diunduh | Audio saja | **Video (cap 720p)** |
| Strategi utama | Subtitle-first (lewati unduh) | **Unduh video**; subtitle-first turun jadi akselerator opsional (§7) |
| Setelah unduh | Langsung transkrip (satu alur) | **Berhenti di status `downloaded`**; transkrip via tombol |
| Urutan roadmap | MVP → YouTube → video → ekstra | **Downloader → tombol transkrip → YouTube → Meta → ekstra** |

Konsekuensi yang harus disadari sejak awal:

- **File jauh lebih besar.** Video 28 menit 720p ≈ 150–300 MB vs audio ≈ 25 MB. Disk dan waktu unduh
  naik drastis → §5 dan §6 jadi wajib, bukan opsional.
- **Merip stream video = bagian yang paling dijaga YouTube.** Subtitle-first tadinya menghindari itu.
  Dengan video-first, bot-check ketemu lebih cepat → pengerasan YouTube naik prioritas.
- **Yang jadi lebih mudah:** file video hasil unduhan **identik dengan file hasil upload**. Simpan ke
  `upload_path` → ffprobe, ffmpeg, ASRProvider, player, `/source`, retensi semuanya jalan tanpa
  perubahan. Jalur audio-only justru lebih repot karena player jadi kasus khusus.

Keputusan teknis yang tidak berubah:

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Tool unduh | **yt-dlp sebagai library** (`import yt_dlp`) di balik interface `MediaSource` | De-facto standar (~1.800 extractor); structured info + progress hooks, tanpa parsing shell |
| Cadangan | Cobalt (self-host) hanya backend sekunder opsional | Cakupan platform jauh lebih sempit, tak bisa ekstrak caption |

## 2. Dukungan & tingkat kesulitan per-platform (2026)

Realistis — **tidak semua platform sama mudahnya**, dan ini di luar kendali kita (situs berubah):

| Platform | Jalan langsung? | Butuh login/cookies | Kesulitan | Catatan |
|---|---|---|---|---|
| **TikTok** | Ya (video publik) | Tidak (cookies bila kena rate-limit) | Mudah | Paling mulus dari set sosmed |
| **Twitter / X** | Ya (extractor native) | Kadang; cookies malah bisa merusak | Sedang (rapuh) | Sering jalan tanpa auth; error CSRF bila pakai cookies |
| **YouTube** | Sebagian, rapuh di server | **Disarankan** cookies **+ PO-token provider** | **Sulit di server** | Bot-check "Sign in to confirm…", PO token, blokir IP datacenter |
| **Instagram** | Sebagian | **Butuh** cookies login | Sulit | "rate-limit reached or login required" umum; IP server cepat kena limit |
| **Facebook** | Sebagian | **Butuh** cookies (konten non-publik) | Sulit | Mirip Instagram (sama-sama Meta) |
| **Threads** | **Tidak** (belum ada extractor) | — | Tak didukung | Fallback generic saja; jangan janjikan. Pantau isu upstream |

Ringkas: **TikTok** mudah · **X/YouTube** bisa-tapi-butuh-usaha · **Instagram/Facebook** butuh cookies
& sering gagal di IP server · **Threads** belum didukung. UI harus jujur soal ini — pesan error
per-platform yang jelas, bukan "gagal" generik.

> Catatan dari pembahasan: situs seperti vidssave / ytdown lancar bukan karena tool-nya lebih
> pintar (kemungkinan besar yt-dlp/Cobalt juga), tapi karena **infrastruktur**: kolam proxy
> residensial, rotasi IP, provider PO token, kolam cookies, dan perawatan harian. Jangan
> menargetkan tingkat keberhasilan mereka, dan **jangan memanggil API mereka** sebagai backend —
> itu menumpang infrastruktur orang, melanggar ToS mereka, dan rusak begitu mereka berubah.

## 3. Alur dua langkah (inti desain)

```
LANGKAH 1 — UNDUH (otomatis setelah URL dikirim)
  POST /api/recordings/from-url { url }
    → probe dulu (§6): judul, durasi, ukuran perkiraan → tolak lebih awal bila kebesaran
    → Recording(source_kind='url', source_url=…, status='downloading') + Job(kind='fetch')
    → worker: yt-dlp unduh ke upload_path, progress → job.progress
    → status 'downloaded'  ← BERHENTI DI SINI

  Rekaman sudah masuk riwayat dan bisa ditonton (endpoint /source sudah ada).

LANGKAH 2 — TRANSKRIP (manual, kapan pun)
  POST /api/recordings/{id}/transcribe
    → Job(kind='transcribe'), status 'queued'
    → pipeline existing: extracting → transcribing → done
```

Kenapa dipisah: user bisa mengunduh beberapa video dulu lalu memilih mana yang perlu ditranskrip —
dan transkrip yang berat (CPU) tidak dipaksa jalan untuk video yang cuma ingin disimpan.

**Efek samping yang menguntungkan:** endpoint `/transcribe` berlaku untuk **semua** rekaman, bukan
cuma hasil unduhan. Artinya kita sekalian dapat **transkrip ulang** untuk file upload — berguna
setelah ganti model ASR (ADR 0005), yang selama ini tidak mungkin tanpa unggah ulang.

## 4. Perubahan model data & status

- `Recording` tambah **`source_url`** (nullable) dan **`source_kind`** (`upload` | `url`).
- Status baru: **`downloading`** (sedang diunduh) dan **`downloaded`** (siap, belum ditranskrip).
  Urutan penuh: `downloading → downloaded → queued → extracting → transcribing → done`, dengan
  `failed` bisa dari mana saja. Rekaman upload mulai langsung dari `queued` seperti sekarang.
- `Job.kind` dipakai sungguhan: **`fetch`** dan **`transcribe`** (sebelumnya selalu `transcribe`).
  Satu recording bisa punya dua job berurutan.
- **Hati-hati dengan `ACTIVE_STATUSES`.** Sekarang konstanta itu dipakai dua hal sekaligus:
  `requeue_pending()` saat startup dan guard 409 ganti model ASR. Keduanya butuh himpunan berbeda:
  - requeue → harus **termasuk** `downloading` (unduhan terputus perlu dilanjutkan/ditandai gagal)
  - guard model ASR → **tidak** termasuk `downloading` (mengunduh tidak memakai model Whisper)
  → pecah jadi dua konstanta, jangan dipaksa satu.
- `downloaded` **bukan** status aktif — jangan masuk hitungan "Diproses" di statistik sidebar; beri
  kartu/ikon sendiri.

## 5. Kualitas & ukuran

- **Cap 720p** (`bestvideo[height<=720]+bestaudio/best[height<=720]`), lewat konstanta
  `DOWNLOAD_MAX_HEIGHT` supaya gampang diubah. Alasan: cukup jelas untuk ditonton sambil membaca
  transkrip, ukuran jauh lebih hemat dari 1080p/4K.
- Perlu **ffmpeg merge** karena video dan audio sering terpisah di YouTube — ffmpeg sudah ada.
- Simpan ke `upload_path` dengan pola nama yang sama seperti upload (`uuid4().hex + suffix`), supaya
  `_remove_files`, retensi, dan `/source` tidak perlu tahu asal-usulnya.
- Judul dari `info['title']`, dibersihkan lewat `clean_title()` yang sudah ada.
- Pilih kualitas per-unduhan **tidak** masuk sekarang (butuh probe format dulu + UI tambahan) —
  ditunda ke §12 Fase E.

## 6. Probe dulu, tolak lebih awal

Sebelum mengunduh sebyte pun: `extract_info(url, download=False)`. Dari situ dapat judul, durasi,
dan perkiraan ukuran. Tolak **sebelum** unduh bila:

- durasi > `DOWNLOAD_MAX_DURATION_S` (usul: 4 jam)
- perkiraan ukuran > `MAX_UPLOAD_BYTES` (2 GB, samakan dengan cap upload)
- platform tidak didukung / extractor gagal → pesan spesifik per-platform

Tanpa ini, satu URL playlist 6 jam bisa memenuhi disk sebelum ada yang sadar. Probe juga yang
mengisi `duration_ms` di respons 201 — sama seperti ffprobe pada jalur upload.

## 7. Subtitle-first — sekarang opsional, bukan utama

Riset ini tetap berlaku dan tetap berharga, hanya turun prioritas: `info['subtitles']` (caption
manusia) dan `info['automatic_captions']` (caption ASR platform) bisa dipakai jadi segments
**tanpa** menjalankan Whisper — jauh lebih cepat dan hemat CPU.

Opsi yt-dlp: `writesubtitles`, `writeautomaticsub`, `subtitleslangs=['id','en']`.

Karena alurnya sekarang dua langkah, tempat yang pas untuk ini adalah **langkah 2**: saat menekan
tombol transkrip, kalau caption tersedia tawarkan "pakai caption platform (instan)" vs "transkrip
dengan model kita (lebih akurat)". Caveat lama tetap: auto-caption Indonesia kualitasnya variatif,
jadi jangan dijadikan default diam-diam.

## 8. Pengerasan YouTube

YouTube di server bukan sekadar "panggil yt-dlp":

- **PO token** kini diwajibkan untuk beberapa request. Suplai manual tak disarankan (terikat
  per-video). Solusinya provider otomatis: `bgutil-ytdlp-pot-provider` (sidecar, port **4416**) +
  plugin pip, di-wire via `extractor-args` `youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416`.
- **Cookies** dari akun (idealnya throwaway) via `cookiefile` (Netscape `cookies.txt`). Untuk
  headless server pakai file cookies, bukan `cookies-from-browser`.
- **Rate-limit**: jeda acak 3–10 detik antar-job; hindari burst.
- Bahkan dengan semua itu tetap bisa gagal. Jangan bangun UI yang berasumsi 100% sukses.

## 9. Strategi cookies & auth

- Panel setelan: unggah `cookies.txt` **per-platform** (opsional), simpan di data dir, diteruskan
  sebagai `opts['cookiefile']` sesuai domain URL.
- Instagram/Facebook: cookies login praktis wajib; tetap perlakukan kegagalan sebagai hal biasa.
- X: cookies **opsional/bisa dimatikan** (kadang malah merusak).
- Trik ekspor cookies YouTube dari jendela incognito (login → buka robots.txt → ekspor → tutup
  window) supaya sesi tidak ter-rotate — dokumentasikan di README saat fase ini dikerjakan.
- **Cookies = kredensial.** Perlakukan seperti kunci API di [ADR 0007](../adr/0007-mesin-ai-dipilih-dari-ui.md):
  simpan server-side, jangan pernah kirim balik isinya ke browser, dan `data/` tetap gitignore.

## 10. Operasional (jangan diremehkan)

- **Update yt-dlp = gotcha #1.** Extractor sering rusak saat situs berubah. Pin channel **nightly**
  (`pip install -U --pre yt-dlp[default]`) + auto-update harian/mingguan. Ini bukan opsional.
- **Blokir/limit IP datacenter** (terutama YouTube, Instagram): sukses dari IP datacenter jauh lebih
  rendah daripada residensial. Untuk skala pribadi cukup cookies + rate-limit; bila butuh volume →
  proxy residensial (`opts['proxy']`).
- **Disk jadi masalah nyata** dengan video-first. `MEDIA_RETENTION_DAYS` yang ada sekarang hanya
  membersihkan `media_path` (audio hasil ekstraksi), **bukan** `upload_path`. Video hasil unduhan
  akan menumpuk selamanya → perlu kebijakan retensi/kuota sendiri, atau minimal indikator pemakaian
  disk di UI. Putuskan saat Fase A, jangan ditunda.
- **File temp per-job** + cleanup saat selesai/gagal. Unduhan yang gagal di tengah tidak boleh
  meninggalkan file separuh di `upload_path`.
- ffmpeg: sudah terpenuhi.

## 11. Arsitektur

Modul baru `backend/capture/` (nama mengikuti peta modul ADR 0003):

```
capture/
  base.py        Protocol MediaSource + dataclass MediaInfo
  ytdlp.py       YtDlpSource — probe / fetch_video / (nanti) fetch_subtitles
  __init__.py    get_source() — cermin asr/__init__.get_provider()
```

```python
class MediaSource(Protocol):
    def probe(self, url: str) -> MediaInfo:          # judul, durasi, ukuran, caption tersedia
    def fetch_video(self, url: str, dst: Path, on_progress) -> Path
    def fetch_subtitles(self, url: str, langs) -> list[Segment] | None   # §7, nanti
```

Di balik interface ini yt-dlp bisa ditukar Cobalt tanpa mengubah pemanggil — pola yang sama dengan
`ASRProvider` dan `LLMProvider`.

Worker: `pipeline.py` dapat fungsi kedua `run_fetch(recording_id)` di samping `run_transcribe`.
Antrean yang ada dipakai ulang; `worker_loop` memilih berdasarkan `Job.kind`.

**ASRProvider tidak berubah sama sekali** — yang berbeda hanya asal file.

### Tata letak FE — sidebar bertab

Permintaan user: downloader **tidak** dicampur ke panel transkrip. Sidebar dibagi dua lewat **tab**
tepat di bawah header brand. Kolom kanan (TranscriptHeader + AiPanel + SourcePanel dari
[ADR 0006](../adr/0006-workspace-tiga-kolom.md)) **tidak berubah sama sekali**.

```
┌ Brand · Ultraman Transkrip ····· ⚙ ┐   ← tetap
├ [ Transkrip ] [ Unduh ]            ┤   ← BARU: tab, hanya di sidebar
├────────────────────────────────────┤
│ tab Transkrip (isi sekarang):      │
│   UploadPanel · EnginePanel        │
│   StatsGrid · Riwayat              │
│                                    │
│ tab Unduh (baru):                  │
│   form URL + notice ToS            │
│   daftar unduhan + progress        │
│   pemakaian disk                   │
└────────────────────────────────────┘
```

- **Tidak ada komponen yang ditulis ulang.** `UploadPanel`/`EnginePanel`/`StatsGrid`/`RecordingList`
  tinggal dipindah jadi isi tab Transkrip apa adanya.
- Tab aktif disimpan di `localStorage`, sepola dengan lebar panel — supaya tidak reset tiap reload.
- Ikon gerigi (Setelan) tetap di header, **di atas tab**: setelan berlaku untuk kedua tab.
- **Dua daftar terpisah** (keputusan user): hasil unduhan **tetap tinggal di tab Unduh** sebagai
  arsip video, lengkap dengan tombol transkrip di sana. Aturan filternya:

  | Daftar | Menampilkan |
  |---|---|
  | Tab **Unduh** | semua `source_kind == 'url'` — apa pun statusnya |
  | Tab **Transkrip** → Riwayat | semua yang sudah masuk pipeline transkrip, yaitu status **di luar** `downloading`/`downloaded` |

  Konsekuensi yang diterima: video URL yang sudah ditranskrip **tampil di dua tempat** — di Unduh
  sebagai sumber, di Riwayat sebagai transkrip. Ini disengaja, bukan bug.

  Filter dikerjakan di FE dari daftar yang sudah di-fetch (tidak perlu endpoint baru). Kalau nanti
  rekaman menumpuk sampai terasa berat, baru tambah query param di `GET /api/recordings`.

- **StatsGrid ikut pindah ke tab Transkrip**, jadi hitungannya harus mengabaikan `downloading` dan
  `downloaded` — kalau tidak, "Diproses" akan ikut menghitung unduhan yang tidak ada hubungannya
  dengan transkrip. Tab Unduh punya angkanya sendiri: jumlah video + pemakaian disk (§10).

## 12. Progress unduhan

`opts['progress_hooks']` memberi `downloaded_bytes` / `total_bytes` / `speed` / `eta`, tapi dipanggil
dari **thread** yt-dlp, bukan event loop. Jembatani seperti poller progres transkrip yang sudah ada
(holder dict + task async yang membaca berkala) — pola itu sudah terbukti di `_transcribe`.

FE memakai ulang komponen yang ada: `ProgressBar` untuk persen + `ProgressSteps` dengan daftar tahap
sesuai sumber. Rekaman URL: `Unduh → (berhenti)`; setelah tombol transkrip: `Antre → Ekstrak →
Transkrip → Selesai`. Rekaman upload tetap seperti sekarang.

## 13. Legal, ToS & consent (wajib disikapi)

- yt-dlp (tool) legal; **cara pakai** yang jadi soal. ToS YouTube/Meta/X umumnya melarang unduh di
  luar fitur resmi & akses otomatis — bisa melanggar ToS terlepas dari status hak cipta.
- Framing: **utilitas self-hosted, single-user, untuk konten yang user berhak simpan/transkrip**
  (miliknya sendiri / berlisensi / arsip pribadi). **Jangan** jadikan layanan unduh publik.
- Tampilkan notice singkat di form URL: user bertanggung jawab atas ToS platform & hak cipta.
- Catatan: video-first membuat framing ini lebih penting daripada saat rencananya audio-only —
  menyimpan salinan video utuh lebih sensitif daripada mengambil teksnya.

## 14. Roadmap (urutan baru)

1. ~~**Fase A — Video downloader berdiri sendiri**~~ ✅ **selesai** (`4cec044`, `a849651`)
   `capture/` + `YtDlpSource`, `POST /api/recordings/from-url`, status `downloading`/`downloaded`,
   sidebar bertab, progress, angka disk. Ditambah kemudian: **simpan video ke komputer**
   (ADR 0008 §Amandemen).
2. ~~**Fase B — Tombol transkrip**~~ ✅ **selesai** (`659355e`)
   `POST /api/recordings/{id}/transcribe`, `Job.kind` dipakai sungguhan, tombol di FE. Sekaligus
   membuka **transkrip ulang** untuk rekaman upload — teruji 104 segmen → 104 segmen.
3. **Fase C — Pengerasan YouTube** ← sedang dikerjakan
   Sidecar PO-token, cookies per-platform, rate-limit, auto-update nightly (§8, §9, §10).
4. **Fase D — Meta & subtitle-first**
   Cookies Instagram/Facebook, penanganan gagal + retry yang rapi, opsi "pakai caption platform" (§7).
5. **Fase E — Nice-to-have**
   SSE progress, cancel job, batch/playlist, konfigurasi proxy, pilih kualitas per-unduhan.

## 15. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| **Disk penuh oleh video** (naik prioritas) | Cap 720p + tolak lebih awal via probe (§6) + kebijakan retensi `upload_path` (§10) |
| Extractor rusak saat situs berubah | Pin nightly + auto-update; pesan error per-platform yang jelas |
| IP server diblokir (YouTube/Meta) | cookies + rate-limit; residential proxy bila perlu; jangan janji 100% |
| Bot-check YouTube ketemu lebih cepat (efek video-first) | Fase C dinaikkan prioritasnya; sementara arahkan ke TikTok/X |
| Threads / platform gagal | UI jujur per-platform; fallback "unduh manual lalu upload" tetap ada |
| Unduhan gagal meninggalkan file separuh | Unduh ke temp per-job, pindah ke `upload_path` hanya saat sukses |
| Konten sensitif / hak cipta | Notice ToS; self-hosted single-user; §13 |

## 16. Sumber

Riset per-platform & operasional (Juli 2026): [yt-dlp](https://github.com/yt-dlp/yt-dlp/) ·
[PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide) ·
[bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider) ·
[Extractors wiki (cookies & rate-limit)](https://github.com/yt-dlp/yt-dlp/wiki/Extractors) ·
[nightly builds](https://github.com/yt-dlp/yt-dlp-nightly-builds) ·
Instagram [#11166](https://github.com/yt-dlp/yt-dlp/issues/11166) · X [#16176](https://github.com/yt-dlp/yt-dlp/issues/16176) ·
Threads [#7523](https://github.com/yt-dlp/yt-dlp/issues/7523) ·
Referensi integrasi: [AI-Video-Transcriber](https://github.com/wendy7756/AI-Video-Transcriber) ·
[MeTube](https://github.com/alexta69/metube) · [Cobalt](https://github.com/imputnet/cobalt) ·
[youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
