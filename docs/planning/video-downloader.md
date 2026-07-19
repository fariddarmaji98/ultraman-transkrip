# Planning — Video Downloader (ingest dari URL sosmed)

> Fitur: tempel URL (YouTube/TikTok/X/Instagram/Facebook/…) → sistem **unduh medianya** →
> masuk pipeline transkrip yang sudah ada. Mengotomatiskan alur manual yang selama ini dilakukan
> (download via situs pihak-ketiga lalu upload). Riset: Juli 2026 — sumber di §12.
> Selaras arah modular monolith ([ADR 0003](../adr/0003-modular-monolith-not-microservices.md)):
> URL ingestion = salah satu metode modul `capture/`.

## 1. Ringkasan & motivasi

Sekarang untuk mentranskrip video sosmed, alurnya manual: buka situs downloader → unduh file →
upload ke app. Fitur ini memangkasnya jadi **satu langkah: tempel URL**. Backend mengunduh media
(atau, lebih baik, mengambil **caption bawaan** bila ada), lalu memakai pipeline transkrip yang
sudah jalan (ffmpeg → ASRProvider → segments). Tidak ada perubahan pada engine transkrip.

Keputusan inti hasil riset:

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Tool unduh | **yt-dlp sebagai library** (`import yt_dlp`) di balik interface `MediaSource` | De-facto standar (~1.800 extractor); structured info, progress hooks, tanpa parsing shell |
| Strategi utama | **Subtitle-first** — cek caption bawaan dulu, baru unduh+transkrip | Jauh lebih cepat & tahan-banting (pola AI-Video-Transcriber); hemat CPU |
| Untuk transkrip | Unduh **audio saja** (`bestaudio` + `FFmpegExtractAudio`) | Kecil & cepat; ffmpeg sudah ada |
| Untuk player | Toggle "unduh video juga" (`bestvideo+bestaudio`) | Agar fitur nonton video tetap jalan; opsional karena berat |
| Cadangan | Cobalt (self-host) hanya sebagai backend sekunder opsional | Cakupan platform jauh lebih sempit, tak bisa ekstrak audio/caption |

## 2. Dukungan & tingkat kesulitan per-platform (2026)

Realistis — **tidak semua platform sama mudahnya**, dan ini di luar kendali kita (situs berubah):

| Platform | Jalan langsung? | Butuh login/cookies | Kesulitan | Catatan |
|---|---|---|---|---|
| **TikTok** | Ya (video publik) | Tidak (cookies bila kena rate-limit) | Mudah | Paling mulus dari set sosmed |
| **Twitter / X** | Ya (extractor native) | Kadang; cookies malah bisa merusak | Sedang (rapuh) | Sering jalan tanpa auth; error CSRF bila pakai cookies |
| **YouTube** | Sebagian, rapuh di server | **Disarankan** cookies **+ PO-token provider** | **Sulit di server** | Bot-check "Sign in to confirm…", PO token, blokir IP datacenter. **Tapi caption sering ada → subtitle-first paling menang di sini** |
| **Instagram** | Sebagian | **Butuh** cookies login | Sulit | "rate-limit reached or login required" umum; IP server cepat kena limit |
| **Facebook** | Sebagian | **Butuh** cookies (konten non-publik) | Sulit | Mirip Instagram (sama-sama Meta) |
| **Threads** | **Tidak** (belum ada extractor) | — | Tak didukung | Fallback generic saja; jangan janjikan. Pantau isu upstream |

Ringkas: **TikTok** mudah · **X/YouTube** bisa-tapi-butuh-usaha · **Instagram/Facebook** butuh cookies & sering gagal di IP server · **Threads** belum didukung. UI harus jujur soal ini (pesan error per-platform yang jelas).

## 3. Subtitle-first (kemenangan terbesar)

Sebelum mengunduh apa pun, `extract_info(url, download=False)` lalu periksa
`info['subtitles']` (caption manusia) & `info['automatic_captions']` (caption ASR platform):

- Ada caption bahasa yang diminta → **langsung jadi transkrip**, lewati unduh media + Whisper.
  Cepat, ringan, dan memakai data resmi platform (lebih "sopan" secara ToS).
- Tidak ada → jatuh ke jalur unduh audio → ffmpeg → ASRProvider (pipeline existing).

Opsi yt-dlp: `writesubtitles`, `writeautomaticsub`, `subtitleslangs=['id','en']`, `skip_download=True`.
Caveat: auto-caption (mis. YouTube) kualitasnya variatif, untuk Indonesia bisa jelek — sediakan
opsi "abaikan caption, transkrip ulang dengan model kita" untuk hasil lebih akurat.

## 4. Audio-only vs unduh video penuh

- **Default: audio saja** (`format='bestaudio/best'` + postprocessor `FFmpegExtractAudio`). Cukup
  untuk transkrip, jauh lebih kecil/cepat. Sejalan cap upload existing.
- **Toggle "unduh video"** (`bestvideo+bestaudio/best`, ffmpeg merge) → agar player nonton video
  jalan seperti file upload biasa. Berat & besar; jadikan pilihan sadar, bukan default.
- Konsistensi dengan model data: hasil unduhan (audio/video) diperlakukan sama seperti `upload_path`
  file upload → `source_available`, `/source`, player, retensi — semua tanpa perubahan.

## 5. Pengerasan YouTube (bagian tersulit)

YouTube di server bukan sekadar "panggil yt-dlp":
- **PO token** kini diwajibkan utk beberapa request (streaming/format/subtitle). Suplai manual tak
  disarankan (terikat per-video). Solusinya **provider otomatis**: `bgutil-ytdlp-pot-provider`
  (sidecar Docker, port **4416**) + plugin pip, di-wire via `extractor-args`
  `youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416`.
- **Cookies** dari akun (idealnya throwaway) via `cookiefile` (Netscape `cookies.txt`). Untuk
  headless server pakai file cookies, bukan `cookies-from-browser`.
- **Rate-limit**: jeda acak 3–10 dtk antar-job; hindari burst.
- Bahkan dengan semua itu, tetap bisa gagal (bot-check). **Subtitle-first mengurangi
  ketergantungan pada unduh stream YouTube.**

## 6. Strategi cookies & auth

- Panel config: unggah `cookies.txt` **per-platform** (opsional), simpan di config dir, diteruskan
  sebagai `opts['cookiefile']` sesuai domain URL.
- Instagram/Facebook: cookies login praktis wajib; tetap perlakukan kegagalan sebagai hal biasa.
- X: cookies **opsional/bisa dimatikan** (kadang malah merusak).
- Dokumentasikan trik ekspor cookies YouTube dari jendela incognito (login → buka robots.txt →
  ekspor → tutup window) agar sesi tak ter-rotate.

## 7. Operasional (jangan diremehkan)

- **Update yt-dlp = gotcha #1.** Extractor sering rusak saat situs berubah. Pin channel **nightly**
  (`pip install -U --pre yt-dlp[default]`) + auto-update **harian/mingguan** (cron atau saat start
  container). Ini bukan opsional.
- **Blokir/limit IP datacenter** (terutama YouTube, Instagram): sukses IP datacenter jauh lebih
  rendah dari residential. Untuk skala pribadi cukup **cookies + rate-limit**; bila butuh volume →
  proxy residensial (`opts['proxy']`). Jangan bangun di atas asumsi 100% sukses.
- **File temp per-job** + cleanup saat selesai/gagal (pola MeTube: `TEMP_DIR`, `CLEAR_COMPLETED_AFTER`).
- ffmpeg: sudah terpenuhi.

## 8. Arsitektur

Modul baru `backend/capture/` (atau `ingest/`) — metode capture "dari URL", sejalan ADR 0003:

```
POST /api/recordings/from-url  { url, language, download_video? }
  → buat Recording (source=url) + Job kind="fetch_transcribe"
  → worker:
      status "downloading"  → MediaSource.probe(url)
                              ├─ ada caption bahasa diminta → pakai jadi segments → DONE (lewati)
                              └─ tidak → MediaSource.fetch_audio|video(url) → file di upload_path
      status "extracting"   → ffmpeg (pipeline existing)
      status "transcribing" → ASRProvider (pipeline existing)
      status "done"
```

Interface (di balik ini, yt-dlp bisa ditukar Cobalt/dll tanpa ubah pemanggil):

```python
class MediaSource(Protocol):
    def probe(self, url) -> MediaInfo                 # judul, durasi, caption tersedia
    def fetch_subtitles(self, url, langs) -> list[Segment] | None
    def fetch_audio(self, url) -> Path
    def fetch_video(self, url) -> Path                # opsional (toggle)
```

- **Status baru `downloading`** ditambahkan ke enum + gerbang stepper. Untuk rekaman ber-sumber
  URL, stepper jadi: `Antre → Unduh → Ekstrak → Transkrip → Selesai` (rekaman upload tetap tanpa
  "Unduh"). `ProgressSteps` menerima daftar tahap sesuai sumber.
- Model `Recording` tambah `source_url` (nullable) + `source_kind` (`upload|url`).
- Groq/lokal ASRProvider **tak berubah** — hanya sumber file yang berbeda.

## 9. Progress unduhan

- `opts['progress_hooks']` memberi `downloaded_bytes`/`total_bytes`/`speed`/`eta` di thread worker.
  Jembatani ke loop async (thread-safe queue / `run_coroutine_threadsafe`) → update `job.progress`.
- FE menampilkannya di **bar tugas** (fase "Mengunduh… X%") + langkah "Unduh" di stepper — komponen
  progress yang sudah ada tinggal dipakai ulang.
- Polling job existing cukup untuk MVP; SSE menyusul (sama seperti rencana transkrip). Catatan
  AI-Video-Transcriber: jalankan FastAPI **tanpa --reload** di prod agar koneksi long-job tak putus.

## 10. Legal, ToS & consent (wajib disikapi)

- yt-dlp (tool) legal; **cara pakai** yang jadi soal. ToS YouTube/Meta/X umumnya melarang unduh di
  luar fitur resmi & akses otomatis — bisa melanggar ToS terlepas dari hak cipta.
- Framing bertanggung jawab (mengikuti proyek OSS sejenis): posisikan sebagai **utilitas
  self-hosted, single-user, untuk konten yang user berhak transkrip** (miliknya / berlisensi /
  arsip pribadi). **Jangan** jadikan layanan unduh publik.
- Tampilkan **notice singkat** di UI: user bertanggung jawab atas ToS platform & hak cipta.
- Utamakan **subtitle-first** (data yang memang diekspos platform) ketimbang rip stream.

## 11. Roadmap bertahap

1. **Fase A — MVP URL ingest**: endpoint `from-url`, `YtDlpSource` (probe + subtitle-first +
   fetch_audio), status `downloading` + stepper "Unduh", progress via polling. Platform mudah dulu
   (TikTok/X/YouTube-tanpa-login). Notice ToS.
2. **Fase B — pengerasan YouTube**: sidecar `bgutil-ytdlp-pot-provider` + upload cookies per-platform
   + rate-limit + auto-update nightly.
3. **Fase C — video & Meta**: toggle unduh video (player), cookies Instagram/Facebook, penanganan
   gagal yang rapi + retry.
4. **Fase D — nice-to-have**: SSE progress, cancel job, batch/playlist, proxy config.

## 12. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Extractor rusak saat situs berubah | Pin nightly + auto-update; pesan error jelas; subtitle-first mengurangi ketergantungan |
| IP server diblokir (YouTube/Meta) | cookies + rate-limit; residential proxy bila perlu; jangan janji 100% |
| Threads tak didukung / platform gagal | UI jujur per-platform; error actionable; fallback "unduh manual lalu upload" tetap ada |
| Konten sensitif / hak cipta | Notice ToS; self-hosted single-user; utamakan caption resmi |
| File video besar membengkak disk | Audio-only default; retensi + cleanup temp; cap durasi/ukuran |

## 13. Sumber

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
