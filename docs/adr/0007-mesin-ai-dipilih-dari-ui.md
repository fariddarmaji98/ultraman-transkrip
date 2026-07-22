# ADR 0007 — Mesin AI dipilih dari UI (lokal atau API) + penyimpanan kunci

- Status: accepted · **diamandemen 2026-07-22** (lihat §Amandemen di bawah)
- Tanggal: 2026-07-21
- Terkait: [ADR 0003](0003-modular-monolith-not-microservices.md), [ADR 0005](0005-model-asr-runtime.md), [ADR 0006](0006-workspace-tiga-kolom.md), [colibri-direction.md](../planning/colibri-direction.md)

## Konteks

Kolom tengah workspace (ADR 0006) disiapkan untuk ringkasan + chat, tapi kontrolnya dikunci karena
belum ada mesin AI. `analysis/base.py` sejak awal hanya berisi Protocol `LLMProvider` tanpa
implementasi — "titik tempel" yang dijanjikan ADR 0002.

Saat ditanya mau pakai LLM apa, user menjawab: **"aku mau semua opsi, karna aku juga pingin pakai
AI local dan juga api"**, dan minta pemilihnya berupa **popup lewat tombol ikon settings**, bukan
env atau file konfigurasi.

Ini menambah masalah baru yang tidak ada di ADR 0005 (model ASR): **kunci API**. Model Whisper
tidak butuh rahasia; provider LLM berbayar butuh.

## Keputusan

**Satu jalur OpenAI-compatible untuk semua provider, dipilih dari popup Setelan, dengan kunci API
disimpan di sisi server dan tidak pernah dikirim balik ke browser.**

1. **Katalog `LLM_PROVIDERS`** di constants: `ollama` (lokal), `groq`, `deepseek`, `anthropic`,
   `openai`. Tiap entri punya `base_url`, `default_model`, `needs_key`, dan catatan singkat yang
   ditampilkan apa adanya di UI.
2. **Satu adapter**, bukan lima: `analysis/openai_compat.py` memanggil `POST {base_url}/chat/completions`
   via httpx. Menambah provider = satu entri di constants.
3. **Default `ollama`** — sejalan dengan ASR yang juga default lokal: tanpa kunci, tanpa biaya,
   teks tidak keluar dari mesin.
4. **Kunci API tersimpan di server** (`data/runtime.json`), dan `GET /api/llm` hanya mengirim flag
   **`key_set`** per provider — nilainya tidak pernah kembali ke klien.
5. **Env menang** (konsisten ADR 0005): `TRANSKRIP_LLM_PROVIDER` mengunci pilihan UI, dan
   `TRANSKRIP_LLM_API_KEY` mengalahkan kunci tersimpan untuk provider aktif.
6. **Tombol "Tes koneksi" memanggil provider sungguhan** (`ping()` = completion `max_tokens: 5`),
   bukan validasi format kunci. Gagal dijawab **200 `{ok:false, detail}`**, bukan error HTTP —
   ini hasil diagnostik, bukan request yang gagal.
7. **Popup terpisah dari panel Engine.** Panel Engine (sidebar) tetap untuk ASR; mesin AI ada di
   modal lewat ikon gerigi di header sidebar.

## Alternatif yang ditimbang

- **Satu SDK per provider** (`openai`, `anthropic`, `ollama`) — ditolak. Tiga dependensi baru untuk
  protokol yang di bawahnya sama; `httpx` sudah ada di repo dan sudah dipakai provider Groq ASR.
- **Kunci API hanya lewat env** — ditolak; user eksplisit minta bisa diisi dari UI. Env tetap
  didukung dan tetap menang, jadi jalur deployment tidak dikorbankan.
- **Simpan kunci di `localStorage` browser lalu kirim tiap request** — ditolak. Kunci jadi terbuka
  untuk XSS dan devtools, dan ikut terkirim di tiap request. Server-side lebih sempit permukaannya.
- **Enkripsi kunci at-rest di `runtime.json`** — ditolak untuk sekarang. Proses yang sama harus bisa
  mendekripsi, jadi kunci enkripsinya ikut tersimpan di mesin yang sama — upacara tanpa proteksi
  nyata untuk aplikasi single-user. Jawaban sungguhannya adalah env di deployment, dan itu yang
  didokumentasikan di README.
- **Validasi format kunci di FE** (mis. awalan `sk-`) — ditolak; awalan berbeda-beda antar provider
  dan format yang benar tidak berarti kuncinya aktif. Ping sungguhan lebih jujur.
- **Gabungkan setelan AI ke panel Engine di sidebar** — ditolak; sidebar sudah padat, dan ASR vs LLM
  adalah dua hal berbeda yang kebetulan sama-sama "AI".
- **Streaming jawaban sejak awal** — ditunda ke M3 (chat). Ringkasan cukup sekali balas, dan
  Protocol `LLMProvider` sengaja disederhanakan ke `async complete()` daripada menyimpan parameter
  `stream` yang belum diimplementasi.

## Konsekuensi

- **`analysis/` naik status** dari stub jadi modul berisi: `base.py` (Protocol, kini `async`),
  `openai_compat.py` (adapter), `__init__.py` (`resolve()` + `get_llm()`, cermin `asr/__init__.py`).
- **`data/runtime.json` sekarang menyimpan rahasia.** Sudah gitignore, tapi izin file jadi relevan —
  dan file ini tidak boleh ikut dalam backup yang dibagikan.
- **Claude lewat endpoint OpenAI-compatible Anthropic**, bukan SDK native. Konsekuensinya fitur khas
  Anthropic (mis. kontrol thinking) tidak terekspos. Bila nanti dibutuhkan, tambah adapter kedua di
  belakang Protocol yang sama — bukan refactor pemanggil.
- **Pesan error diteruskan apa adanya dari provider** bila ada (`error.message`), dengan fallback
  yang menerjemahkan kode HTTP (401/403 → kunci ditolak, 404 → model tidak ada). Kasus "belum ada
  kunci" dicegat lokal supaya tidak membuang panggilan jaringan.
- **Kolom tengah masih mati.** ADR ini hanya menyiapkan mesinnya; endpoint ringkasan (M2) yang akan
  memakainya menyusul. Ini disengaja: memilih mesin dan memakai mesin adalah dua langkah terpisah
  yang bisa diuji sendiri-sendiri.

## Amandemen 2026-07-22 — penanganan kunci di UI

### Kejadian yang memicu

User melapor kuncinya "hilang" setelah disimpan. Investigasi: **jalur simpannya sehat** — direproduksi
lewat UI, kunci langsung masuk `data/runtime.json`. Yang rusak adalah UI-nya, yang membuka tiga cara
untuk *mengira* sudah menyimpan padahal belum:

1. **"Tes koneksi" tidak menyimpan apa pun**, tapi menampilkan pesan sukses hijau yang terasa seperti
   "beres". Kunci yang cuma dites lalu modal ditutup = hilang.
2. **Ganti provider mengosongkan field kunci** (kunci milik satu provider). Klik Simpan setelah itu
   menyimpan provider baru dengan kunci kosong — persis kondisi yang ditemukan di file.
3. **"hapus kunci tersimpan" menghapus seketika tanpa konfirmasi**, tulisannya kecil dan persis di
   atas kolom input.

Ditambah satu ambiguitas: saat kunci sudah tersimpan, field tetap kosong dan bisa diketik — tidak ada
cara membedakan "belum ada kunci" dari "ada kunci, tapi tidak ditampilkan".

### Keputusan tambahan

1. **Kunci tersimpan → field dikunci** (`disabled`), placeholder `•••• tersimpan di server`.
   Satu-satunya jalan mengganti kunci: **hapus dulu, baru isi**. Mengetik di atas kunci yang sudah ada
   tidak punya arti yang jelas (mengganti? menambah?), jadi kemungkinannya dihilangkan.
2. **Hapus kunci wajib konfirmasi** lewat `ConfirmModal` — menghapus kredensial itu tak bisa dibatalkan
   dan memutus fitur AI, jadi setara dengan menghapus rekaman.
3. **Pesan sukses tes menyebut langkah berikutnya**: "… merespons — klik Simpan agar kuncinya
   tersimpan."
4. **Peringatan kuning** saat provider butuh kunci tapi tidak ada satu pun (baik yang diketik maupun
   yang tersimpan).
5. **`ConfirmModal` dinaikkan ke `z-40`** (sebelumnya `z-20`, di bawah `SettingsModal` `z-30`) supaya
   bisa dipanggil dari dalam modal lain. Tanpa ini konfirmasinya muncul di belakang dan tombolnya
   seolah tidak berfungsi.

### Konsekuensi

- **Mengganti kunci jadi dua langkah** (hapus → isi). Disengaja: satu langkah tambahan lebih murah
  daripada satu kredensial hilang diam-diam.
- **`ConfirmModal` kini komponen konfirmasi lintas-aplikasi**, bukan khusus hapus rekaman. Pemanggil
  baru tidak perlu memikirkan lapisan lagi.
- **Tetap tidak ada cara melihat kunci yang tersimpan** — keputusan inti ADR ini tidak berubah: nilai
  kunci tidak pernah dikirim balik ke browser, hanya flag `key_set`. Konsekuensinya user harus
  menyimpan kuncinya sendiri di tempat lain; UI hanya bisa memberitahu *ada* atau *tidak ada*.
- Penanda **"belum aktif"** di `AiPanel` diubah jadi merah agar terbaca sebagai "ada yang belum beres",
  bukan sekadar keterangan netral.
