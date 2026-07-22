# Planning — Arah Conversation Intelligence (Colibri-like)

> Arah pengembangan jangka panjang: dari **tool transkrip batch** menjadi **AI meeting assistant /
> conversation intelligence** seperti [colibri.ai](https://colibri.ai/), dengan core transkripsi
> yang sama. Keputusan struktur repo: **modular monolith** ([ADR 0003](../adr/0003-modular-monolith-not-microservices.md)).
> Melengkapi [planning MVP transkrip](webapp-upload-transkrip.md).

## 1. Ringkasan keputusan

- **Bangun di repo ini sebagai modular monolith**, bukan repo terpisah + microservice. Alasan &
  pemicu-extract di [ADR 0003](../adr/0003-modular-monolith-not-microservices.md).
- Transkripsi (batch) yang sudah ada = **core internal** yang dipakai ulang. Fitur Colibri tumbuh
  sebagai modul di atasnya.
- **Hal terbesar & tersulit bukan soal repo, tapi real-time**: Colibri mentranskrip **live** saat
  meeting; app kita sekarang **batch** (upload file). Real-time = pipeline baru (§3, §6).

## 2. Colibri = apa, dan posisi kita

Colibri.ai: rekam + transkrip **real-time** meeting, ringkasan + action item, **library call
searchable**, conversation intelligence (tren/objection/competitor), coaching saat call, integrasi
Zoom/Slack/Salesforce + ekstensi Chrome. Target: tim sales, notetaker, legal, customer service.

| Fitur Colibri | Status kita | Catatan |
|---|---|---|
| Transkrip file (batch) | ✅ ada | MVP sekarang (upload → transkrip) |
| Transkrip **real-time** saat call | ❌ baru | pipeline streaming — §6 |
| Ringkasan + action item (AI) | 🟡 direncanakan | M2 (`analysis/`) |
| Library call **searchable** | 🟡 direncanakan | M3 (FTS + pgvector) |
| Diarization (label pembicara) | 🟡 direncanakan | M4 (pyannote/WhisperX) |
| Chat-with-transcript + sitasi | 🟡 direncanakan | M3 |
| Conversation intelligence (analitik) | ❌ baru | agregasi lintas call |
| Coaching real-time saat call | ❌ baru | butuh real-time dulu |
| Integrasi Zoom/Meet/Slack/CRM | ❌ baru | §4 modul `integrations/` |
| Multi-user / org (tenancy) | ❌ baru | wajib; auth dulu |

Kesimpulan: **sekitar separuh peta jalan Colibri sudah ada di roadmap kita** (transkrip, ringkasan,
search, diarization, chat). Yang benar-benar baru: real-time, integrasi, tenancy, analitik lintas-call.

## 3. Perbedaan arsitektur kunci: batch vs real-time

| | Batch (sekarang) | Real-time (Colibri) |
|---|---|---|
| Input | file di-upload | aliran audio live saat call |
| ASR | proses sekaligus (Groq/faster-whisper) | streaming, hasil parsial terus keluar |
| Transport | HTTP request/response + polling | WebSocket (audio masuk, transkrip keluar) dua arah |
| Sumber audio | user pilih file | bot yang join meeting / ekstensi tab / mic device |
| Latency | menit tak apa | detik / sub-detik |

Engine batch **dipakai ulang untuk proses pasca-call** (re-transkrip rapi, ringkasan, index). Tapi
jalur **live** adalah pipeline sendiri — ini pekerjaan besar terlepas dari struktur repo.

## 4. Arsitektur target (modular monolith)

Satu repo, satu deployable, modul saling panggil **in-process lewat interface** (bukan HTTP internal):

```
                         ┌───────────────── app/ (FastAPI) + frontend/ (React) ─────────────────┐
                         │                                                                        │
  sumber audio ──────────┤  capture/         realtime/          transcription/     intelligence/ │
  • upload file          │  (bot meet,        (streaming ASR,    (CORE: asr,        (summarize,   │
  • ekstensi tab (Zoom/  │   ekstensi,        WebSocket,         media, worker,     action item,  │
    Meet)  ← rencana     │   mic device)      sesi live)         segments)  ◄─────  analitik,     │
    ext lama, relevan!   │        │                │                  ▲               coaching)    │
  • mic/mobile           │        └──── audio ─────┴──── audio ───────┘                 │         │
                         │                                             library/ ◄───────┘         │
                         │  integrations/         auth/ + tenancy      (search FTS+vector,         │
                         │  (Zoom, Slack, Meet,   (user/org,           history, sitasi timestamp)  │
                         │   CRM)                 multi-tenant)                                     │
                         └──────────────────────── PostgreSQL + pgvector + object storage ─────────┘
```

Modul & tanggung jawab:

| Modul | Isi | Status |
|---|---|---|
| `transcription/` | **core**: `asr/` (ASRProvider), `media/`, `worker/`, skema `segments` | ✅ ada |
| `intelligence/` | ringkasan, action item, analitik, coaching — di atas transkrip (perluasan `analysis/`) | 🟡 M2/M3 |
| `library/` | penyimpanan + search (FTS + pgvector), history, sitasi | 🟡 M3 |
| `realtime/` | streaming ASR, WebSocket, sesi live | ❌ baru |
| `capture/` | sumber audio live: bot meeting, ekstensi tab, mic/mobile | ❌ baru |
| `integrations/` | Zoom/Meet/Slack/CRM (webhook, OAuth) | ❌ baru |
| `auth/` + tenancy | user/org, multi-tenant, izin | ❌ baru (wajib) |
| `app/` + `frontend/` | API + UI | ✅ ada, tumbuh |

Aturan batas: modul lain memanggil transkripsi hanya lewat interface-nya (`ASRProvider`, fungsi
job). Kalau batas ini dijaga, **extract `transcription/` jadi service terpisah nanti = memindah
folder + ganti panggilan fungsi jadi HTTP**, bukan rewrite.

## 5. Dipakai ulang vs baru

- **Dipakai ulang apa adanya**: `asr/` (Groq + faster-whisper), `media/` ffmpeg, skema `segments`,
  export, gerbang tol proteksi, pola job.
- **Diperluas**: `analysis/` → `intelligence/` (ringkasan sudah direncanakan; tambah action item,
  analitik); `store/` → Postgres + pgvector (M3); FE → tab/halaman baru.
- **Benar-benar baru**: `realtime/`, `capture/`, `integrations/`, `auth/`+tenancy, dashboard analitik.

## 6. Real-time: opsi teknis (riset lanjutan diperlukan sebelum commit)

**Streaming ASR** (hasil parsial saat audio mengalir):
- API streaming: Deepgram / AssemblyAI streaming, atau Groq/OpenAI realtime — cek dukungan Indonesia
  & harga (riset ASR di planning MVP §11 jadi titik awal).
- Lokal: faster-whisper dengan windowing/VAD chunk, atau engine streaming khusus. Lebih berat.
- Prinsip sama: sembunyikan di balik interface (mis. `StreamingASRProvider`) seperti `ASRProvider`.

**Sumber audio live (capture)** — beberapa metode, bisa bertahap:
- **Ekstensi browser (tangkap audio tab)** — persis rencana chrome-extension lama (Zoom/Meet via
  `tabCapture`) yang di ADR 0002 ditinggalkan; **relevan lagi** di sini. Kerja awalnya tidak sia-sia.
- **Meeting bot** — bot yang join Zoom/Meet sebagai peserta lalu mengalirkan audio. Paling "Colibri",
  paling kompleks (butuh infra bot per-platform).
- **Mic device / mobile** — untuk meeting tatap muka / rekaman langsung.

**Transport**: WebSocket (audio chunk masuk → transkrip parsial keluar). Plumbing SSE untuk M2/M3
(streaming token LLM) sebagian bisa dipakai ulang polanya.

## 7. Roadmap bertahap (mulai dari yang overlap)

Urutan yang menurunkan risiko: kerjakan dulu yang **memakai ulang core batch** (nilai cepat), baru
real-time (besar).

1. **Fase I — post-call intelligence** (perluasan M2/M3, semua batch): ringkasan + action item,
   library searchable (FTS→pgvector), chat-with-transcript + sitasi, diarization. → sudah "mini-Colibri
   untuk rekaman".
2. **Fase II — akun & online**: auth + multi-tenant, Postgres + object storage, deploy (M5). Wajib
   sebelum dipakai orang lain.
3. **Fase III — real-time**: `realtime/` streaming ASR + WebSocket, 1 metode `capture/` dulu (ekstensi
   tab paling dekat dgn kerja lama). Transkrip live + ringkasan pasca-call.
   → rencana rincinya: [meeting-capture.md](meeting-capture.md), termasuk **cara membedakan siapa
   yang bicara** (channel stereo + indikator DOM) dan kenapa audio-batch dulu, real-time menyusul.
4. **Fase IV — integrasi & analitik**: Zoom/Meet/Slack/CRM, dashboard conversation intelligence,
   coaching. Ini yang membuatnya jadi produk, bukan tool.

## 8. Kapan pecah jadi microservice

Jangan sekarang. Pecah saat salah satu muncul (ADR 0003): consumer kedua independen · butuh scale
transkripsi di mesin GPU terpisah · batas tim. Boundary modul yang dijaga membuat ini murah nanti.

## 9. Privasi & consent (wajib untuk produk meeting)

Merekam & mentranskrip meeting terikat **consent** dan hukum yang berbeda antar wilayah (mis. aturan
one-party vs all-party consent). Untuk produk ini itu **kewajiban**, bukan catatan kaki:
- Beri notifikasi/consent yang jelas saat merekam meeting (terutama metode bot).
- Kontrol retensi + hapus per user; data per-tenant terisolasi.
- Mode privasi (ASR lokal + LLM lokal) tetap tersedia seperti prinsip repo.

## 10. Sumber

[colibri.ai](https://colibri.ai/) · [planning MVP transkrip](webapp-upload-transkrip.md) ·
[ADR 0002 pivot](../adr/0002-pivot-webapp-upload-transkrip.md) ·
[ADR 0003 modular monolith](../adr/0003-modular-monolith-not-microservices.md)
