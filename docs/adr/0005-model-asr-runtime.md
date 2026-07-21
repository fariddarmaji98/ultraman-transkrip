# ADR 0005 — Model ASR bisa diganti saat runtime (dari UI)

- Status: accepted
- Tanggal: 2026-07-21
- Terkait: [ADR 0001](0001-centralized-constants.md), [ADR 0004](0004-dark-ui-colibri.md), [apicontract.md](../../.agent/spec/active/webapp-transkrip-mvp/apicontract.md)

## Konteks

Model Whisper lokal sebelumnya hanya bisa diatur lewat env `TRANSKRIP_LOCAL_WHISPER_MODEL` dan
butuh restart backend. Panel Engine di sidebar hanya **menampilkan** nama model (`large-v3-turbo`).

User bertanya apa arti wording itu, lalu minta modelnya **bisa dipilih langsung dari panel ENGINE**.
Ini masuk akal karena trade-off model itu nyata dan sering: `base` cepat tapi WER 23% untuk Bahasa
Indonesia, `large-v3-turbo` akurat (WER 5,4%) tapi menyita CPU. Pilihan yang tepat tergantung
apakah user sedang buru-buru atau butuh hasil rapi.

## Keputusan

**Model lokal bisa diganti saat runtime lewat `PATCH /api/config`, dengan katalog tertutup dan
pilihan yang bertahan lintas-restart.**

1. **Katalog tertutup** di `constants.LOCAL_MODEL_CHOICES` — 6 entri (`base`, `small`, `medium`,
   `large-v3-turbo`, `large-v3`, `cahya/faster-whisper-medium-id`), masing-masing dengan label,
   perkiraan ukuran unduhan, dan catatan singkat. `GET /api/config` mengirim katalog ini ke FE.
2. **`PATCH /api/config`** menerima `{model}`; **422** bila di luar katalog.
3. **Persistensi via `data/runtime.json`** (bukan DB). Dibaca `app.runtime.load()` saat lifespan
   startup.
4. **Env tetap menang.** Bila `TRANSKRIP_LOCAL_WHISPER_MODEL` ada di environment, `runtime.json`
   diabaikan — deployment yang dikonfigurasi env tidak bisa diam-diam ditimpa pilihan UI lama.
5. **Ditolak saat sibuk.** **409** bila provider `groq` (model dikunci di sisi mereka) atau bila ada
   recording ber-status `ACTIVE_STATUSES`. Guard ada di backend, bukan cuma disable di UI.
6. **Cache model dikosongkan** (`asr.local_whisper.reset_model_cache()` → `lru_cache.cache_clear()`)
   supaya transkrip berikutnya benar-benar memuat model baru.

## Alternatif yang ditimbang

- **Tetap env-only** — ditolak; user harus restart backend hanya untuk mencoba model lain.
- **Input teks bebas (nama repo HuggingFace apa saja)** — ditolak. Salah ketik baru ketahuan saat
  job jalan, model non-CTranslate2 gagal dimuat, dan satu klik bisa memicu unduhan multi-GB tanpa
  peringatan. Katalog tertutup + label ukuran jauh lebih aman.
- **Tabel setelan di DB** — ditolak untuk satu baris konfigurasi; file JSON di `data/` sudah cukup
  dan `data/` sudah masuk `.gitignore`.
- **Izinkan ganti model di tengah job** — ditolak; transkrip satu rekaman bisa tercampur dua model.
- **Warm-up model saat dipilih** (unduh langsung) — ditolak; request PATCH akan menggantung
  bermenit-menit. Sebagai gantinya UI menampilkan perkiraan ukuran + catatan "diunduh saat pertama
  dipakai".

## Konsekuensi

- `GET /api/config` sekarang mengembalikan `models[]` (kosong saat provider `groq`) — FE menampilkan
  dropdown hanya bila katalog terisi dan model aktif ada di dalamnya; selain itu jatuh ke teks biasa.
- **Ada dua sumber kebenaran berjenjang** untuk model: env > `runtime.json` > default constants.
  Urutan ini didokumentasikan di apicontract dan di docstring `app/runtime.py`.
- **Ganti model tidak menyentuh transkrip lama.** Hasil yang sudah tersimpan tetap apa adanya;
  tidak ada re-transkrip otomatis.
- Menambah model = tambah satu entri di `LOCAL_MODEL_CHOICES`. Tidak ada nama model tersebar di
  route atau komponen FE (konsisten dengan ADR 0001).
- Panel Engine berubah dari read-only jadi kontrol tulis pertama di sidebar — dan lampu statusnya
  kini ikut menunjukkan "Engine sibuk" saat ada job berjalan.
