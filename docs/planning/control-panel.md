# Planning — Control Panel (monitor & kendali service)

> Fitur: satu halaman untuk melihat status backend, frontend, dan database — plus tombol
> start / stop / restart. Riset & keputusan: Juli 2026.
> Terkait: [overview arsitektur](../architecture/overview.md) · deploy nanti (auth + VPS).

## 0. Status: DITUNDA, dan akan dibangun di repo terpisah

Keputusan 23 Juli 2026. **Tidak dikerjakan di repo ini.**

Alasannya keluar dari rencana ini sendiri: §2 menetapkan panel wajib **nol impor dari paket
backend** supaya ia tetap menyala saat backend rusak. Karena koplingnya memang nol, tinggal di
repo ini tidak memberi keuntungan apa pun — sementara memisahkannya membuat ia bisa mengawasi
proyek lain juga.

**Yang harus ikut pindah, jangan sampai hilang:** bagian paling berguna dari rencana ini justru
yang tahu-repo. Di repo terpisah ia jadi **berkas konfigurasi per-proyek**, bukan kode:

| Perlu tahu | Dipakai untuk | Cara dapat tanpa impor |
|---|---|---|
| Interpreter venv + cwd (path berisi spasi) | menyalakan backend | konfigurasi |
| Port 8000 / 5173 + path health | tiga tingkat status (§3) | konfigurasi |
| **Jumlah job aktif** | konfirmasi restart yang menyebut angka (§5) | `GET /api/recordings`, hitung status aktif |
| **Path & bentuk `data/transkrip.db`** | statistik, cek integritas, backup, VACUUM (§6) | baca berkas langsung |

Dua yang dicetak tebal adalah yang membedakan panel ini dari supervisor generik seperti PM2 (§11).
Kalau saat dipisah keduanya ikut hilang, yang tersisa cuma "tombol start/stop" — dan untuk itu
skrip `.bat` sudah cukup.

Dokumen ini tetap disimpan di sini karena isinya **keputusan tentang service repo ini**: bentuk
databasenya, perilaku requeue-nya, jebakan mematikan proses di Windows dengan path berspasi.
Repo panel nanti membacanya sebagai spesifikasi, bukan mengarang ulang.

Sisa dokumen di bawah tetap berlaku apa adanya.

## 1. Kenyataan: "tiga service" itu tidak simetris

Permintaannya menyebut **database, BE, FE** seolah tiga hal sejenis. Di repo ini tidak begitu, dan
seluruh desain bergantung pada perbedaan ini:

| Disebut | Kenyataannya | Bisa start/stop? |
|---|---|---|
| **Backend** | proses `uvicorn` di `:8000` — worker antrean ada **di dalamnya** | ✅ ya |
| **Frontend** | proses `vite` di `:5173` — hanya untuk dev | ✅ ya |
| **Database** | **berkas** `data/transkrip.db` (72 KB, journal `delete`) yang dibuka in-process oleh backend | ❌ **tidak ada prosesnya** |

**SQLite bukan server.** Tidak ada daemon, tidak ada port, tidak ada yang bisa di-`start`. Ia hidup
dan mati bersama backend. Tombol "stop database" tidak punya arti — dan kalaupun dipaksa ada,
satu-satunya tafsirnya adalah "matikan backend", yang tombolnya sudah ada.

Ini bukan kekurangan yang perlu ditutupi: SQLite dipilih sadar sebagai penyederhanaan MVP
([overview §9](../architecture/overview.md)). Yang perlu diganti adalah **bentuk kendalinya**, bukan
databasenya (§6).

Sekalian, ada tiga hal lain yang sesungguhnya "service" dan pantas dimonitor tapi tidak disebut:

| | Apa | Bisa dikendalikan? |
|---|---|---|
| **Ollama** | server LLM lokal `:11434`, dipakai bila provider AI = ollama | ❌ milik sistem, bukan milik kita |
| **ffmpeg** | CLI di PATH — tanpa ini transkrip mustahil | ❌ bukan daemon, tapi **ada/tidaknya wajib terlihat** |
| **yt-dlp** | library Python, versinya cepat basi | ❌ (info versinya sudah ada di tab Unduh) |

## 2. Masalah bootstrap: panel tidak boleh tinggal di dalam backend

Kalau panel ini jadi route di FastAPI yang sudah ada, maka menekan **"Stop backend"** berarti
mematikan hal yang sedang menyajikan tombolnya. Setelah itu tidak ada apa pun yang bisa
menyalakannya lagi — panelnya ikut mati.

Karena itu: **panel harus proses terpisah yang hidup lebih lama daripada yang dikendalikannya.**

```
ops/panel.py   :8010   ← supervisor + UI-nya sendiri, TIDAK pernah di-restart olehnya sendiri
   ├── spawn ──►  backend  :8000  (uvicorn)   ── membuka ──►  data/transkrip.db
   └── spawn ──►  frontend :5173  (vite)
```

Konsekuensi turunan yang sama pentingnya: **supervisor tidak boleh mengimpor kode backend**
(`app.*`, `store.*`, `constants.*`). Kalau ada `ImportError` di backend, supervisor harus tetap
menyala — justru saat itulah ia paling dibutuhkan, untuk menunjukkan log errornya. Boleh memakai
FastAPI/uvicorn dari venv yang sama (itu dependency, bukan kode kita), tapi **nol impor dari paket
backend**.

## 3. "Hidup" itu tiga tingkat, dan bedanya bermakna

Satu lampu hijau/merah menyembunyikan informasi yang justru paling dibutuhkan saat ada masalah.
Panel memeriksa tiga hal terpisah:

1. **PID hidup** — prosesnya ada
2. **Port terbuka** — ada yang mendengarkan di `:8000`
3. **Health menjawab** — `GET /api/health` membalas `{"status":"ok"}`

Ketidakcocokan di antara ketiganya adalah diagnosisnya:

| PID | Port | Health | Artinya |
|---|---|---|---|
| ✅ | ❌ | — | masih booting (memuat model Whisper bisa lama), atau crash internal |
| ❌ | ✅ | ✅ | **jalan di luar panel** (dinyalakan dari terminal) — atau proses yatim |
| ✅ | ✅ | ❌ | wedged: hidup tapi tidak melayani |
| ❌ | ✅ | ❌ | **port dipakai program lain** — ini yang bikin "start" gagal terus tanpa sebab jelas |

Baris terakhir itu bukan teori: itu penyebab paling sering dari "kenapa backend tidak mau nyala".
Panel harus bisa menjawab **"siapa yang memakai port 8000?"**, bukan sekadar bilang gagal.

## 4. Kendali proses di Windows — di sinilah jebakannya

Empat hal yang harus benar, dan tiga di antaranya sudah pernah menggigit di repo ini:

1. **Jangan pernah mematikan berdasarkan nama program.** `taskkill /IM python.exe /T` mematikan
   **semua** Python — termasuk supervisornya sendiri kalau ia ditulis dengan Python. Harus
   `taskkill /PID <pid> /T /F`: berdasarkan PID, dan `/T` untuk seluruh pohon anaknya.

2. **`terminate()` tidak membunuh anak.** `npm run dev` → `node` → `vite`. Mematikan npm
   meninggalkan node yang masih memegang `:5173`, sehingga "restart" berakhir dengan port bentrok.
   Pohonnya harus ikut mati.

3. **Path repo ini mengandung spasi** (`D:\AI Project\...`). Perintah wajib disusun sebagai
   **daftar argumen**, tidak pernah digabung jadi satu string shell. Ini sudah pernah memecah
   skrip di sesi pengembangan.

4. **Direktori kerja & interpreter harus eksplisit.** Backend wajib dijalankan dari `backend/`
   dengan `.venv/Scripts/python.exe`, bukan `python` dari PATH — kalau tidak, ia memakai Python
   sistem tanpa dependency dan gagal dengan error yang membingungkan.

Ditambah satu hal soal daya tahan: **supervisor menyimpan PID ke berkas**. Kalau supervisornya
sendiri di-restart, ia kehilangan pegangan ke anak-anaknya. Dengan berkas PID + pemeriksaan port,
ia bisa **mengadopsi** proses yang sudah jalan alih-alih mengira semuanya mati lalu menyalakan
duplikat.

Bila port terbuka tapi PID tidak dikenal, panel menandainya **"berjalan di luar panel"** dan tombol
stop-nya dinonaktifkan secara default. Mematikan proses yang bukan miliknya adalah cara cepat
membunuh sesuatu yang tidak diduga.

## 5. Restart backend bukan tindakan sepele

Worker antrean ada **di dalam** proses backend. Mematikannya berarti mematikan pekerjaan yang
sedang berjalan:

- **Transkrip / unduhan berjalan** → statusnya masuk `ACTIVE_STATUSES`, jadi `requeue_pending()`
  mengantre ulang saat backend menyala lagi. Aman, tapi pekerjaannya **mengulang dari awal**.
- **Subprocess ffmpeg / yt-dlp** yang sedang jalan adalah **anak** dari backend → ikut mati kalau
  pohonnya dimatikan (poin §4.2). Kalau tidak, ia jadi yatim dan tetap memakan CPU.
- **Sesi meeting** (`status='recording'`) sengaja **tidak** di-requeue — ekstensi yang
  melanjutkannya, dan itu sudah teruji selamat dari restart backend
  ([meeting-capture](meeting-capture.md)).

→ Sebelum stop/restart, panel **menghitung job aktif dan meminta konfirmasi** bila ada. Bukan
konfirmasi basa-basi: sebutkan angkanya dan apa akibatnya ("2 transkrip akan diulang dari awal").

## 6. Database: kendalinya bukan start/stop, tapi ini

Karena tidak ada proses untuk dimatikan, yang berguna untuk SQLite justru operasi lain — dan ini
yang menggantikan tombol start/stop di kartu Database:

| Aksi | Kegunaan | Syarat |
|---|---|---|
| **Statistik** | ukuran berkas, `journal_mode`, jumlah baris per tabel, waktu tulis terakhir | selalu |
| **Cek integritas** | `PRAGMA quick_check` — mendeteksi korupsi | on-demand (jangan otomatis: mahal saat DB besar) |
| **Backup** | salin lewat **SQLite backup API**, bukan copy berkas mentah | boleh saat backend jalan |
| **VACUUM** | rapikan & kecilkan berkas | **hanya saat backend berhenti** — butuh akses eksklusif |
| **Terkunci?** | coba transaksi tulis singkat bertimeout | selalu |

Dua yang perlu ditegaskan:

- **Backup harus pakai backup API, bukan `copy`.** Menyalin berkas SQLite saat ada yang menulis
  menghasilkan salinan rusak — dan rusaknya baru ketahuan saat dipulihkan, yaitu saat paling
  buruk untuk mengetahuinya.
- **VACUUM diberi kancing.** Panel tahu apakah backend jalan, jadi tombolnya dinonaktifkan dengan
  alasan yang tertulis ("hentikan backend dulu"), bukan gagal setelah diklik.

Catatan: `journal_mode` sekarang **`delete`**, bukan WAL. Panel sekadar menampilkannya —
mengubahnya ke WAL adalah keputusan tersendiri yang butuh alasan (dan ADR), bukan tombol.

## 7. Keamanan — komponen paling berbahaya di repo ini

Panel ini **menjalankan proses**. Endpoint tanpa autentikasi yang bisa memulai proses adalah
eksekusi kode jarak jauh, titik. Aturannya, dan tidak ada yang boleh dilonggarkan "sementara":

1. **Bind ke `127.0.0.1` saja. Tidak pernah `0.0.0.0`.** Ini satu-satunya penjaga di fase dev, dan
   ia harus dikunci di kode, bukan diserahkan ke argumen baris perintah.
2. **Perintah berasal dari allowlist di kode**, tidak pernah dari isi request. Request hanya boleh
   menyebut id service (`backend` / `frontend`) — bukan perintah, bukan argumen, bukan path.
3. **Jangan pernah ikut ter-deploy.** Masuk daftar periksa deploy: panel tidak dijalankan di VPS,
   atau kalau dibutuhkan, hanya **mode baca** di balik auth.

Poin 3 penting karena repo ini sengaja menunda auth sampai fase publish. Penundaan itu wajar untuk
fitur biasa; untuk **panel ini** ia berbahaya, jadi batasnya dijaga oleh localhost dan oleh
keputusan untuk tidak men-deploy-nya sama sekali.

## 8. Bentuk teknis

**Letak: `ops/` di root repo.** Bukan di dalam `backend/` — ia mengawasi backend *dan* frontend,
jadi tidak menjadi milik keduanya. Struktur repo sekarang (`backend/`, `frontend/`, `docs/`,
`samples/`) menerima satu folder lagi dengan wajar.

```
ops/
  panel.py        FastAPI kecil: status + kendali + sajikan UI. NOL impor dari backend.
  services.py     definisi allowlist (perintah, cwd, port, health path)
  process.py      spawn / tree-kill / berkas PID / adopsi proses
  dbstat.py       statistik & operasi SQLite (§6)
  ui/index.html   satu halaman, JS polos
```

**UI: HTML/CSS/JS polos, tanpa build step** — konsisten dengan keputusan yang sama pada ekstensi
Chrome ([meeting-capture §3.1](meeting-capture.md)). Alasannya sama dan lebih kuat di sini: panel
ini harus bisa menyala **saat toolchain lain sedang rusak**. Panel yang butuh `npm run build` untuk
tampil adalah panel yang mati justru ketika dibutuhkan. Token warnanya menyalin `@theme` webapp
supaya tidak terasa seperti aplikasi asing.

**API:**

| Method & path | Fungsi |
|---|---|
| `GET /api/status` | status semua service sekaligus (tiga tingkat §3) |
| `POST /api/services/{id}/start` | `id` ∈ allowlist saja |
| `POST /api/services/{id}/stop` | tree-kill; konfirmasi bila ada job aktif (§5) |
| `POST /api/services/{id}/restart` | stop lalu start, dengan jeda tunggu-port |
| `GET /api/services/{id}/logs?tail=200` | tanpa ini, "start gagal" tidak bisa didiagnosis |
| `GET /api/db/stats` · `POST /api/db/check` · `POST /api/db/backup` · `POST /api/db/vacuum` | §6 |
| `GET /api/port/{port}` | siapa yang memakai port ini (§3 baris terakhir) |

**Log wajib ditangkap sejak awal**, bukan fitur belakangan. Tombol start yang gagal tanpa
menampilkan sebabnya lebih buruk daripada tidak ada tombolnya — di terminal, setidaknya errornya
kelihatan.

## 9. Roadmap

1. **Fase A — status baca-saja.** Supervisor + tiga tingkat pemeriksaan (§3) + kartu untuk backend,
   frontend, database, Ollama, ffmpeg. **Belum ada tombol apa pun.** Tidak ada masalah bootstrap,
   tidak ada risiko keamanan proses, dan sudah menjawab "semuanya nyala tidak?".
2. **Fase B — kendali BE & FE.** start/stop/restart + berkas PID + adopsi + tree-kill + tangkap
   log + konfirmasi job aktif (§4, §5).
3. **Fase C — operasi database.** Statistik, cek integritas, backup, VACUUM berkancing (§6).
4. **Fase D — kenyamanan.** Polling otomatis, diagnosis port bentrok, riwayat restart, sisa disk
   (endpoint `/api/storage` sudah ada di backend — panel cukup memanggilnya).
5. **Fase E — mode deploy.** Versi baca-saja di balik auth untuk VPS; kendali proses **dimatikan
   permanen** di mode ini (§7).

Fase A berdiri sendiri dan berguna hari itu juga. Fase B adalah bagian yang harus hati-hati.

## 10. UI (garis besar)

- **Satu kartu per service**, masing-masing menampilkan ketiga tingkat (§3) — bukan satu lampu.
- **Status "berjalan di luar panel"** ditampilkan apa adanya, bukan dipaksa jadi hijau/merah.
- **Tombol yang mati wajib menyebut alasannya** ("VACUUM: hentikan backend dulu") — pelajaran dari
  tombol "Buat ringkasan" yang tampak rusak padahal cuma `disabled`
  ([ui.md §Anti-pattern](../architecture/ui.md)).
- **Panel log** per service, `tail` terakhir, bisa disegarkan.
- **Konfirmasi restart menyebut angka** ("2 job berjalan akan diulang dari awal"), bukan
  "Anda yakin?".

## 11. Alternatif yang ditimbang

- **Panel sebagai route di backend yang ada** — ditolak: masalah bootstrap §2. Tidak bisa
  mematikan dirinya sendiri, dan mati bersama hal yang seharusnya ia perbaiki.
- **PM2** (sudah ada Node) — ditolak untuk sekarang. Ia menangani proses dengan baik, tapi menambah
  dependency global, perilakunya di Windows berkuku (terutama mematikan pohon proses), dan ia tidak
  akan pernah tahu apa pun soal SQLite atau job antrean kita — padahal bagian itulah yang paling
  berguna (§5, §6). Layak ditinjau ulang bila kebutuhannya berkembang jadi banyak proses.
- **Docker Compose** — tidak bisa: Docker tidak tersedia di mesin ini (temuan saat fase downloader).
- **systemd / Windows Service** — terlalu berat untuk alat dev, dan tidak memberi UI.
- **Skrip `.bat` / `.ps1` saja** — sudah bisa start/stop, tapi tidak memberi status, tidak memberi
  log terpusat, dan tidak tahu apa-apa soal job yang sedang berjalan.
- **Mengubah SQLite jadi Postgres supaya "ada service DB-nya"** — ditolak keras: mengubah
  arsitektur data demi kerapian sebuah panel adalah ekor yang mengibaskan anjing. Postgres
  menyusul kalau dan ketika pgvector dibutuhkan, bukan sebelum itu.

## 12. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| **Panel jadi lubang RCE** bila ter-expose | Bind `127.0.0.1` dikunci di kode; allowlist perintah; tidak pernah di-deploy (§7) |
| Mematikan proses milik orang lain | Kill berdasarkan **PID**, bukan nama program; proses tak dikenal ditandai & tombolnya mati (§4) |
| Proses yatim memegang port setelah stop | Tree-kill `/T`; verifikasi port benar-benar tertutup setelah stop |
| Panel restart → mengira semua mati → start duplikat | Berkas PID + adopsi lewat pemeriksaan port (§4) |
| Restart membuang pekerjaan berjalan | Hitung job aktif + konfirmasi yang menyebut akibatnya (§5) |
| Backup DB rusak diam-diam | Pakai SQLite backup API, bukan copy berkas (§6) |
| "Start gagal" tanpa sebab yang terlihat | Tangkap stdout/stderr sejak Fase B, bukan belakangan (§8) |
| Panel ikut mati saat backend rusak | Nol impor dari paket backend — supervisor berdiri sendiri (§2) |
| Vite pindah port bila `:5173` terpakai | Baca port sebenarnya dari keluaran Vite, jangan asumsikan |

## 13. Sumber

Arsitektur & penyederhanaan sadar: [overview.md](../architecture/overview.md) ·
anti-pattern tombol mati: [ui.md](../architecture/ui.md) ·
keputusan "JS polos tanpa build step": [meeting-capture.md §3.1](meeting-capture.md) ·
perilaku requeue & status aktif: `backend/constants/__init__.py`, `backend/worker/queue.py`
