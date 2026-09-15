# ADR 0017 — MCP Context Provider Fase 2a: server + 4 tool ingest/context

- Status: accepted
- Tanggal: 2026-09-15
- Terkait: [ADR 0015](0015-mcp-context-provider.md), [ADR 0013](0013-extraction-transkrip.md), [ADR 0008](0008-video-downloader-dua-langkah.md)
- Rencana: [mcp-context-provider](../planning/mcp-context-provider.md) (Fase 2a)

## Konteks

ADR 0015 memutuskan arsitektur (MCP, async, read-only) tetap belum menentukan implementasi.
Saat dieksekusi, tiga hal harus diputuskan konkret: MCP SDK mana dan versi berapa, bagaimana
server ini hidup berdampingan dengan backend FastAPI, dan bagaimana `get_context` menangani
rekaman yang context-nya belum diekstrak.

## Keputusan

1. **MCP Python SDK 2.x (`mcp` 2.x, `MCPServer`) di venv backend yang sama.** Terpasang mulus di
   Python 3.11 venv existing; API 2.x mengganti `FastMCP` → `MCPServer` (perpindahan nama di
   SDK, bukan pilihan kami). Server jalan sebagai **proses terpisah** (`python mcp_server.py`,
   streamable HTTP :8100) — bukan di-mount ke app FastAPI — supaya crash MCP tidak membawa
   turun REST/worker, dan sebaliknya. Keduanya berbagi DB SQLite lewat sesi sendiri.

2. **`transcribe_url` meng-antre DUA job berantai (fetch → transcribe) sekaligus.** Worker
   concurrency=1 menjamin urutan; ini menyimpang dari alur UI (ADR 0008: tombol transkrip
   terpisah) secara sengaja — untuk agent, "kirim URL, tunggu done" adalah satu tugas, dan
   memaksa agent memanggil dua tool untuk satu niat adalah kebisingan kontrak.

3. **`get_context` menjalankan ekstraksi otomatis bila belum ada** (bukan error "jalankan
   tombol Ekstrak dulu"). Alasan yang sama: agent tidak melihat UI; konteks yang diminta harus
   terpenuhi atau ditolak dengan alasan yang bisa ditindaklanjuti agent. Hasil ekstraksi
   tersimpan di `recording_extracts` seperti biasa (provider=`mcp`), jadi request berikutnya
   gratis dan tetap terlihat di UI.

4. **`get_context` menyertakan `summary` + `brief_url`.** PRD butuh narasi DAN struktur; dua
   panggilan terpisah (`get_summary`?) hanya menambah round-trip untuk data yang selalu dipakai
   bersama. `brief_url` relatif — agent tahu host-nya dari konfigurasi klien.

5. **Tool `label_recording` + `search_context` TIDAK ikut Fase 2a** — keduanya butuh skema
   labeling (Fase 2b) dan embedding (Fase 3). Ship 4 tool yang berfungsi penuh daripada 6 yang
   setengah jadi.

6. **Tidak ada otorisasi di 2a** — server bind `127.0.0.1` saja (agent & backend satu mesin,
   konsisten ADR 0015). `TRANSKRIP_MCP_PORT` sebagai env escape. Token lintas-mesin menyusul
   saat benar-benar dideploy terpisah.

## Alternatif yang ditimbang

- **Mount MCP ke app FastAPI (satu proses)** — ditolak; library MCP SDK menjalankan servernya
  sendiri (uvicorn internal), menggabungkannya dengan lifespan FastAPI yang sudah punya worker
  + updater = satu proses dengan terlalu banyak tanggung jawab, dan restart updater
  (ADR 0016) akan memutus koneksi agent juga.
- **stdio transport (subprocess agent)** — ditolak untuk sekarang; streamable HTTP memungkinkan
  satu server dipakai banyak klien (Hermes + tes + agent lain) tanpa spawn per klien.
- **`transcribe_url` sinkron menunggu transkrip** — ditolak; inti keputusan 2 ADR 0015.
- **Agent memanggil REST langsung tanpa MCP** — ditolak; kehilangan discovery dan standar
  lintas klien (keputusan 1 ADR 0015).

## Konsekuensi

- **Dua proses harus hidup** (backend :8000 + MCP :8100). Launcher `start-servers.ps1` belum
  mencakup MCP — perlu ditambahkan ke siklus launcher/watchdog (pekerjaan kecil, tercatat di
  spec todo).
- **`transcribe_url` lewat probe sinkron di request handler** — URL rusak ditolak cepat
  (pola `POST /recordings/from-url`), tapi probe yang lambat menahan satu koneksi agent;
  diterima untuk skala sekarang.
- **Ekstraksi otomatis berbiaya LLM tanpa konfirmasi eksplisit** — menyimpang dari ADR 0013
  keputusan 8 (ekstraksi eksplisit via tombol). Untuk jalur agent ini disengaja: agent yang
  meminta context ADALAH konfirmasinya. UI tetap eksplisit.
- **`upload_path` recording hasil MCP memakai prefix `mcp-`** — penanda asal untuk audit
  (source_kind=url tidak membedakan agent vs tombol UI).
- **MCP SDK 2.x masih muda** — API `streamable_http_client` v2 balik 2 nilai (bukan 3 seperti
  dokumentasi lama); kalau SDK berubah lagi, hanya `mcp_server.py` + skrip tes yang tersentuh.
