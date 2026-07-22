# unduh dari URL

- api: `/api/recordings/from-url`
- method: POST
- auth: session cookie
- body (JSON):
  - `url`: string — URL video sosmed
- catatan: **probe jalan sinkron** sebelum enqueue (mirip ffprobe di jalur upload) — judul, durasi,
  dan perkiraan ukuran sudah terisi di response 201; unduhan sendiri berjalan async di worker
- response 201:

```json
{
  "recording": {
    "id": 2,
    "title": "Judul dari platform",
    "source_filename": "",
    "source_kind": "url",
    "source_url": "https://www.tiktok.com/@user/video/123",
    "status": "downloading",
    "duration_ms": 187000,
    "language": "auto",
    "created_at": "…"
  },
  "job_id": 11
}
```

- error:
  - `422 url tidak valid` — bukan URL
  - `422 platform belum didukung` — tidak ada extractor (mis. Threads)
  - `422 video terlalu panjang (maks 4 jam)` — dari probe, sebelum unduh
  - `422 perkiraan ukuran melebihi 2 GB` — dari probe, sebelum unduh
  - `422 video privat atau butuh login` — extractor minta auth (cookies = Fase C)
  - `502 gagal membaca video dari platform` — extractor error lain; pesan aslinya ikut di `detail`
  - `429` — dari gerbang tol proteksi (posA/posB), sama seperti upload

# daftar & detail (tidak berubah)

`GET /api/recordings` dan `GET /api/recordings/{id}` bertambah dua field pada tiap recording:

- `source_kind`: `"upload" | "url"`
- `source_url`: string | null

FE memakai `source_kind` untuk memfilter isi tab (Unduh vs Riwayat) — tidak ada endpoint baru.

# status recording (diperluas)

| Status | Arti | Aktif? |
|---|---|---|
| `downloading` | sedang diunduh dari URL | ya — ikut requeue saat restart |
| `downloaded` | file siap, belum ditranskrip | **tidak** — terminal sampai user menekan transkrip (Fase B) |
| `queued` `extracting` `transcribing` | pipeline transkrip | ya |
| `done` `failed` | selesai / gagal | tidak |

`GET /api/jobs/{id}` tidak berubah bentuknya; `kind` kini bisa bernilai `fetch`.
Untuk job `fetch`, `progress` = persen unduhan (0–100).

# tonton & simpan hasil unduhan

`GET /api/recordings/{id}/source` melayani dua hal sekaligus:

- **player** — `<video src>` mengabaikan `Content-Disposition`, jadi tetap bisa diputar; Range
  request (206) jalan
- **simpan ke komputer** — header `attachment` dengan nama berkas dari **judul rekaman**, bukan
  UUID di disk (`app.naming.download_name`). Karakter terlarang (`< > : " / \ | ? *`) dibuang;
  judul non-ASCII aman lewat encoding `filename*=utf-8''`

File hasil unduhan disimpan ke `upload_path` dengan pola nama yang sama seperti upload, jadi
player, `DELETE`, dan rename semuanya jalan tanpa perubahan.

# pemakaian disk

- api: `/api/storage`
- method: GET
- auth: session cookie
- response 200: `{ "files": 3, "used_bytes": 142430000, "free_bytes": 84700000000 }`
- catatan: memindai `upload_dir`; dipanggil FE hanya saat daftar/status unduhan berubah, bukan
  tiap poll

# progress di daftar

`GET /api/recordings` kini menyertakan **`progress`** (0–100) per rekaman, diambil dari **job
terbaru** (`MAX(jobs.id)` per recording) — perlu karena satu recording bisa punya job `fetch`
lalu `transcribe`, dan tanpa ini bar unduhan di sidebar tidak bergerak.

# jalankan transkrip (Fase B)

- api: `/api/recordings/{id}/transcribe`
- method: POST (tanpa body)
- auth: session cookie
- efek: buat Job `transcribe` baru, set status `queued`, enqueue
- response 202: `RecordingOut` (status `queued`)
- error:
  - `404` rekaman tidak ditemukan
  - `409 rekaman ini sedang diproses` — status masih di `ACTIVE_STATUSES`
  - `422 file sumber tidak tersedia` — `upload_path` kosong atau filenya hilang
- **sengaja generik**: dipakai untuk video hasil unduhan (`downloaded`) sekaligus **transkrip ulang**
  rekaman upload, mis. setelah ganti model ASR ([ADR 0005](../../../../docs/adr/0005-model-asr-runtime.md))
- idempoten: `run_transcribe` menghapus segmen lama sebelum menulis yang baru — transkrip ulang
  **mengganti**, tidak menggandakan. Segmen lama baru dihapus setelah ASR sukses, jadi kegagalan
  di tengah tidak menghilangkan transkrip yang sudah ada
- catatan bentuk data: balasan ini `RecordingOut` (**tanpa** `segments`), bukan `RecordingDetail` —
  pemanggil yang butuh segmen harus mengambil ulang detailnya

# yang BELUM ada

- unggah `cookies.txt` per-platform (**Fase C**)
- opsi kualitas per-unduhan (**Fase E**)
