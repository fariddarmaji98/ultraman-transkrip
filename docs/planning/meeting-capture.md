# Planning — Tangkap Audio Meeting (Zoom / Meet / kelas online) + Siapa yang Bicara

> Fitur: **ekstensi Chrome** menangkap audio tab meeting (+ mic) → kirim ke backend → masuk
> pipeline transkrip yang sudah ada → transkrip dengan **label pembicara**.
> Riset teknologi: Juli 2026 — sumber di §13.
> Ini realisasi **Fase III** [colibri-direction.md](colibri-direction.md), dan menghidupkan kembali
> ide `tabCapture` dari [spec chrome-extension yang diarsipkan](../../.agent/spec/archive/chrome-extension/rules.md).

## 1. Bukan dua jalur — dua jalur **plus penggabungan**

Framing user benar dan itu memang tulang punggungnya: satu jalur audio, satu jalur DOM. Tapi
pekerjaan yang sesungguhnya ada di **langkah ketiga** yang tidak kelihatan dari luar:

```
JALUR A — audio            JALUR B — siapa bicara        C — PENGGABUNGAN (di server)
tabCapture + mic           content script baca DOM       cocokkan timestamp:
  → chunk audio            → "t=12.3s: Budi mulai"       segmen transkrip ⟵ interval pembicara
  → POST ke server         → "t=15.8s: Budi berhenti"      → isi Segment.speaker
      ↓                            ↓                              ↓
   transkrip (ASR)          garis waktu pembicara         transkrip berlabel nama
```

Jalur A dan B **independen dan boleh gagal sendiri-sendiri**. Itu prinsip desain utama dokumen ini:
kalau B mati (Meet ganti UI), A tetap menghasilkan transkrip utuh — cuma tanpa nama. Kalau A yang
mati, tidak ada apa-apa. Jadi A wajib kokoh, B boleh rapuh asal **rapuhnya terkurung**.

## 2. Kenapa ekstensi (bukan bot, bukan API resmi)

| Pendekatan | Bersandar pada | Stabilitas | Putusan |
|---|---|---|---|
| **Ekstensi tangkap audio tab** | API browser (`tabCapture`, Web Audio) | Tinggi — kontrak Chrome, bukan UI platform | ✅ **dipilih** |
| API resmi (Zoom RTMS / Meet Media API) | kontrak resmi platform | Tertinggi | ❌ belum bisa: RTMS berbayar via sales; Meet Media API masih Developer Preview & **semua peserta** harus terdaftar |
| Bot peserta (headless Chrome join call) | otomasi UI platform | Rendah — patah tiap UI berubah | ❌ infra berat; pertimbangkan kalau harus tembus Zoom desktop |
| Keruk caption (à la Tactiq) | DOM caption platform | Terendah | ❌ tidak ada audio mentah; kualitas caption Indonesia bukan kendali kita |

Catatan penting: **ekstensi tidak bisa menangkap aplikasi desktop Zoom** — ia hanya melihat tab
browser. Zoom harus dipakai lewat web client (`zoom.us/wc`). **Google Meet selalu di browser**, dan
**kelas online / webinar / LMS umumnya juga di browser** — jadi untuk use case ini justru pas.

## 3. Arsitektur ekstensi (Manifest V3)

MV3 memaksa pembagian tiga bagian; ini bukan pilihan gaya:

```
popup/            gesture user (WAJIB — capture tak boleh auto-start), tombol Mulai/Stop
background/       service worker: chrome.tabCapture.getMediaStreamId(), kelola siklus offscreen
offscreen/        SATU-SATUNYA yang boleh pegang media (service worker tak punya DOM):
                    getUserMedia(chromeMediaSource:'tab') + getUserMedia(mic)
                    → Web Audio: tab ke channel KIRI, mic ke channel KANAN
                    → MediaRecorder(timeslice) → chunk → kirim ke server
content/          per platform: baca indikator "sedang bicara" dari DOM → kirim event
lib/              config (endpoint backend) + client HTTP — satu modul, jangan tersebar
```

Dua hal yang tidak jelas kalau belum pernah membangunnya:

- **Mic wajib ditangkap terpisah.** Meet/Zoom sengaja membisukan playback suaramu sendiri
  (anti-echo), jadi audio tab **tidak berisi suaramu**. Tanpa mic, kamu hilang dari transkrip.
- **Service worker bisa disuspend MV3.** Sejak Chrome 116 aktivitas WebSocket me-reset timer idle,
  dan media hidup di offscreen document — dua sebab kenapa pembagian di atas wajib.

## 4. Jalur A — audio: keputusan yang harus diambil sekarang

### 4.1 Stereo, bukan mixdown (keputusan paling penting di dokumen ini)

Tutorial rekaman umumnya menyuruh mencampur tab+mic jadi satu stream — tujuan mereka bikin file
video. **Untuk transkrip itu salah.** Simpan sebagai **stereo: kiri = tab (peserta lain), kanan =
mic (saya)**.

Biaya hari ini: nol. Kalau terlanjur dicampur, pemisahan "saya vs mereka" **hilang permanen** dan
tidak bisa dipulihkan model apa pun.

### 4.2 Rekam-lalu-kirim (chunked), bukan streaming murni — dulu

`MediaRecorder` dengan `timeslice` (usul 5 detik) → tiap blob di-`POST` ke server dengan nomor urut.

- Jaringan putus sebentar → retry per-chunk, audio tidak hilang.
- Browser/tab mati di tengah → yang sudah terkirim tetap bisa ditranskrip.
- **Gotcha WebM**: hanya chunk pertama yang punya header; chunk berikutnya **tidak** bisa didekode
  sendiri-sendiri. Server harus **menyambung byte-nya berurutan** untuk jadi file valid — jangan
  perlakukan tiap chunk sebagai file utuh.
- Idempoten per `seq` supaya retry aman.

Ini juga jembatan ke real-time nanti: sumber potongannya sama, tinggal ganti tujuannya.

### 4.3 Real-time menyusul, di balik interface

Saat fase real-time: ganti `MediaRecorder` dengan **AudioWorklet → PCM 16 kHz** lewat WebSocket
(format yang sama dipakai Zoom RTMS), dan di server `StreamingASRProvider` sepola `ASRProvider`.
Opsi lokal: **WhisperLive** (server WebSocket berbasis faster-whisper + VAD) — sejalan prinsip
lokal-first repo. Opsi API: **Deepgram mendukung streaming bahasa Indonesia**; AssemblyAI streaming
multibahasanya masih terbatas. Realistis: model kecil untuk live, lalu **transkrip ulang rapi**
pakai `large-v3-turbo` pasca-meeting — tombolnya sudah ada (Fase B downloader).

## 5. Jalur B — siapa yang bicara, dari DOM

Platform menandai peserta yang sedang bicara (tile menyala / indikator audio). Content script
mengamatinya dan mengirim interval:

```json
{ "start_ms": 12300, "end_ms": 15800, "name": "Budi", "source": "dom" }
```

Aturan yang menjaga kerapuhannya tetap terkurung:

- **Satu adapter per platform** di balik satu interface `SpeakerDetector` (`meet.js`, `zoom-web.js`,
  `teams.js`). Platform tak dikenal → adapter kosong, fitur lain jalan normal.
- **Pakai jangkar yang paling stabil**: `aria-label`/nama peserta dan atribut data, **bukan** nama
  class ter-obfuscate yang berubah tiap deploy.
- **`MutationObserver`, bukan polling** — hemat CPU saat meeting panjang.
- **Deteksi mati-diam.** Kalau audio jelas ada suara tapi detektor nol event selama N menit, catat
  `detector_broken`. Ini yang membedakan "rusak dan kita tahu" dari "rusak dan user yang menemukan".
- **Nama peserta = data pribadi.** Ia ikut aturan privasi §10, bukan sekadar metadata teknis.

## 6. Penggabungan — tiga lapis label, masing-masing bisa gagal sendiri

| Lapis | Sumber | Hasil | Kalau gagal |
|---|---|---|---|
| **0** | channel L vs R (energi RMS per segmen) | `saya` / `peserta` | Tak bisa gagal — deterministik, selalu ada |
| **1** | event DOM (§5) | **nama asli**: "Budi", "Sari" | Turun ke lapis 0 |
| **2** | diarization (M4, pyannote/WhisperX) | `Pembicara 1/2/3` di sisi peserta | Turun ke lapis 0/1 |

Lapis 0 itu murah dan sering diremehkan: cukup **satu pass energi per segmen** membandingkan kiri
vs kanan — tidak perlu ASR dua kali, tidak perlu model apa pun. Untuk meeting 1-on-1 atau kelas
(satu pengajar), lapis 0 + lapis 1 sudah menjawab hampir semua kebutuhan.

### Yang bikin penggabungan tidak sepele

1. **Titik nol yang sama.** `t=0` = saat `MediaRecorder` mulai. Semua event DOM distempel
   `performance.now() - t0`, bukan jam dinding. Tanpa ini, dua jalur tidak akan pernah cocok.
2. **Drift.** Kalau perekam sempat tersendat, offset jam dinding menyimpang dari posisi audio.
   Mitigasi: ekstensi mengirim pasangan `(wall_ms, audio_ms)` berkala sebagai titik koreksi.
3. **Indikator bicara telat dan telat berhenti.** Tile menyala ~200–500 ms setelah orang mulai
   bicara dan bertahan sesudahnya. Jadi jangan cocokkan titik-ke-titik: **beri segmen nama pembicara
   yang intervalnya paling banyak beririsan** dengan segmen itu, dengan toleransi yang jadi
   konstanta (bukan angka ajaib di tengah kode).
4. **Bicara bersamaan.** Baik lapis 0 maupun lapis 1 akan memilih satu yang dominan. Terima itu, dan
   jangan tampilkan label seolah pasti — UI sebaiknya bisa menunjukkan label mana yang berasal dari
   nama (kuat) vs energi (tebakan).

## 7. Perubahan model data & API

- `Recording.source_kind` tambah nilai **`meeting`**; `source_url` dipakai untuk URL meeting.
- Kolom baru `Recording.meeting_platform` (`meet`/`zoom-web`/`teams`/`lain`).
- Tabel baru **`speaker_events`**: `id, recording_id, start_ms, end_ms, name, source (dom|energy|diarization)`.
- **`Segment.speaker` sudah ada dan nullable** sejak awal (disiapkan untuk M4) — diisi saat
  penggabungan. Tidak perlu migrasi kolom untuk ini.
- Status baru **`recording`** (meeting sedang berjalan) sebelum masuk `queued`. Perhatikan pelajaran
  downloader: jangan gabungkan ke `ACTIVE_STATUSES` tanpa memeriksa kedua pemakainya
  (requeue vs guard model ASR) — `recording` **tidak** memakai model Whisper.

| Endpoint | Fungsi |
|---|---|
| `POST /api/recordings/meeting` | mulai sesi → `{recording_id, upload_token}` |
| `PUT /api/recordings/{id}/chunk?seq=N` | kirim potongan audio (idempoten per `seq`) |
| `POST /api/recordings/{id}/speaker-events` | kirim batch event DOM |
| `POST /api/recordings/{id}/finish` | tutup sesi → sambung chunk → jalankan penggabungan → `transcribe` |

Modul backend baru: `capture/meeting.py` — `capture/` sudah ada sejak downloader dan memang
dirancang sebagai rumah semua metode capture.

## 8. Batasan jujur (tulis di UI, bukan cuma di dokumen)

- **Aplikasi desktop Zoom tidak tertangkap.** Harus web client. UI harus mengatakannya, bukan gagal diam.
- **Tab ditutup / refresh / navigasi = stream mati permanen** dan harus izin ulang. Deteksi dan
  beri tahu, jangan biarkan user mengira masih merekam.
- **Chromium saja** (Chrome/Edge/Brave). Firefox/Safari tidak punya `tabCapture`.
- **Harus dimulai dari klik user.** Tidak ada auto-start — itu aturan Chrome, bukan pilihan kita.
- **Nama pembicara best-effort.** Kalau adapter mati, transkrip tetap ada dengan label `saya`/`peserta`.

## 9. Roadmap

1. **Fase A — audio saja, batch.** Ekstensi rekam tab+mic stereo → chunk → server → sambung →
   masuk pipeline transkrip yang sudah ada. **Belum ada label pembicara, belum ada real-time.**
   Nilainya sudah nyata: selesai meeting, transkrip + ringkasan + chat langsung bekerja (semuanya
   sudah dibangun). Ini fase terpenting; jangan dicampur dengan yang lain.
2. **Fase B — lapis 0.** Label `saya`/`peserta` dari perbandingan energi kiri-kanan. Murah, tidak
   bergantung platform, tidak bisa rusak oleh update UI.
3. **Fase C — lapis 1 (nama asli).** Content script Meet dulu (paling stabil & paling sering
   dipakai), lalu Zoom web. Termasuk deteksi mati-diam (§5).
4. **Fase D — real-time.** `StreamingASRProvider` + AudioWorklet PCM + WebSocket; transkrip berjalan
   saat meeting, transkrip ulang rapi pasca-meeting.
5. **Fase E — diarization (M4)** memecah sisi "peserta" walau DOM mati, dan integrasi kalender.

## 10. Privasi & consent — wajib, bukan catatan kaki

Merekam meeting terikat aturan consent yang **berbeda antar wilayah** (one-party vs all-party
consent). Untuk fitur ini:

- **Indikator merekam yang jelas dan tak bisa dilewatkan** di ekstensi, dan pengingat bahwa
  memberi tahu peserta adalah tanggung jawab user.
- Beda dengan bot yang otomatis terlihat semua peserta, ekstensi ini **tidak kelihatan** oleh
  peserta lain — justru karena itu kewajiban memberi tahu jadi lebih besar, bukan lebih kecil.
- Nama peserta dari DOM = data pribadi: ikut retensi dan penghapusan per-rekaman.
- Mode privasi penuh tetap tersedia (ASR lokal + LLM lokal) sesuai prinsip repo.

## 11. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| DOM Meet/Zoom berubah → nama pembicara hilang | Rapuhnya terkurung di lapis 1; deteksi mati-diam; lapis 0 tetap jalan |
| Tab ditutup di tengah meeting | Chunk yang sudah terkirim tetap utuh; UI memberi tahu stream putus |
| Drift antara audio dan event DOM | Titik nol bersama + pasangan koreksi `(wall_ms, audio_ms)` berkala (§6) |
| Zoom dipakai lewat aplikasi desktop | Nyatakan batasannya di UI; opsi bot/RTMS baru dipertimbangkan bila ini jadi penghalang nyata |
| Meeting 2 jam → file besar & transkrip CPU lama | Audio saja (bukan video) jauh lebih kecil; cap durasi; retensi seperti downloader |
| Endpoint unggah terbuka tanpa auth | Sesi pakai `upload_token` sekali pakai sejak Fase A; auth penuh ikut fase deploy |
| Bicara bersamaan → label salah | Terima batasnya; tandai label tebakan (energi) berbeda dari label nama |

## 12. Sumber

[Recall.ai — build a Chrome recording extension](https://www.recall.ai/blog/how-to-build-a-chrome-recording-extension) ·
[chrome.tabCapture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture) ·
[Chrome 116 — WebSocket & service worker](https://developer.chrome.com/blog/chrome-116-beta-whats-new-for-extensions) ·
[Zoom RTMS docs](https://developers.zoom.us/docs/rtms/) ·
[Google Meet Media API](https://developers.google.com/workspace/meet/media-api/guides/overview) ·
[Recall.ai — how to build a meeting bot](https://www.recall.ai/blog/how-to-build-a-meeting-bot) ·
[Tactiq — transcript dari live caption](https://tactiq.io/learn/transcript-google-meet-live-caption) ·
[WhisperLive](https://github.com/hwdsl2/docker-whisper-live) ·
[Deepgram Indonesian STT](https://deepgram.com/product/speech-to-text/indonesian) ·
[AssemblyAI streaming languages](https://support.assemblyai.com/articles/1008413517-language-support-for-real-time-transcription)
