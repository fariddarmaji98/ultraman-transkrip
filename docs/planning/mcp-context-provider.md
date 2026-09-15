# Planning — MCP Context Provider (transkrip sebagai penyedia context untuk agent)

> Fitur: project transkrip **berhenti di context + labeling**, dan menyajikannya lewat
> **MCP (Model Context Protocol)** supaya project AI agent bisa *meminta* context — kirim
> URL video, transkrip mengerjakan semuanya (unduh → transkrip → ringkasan → context →
> labeling), menyimpan hasilnya, dan mengembalikan context terstruktur. Hasil tetap bisa
> dilihat manual seperti alur "Unduh" biasa.
> Selaras [ADR 0003](../adr/0003-modular-monolith-not-microservices.md): MCP adalah lapisan
> tipis di atas pipeline yang sudah ada, bukan layanan terpisah.

> **Status 2026-09-15**: Fase 2a ✅ (MCP server + 4 tool, ADR 0017) · Fase 2b ✅ (labeling dua
> lapis, ADR 0018) — terpasang & teruji di Hermes (`hermes mcp test` 5/5 tools).
> Fase 3 (`search_context` embedding) menyusul. UI web label manual menyusul.

## 1. Ringkasan keputusan (sudah disetujui user)

- **Pembagian tanggung jawab tegas**: project transkrip = *context provider* (telinga &
  pengarsip); project AI agent = *context consumer* (otak & eksekutor). Keduanya bicara lewat
  MCP, bukan impor kode silang.
- **Labeling dua lapis**: (a) **auto-tag** oleh LLM saat ekstraksi (topik/tipe), (b) **label
  manual** oleh user (mis. project tertentu). Keduanya jadi filter retrieval.
- **Search context lama ikut dibangun** (Fase 3) — "cari context lama dari library" adalah
  requirement, bukan nice-to-have.

## 2. Kenapa MCP, bukan REST kustom

| Pertimbangan | MCP | REST kustom |
|---|---|---|
| Standar lintas tool | ✅ Claude, Cursor, Copilot, Hermes semua baca MCP | ❌ tiap agent perlu klien kustom |
| Native di Hermes (agent user) | ✅ `hermes mcp` + `setup_mcp` | — |
| Discovery tool otomatis | ✅ agent tanya "tool apa saja?" | ❌ harus dokumentasi manual |
| Evolusi kontrak | ✅ tool schema versi-able | ❌ rawan break saat endpoint berubah |

Riset (Microsoft Learn "App Service as MCP server", IBM MCP docs): MCP adalah cara standar
mengekspos API internal ke agent **tanpa re-arsitektur** — cukup bungkus fungsi yang sudah ada.
Pola "satu pipeline, banyak permukaan" (web UI + CLI + REST + MCP berbagi logika yang sama)
terkonfirmasi oleh `JacobFV/yt2ctx`.

## 3. Kontrak tool MCP (diusulkan)

Transkripsi berlangsung menit, jadi tool-nya **async**: submit → job_id → poll. Pola ini
diambil dari `smallthinkingmachines/video-context-mcp` (`ingest_video` → `get_ingest_status`).

| Tool | I/O | Keterangan |
|---|---|---|
| `transcribe_url(url, language?)` | → `{job_id}` | Ingest URL (yt-dlp) + antre transkrip. Balik seketika. |
| `get_job(job_id)` | → `{status, progress}` | Poll status pipeline (mirip `GET /api/jobs/{id}` existing) |
| `get_context(recording_id)` | → `{context, labels, brief_url}` | Extract terstruktur (4 kategori) + labeling + link brief |
| `list_recordings(label?)` | → `[{id, title, labels, ...}]` | Daftar hasil tersimpan (bisa difilter label) |
| `search_context(query)` | → item context relevan + sitasi | **Fase 3** (embedding) — lihat §7 |

Semua tool **read-only** kecuali `transcribe_url` yang menciptakan satu recording. Ini batas
keamanan yang disengaja (pola `aegis` — "read-only MCP server"): agent tidak boleh hapus/edit
arsip, hanya menambah dan membaca.

## 4. Labeling — dua lapis

```json
{
  "auto_tags":  ["ai-agent", "tutorial"],        // dari LLM saat ekstraksi
  "labels":     ["project-rok-bot", "riset"]      // manual dari user / agent
}
```

- **Auto-tag**: satu prompt ekstra saat Fase 1 `extract.py` berjalan — minta LLM memberi 2–4
  tag topik dari `requirements` + `constraints`. Disimpan di kolom JSON `auto_tags`.
- **Label manual**: tabel `recording_labels` (many-to-many), bisa ditambah dari UI riwayat
  maupun dari agent lewat tool `label_recording(id, labels)`. Label bebas-string, tanpa
  katalog — katalog justru menghambat karena label project-mu bertambah terus.
- Keduanya dipakai filter di `list_recordings` dan nanti `search_context`.

## 5. Alur end-to-end (yang user gambarkan)

```
Agent (Hermes)                                Transkrip app (MCP server)
     │  transcribe_url("https://youtube/...")       │
     ├──────────────────────────────────────────────►  buat Recording (source=url) + enqueue
     │◄─────────────── {job_id} ─────────────────────
     │  get_job(job_id)   (poll)                     │
     ├──────────────────────────────────────────────►  status: downloading → transcribing → done
     │◄─────────────── {status:"done"} ──────────────
     │  get_context(recording_id)                    │
     ├──────────────────────────────────────────────►  extract + auto-tag (LLM) tersimpan
     │◄─── {context(4 kategori+sitasi), labels} ─────
     │  label_recording(id, ["project-rok-bot"])     │
     ├──────────────────────────────────────────────►  simpan label manual
     │
     ▼  agent hasilkan PRD → breakdown task → eksekusi
```

**Hasil tetap tersimpan** di riwayat transkrip (video + transkrip + ringkasan + context),
persis seperti user pakai menu "Unduh" manual — jadi user juga bisa buka dan lihat hasilnya.

## 6. Posisi terhadap yang sudah ada

| Komponen | Status | Catatan |
|---|---|---|
| Unduh URL (yt-dlp) + `capture/` | ✅ | Dipakai `transcribe_url` apa adanya |
| Antrean worker + `GET /api/jobs/{id}` | ✅ | `get_job` = pembungkus tipis endpoint ini |
| Extract 4 kategori (Fase 1, ADR 0013) | ✅ | `get_context` membaca `recording_extracts` |
| Ekspor brief markdown | ✅ | `brief_url` = endpoint ekspor existing |
| **MCP server** | ❌ | Lapisan baru (`backend/mcp/`) |
| **Auto-tag saat ekstrak** | ❌ | Tambah kolom `auto_tags` di `recording_extracts` |
| **Label manual** | ❌ | Tabel `recording_labels` + endpoint + tool |
| **search_context (embedding)** | ❌ | Fase 3 — `EmbeddingProvider` masih stub |

## 7. Fase 3 — search context lama (embedding)

Diwariskan dari [transcript-as-context](transcript-as-context.md) Fase 3: implementasi
`EmbeddingProvider` (Ollama embeddings lokal, gratis) → index segmen + extract → `search_context`
menjawab pertanyaan lintas-rekaman dengan sitasi. Labeling dari §4 menjadi **metadata filter**
di atas vector search (filter dulu per label, lalu semantic search) — ini urutan yang benar:
label menyaring ruang, embedding memeringkat di dalamnya.

## 8. Privasi & biaya

- Jalur LLM extract/auto-tag = mesin AI aktif (default Ollama lokal). Sama seperti ringkasan.
- Auto-tag = **satu panggilan LLM ekstra** per ekstraksi — dipertimbangkan; digabung ke prompt
  extract bila bisa, dipisah hanya jika kualitas tag memburuk.
- MCP server mengembalikan **teks context**, tidak pernah file media mentah — agent tidak butuh
  audio/video, cukup fakta + sitasi.
- Otorisasi MCP: MVP lokal (agent & app satu mesin). Bila lintas mesin, `TRANSKRIP_MCP_TOKEN`
  sebagai bearer — dibahas di ADR saat Fase 2a dikerjakan.

## 9. Non-goal

- Tidak ada push/notifikasi dari transkrip ke agent — agent yang **menarik** (pull), bukan
  transkrip yang mendorong. Pola pull lebih sederhana dan idempoten.
- Tidak ada auth multi-user / tenancy di MCP (tetap single-user, konsisten MVP).
- Tidak ada streaming transkrip real-time (jalur meeting capture sudah terpisah, tetap di UI).
- Tidak ada webhook balik ke agent saat transkrip selesai — agent poll `get_job`.
