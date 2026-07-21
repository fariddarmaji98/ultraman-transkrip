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

# tonton hasil unduhan (tidak berubah)

`GET /api/recordings/{id}/source` sudah bekerja apa adanya — file hasil unduhan disimpan ke
`upload_path` dengan pola nama yang sama seperti upload, jadi player, Range request, `DELETE`,
dan rename semuanya jalan tanpa perubahan.

# yang BELUM ada di Fase A

- `POST /api/recordings/{id}/transcribe` — memulai transkrip untuk rekaman `downloaded`
  (**Fase B**; sekalian membuka transkrip ulang untuk rekaman upload)
- unggah `cookies.txt` per-platform (**Fase C**)
- opsi kualitas per-unduhan (**Fase E**)
