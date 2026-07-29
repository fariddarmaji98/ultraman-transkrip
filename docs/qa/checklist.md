# Checklist QA — bahasa, terjemahan, dan rekaman meeting

> Daftar uji manual untuk yang **belum bisa diverifikasi dari sisi kode**. Yang sudah kuuji
> disebutkan apa adanya supaya tidak dikerjakan dua kali; yang belum ditandai jujur sebagai belum.
> Repo ini tidak punya tes otomatis sama sekali, jadi ini satu-satunya jaring pengaman.

Cara pakai: jalankan backend & frontend, lalu turuti bagian A dulu (ia memblokir pekerjaan lain).

```bash
cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000
```
```bash
cd frontend/web && npm run dev
```

> ⚠️ Backend dijalankan **tanpa `--reload`**. Di Windows, mode reload menjalankan app di proses
> spawn dengan selector event loop, dan `create_subprocess_exec` melempar `NotImplementedError` di
> sana — seluruh pemanggilan ffmpeg gagal. Kalau mengubah kode backend, **restart manual**.

### Bila Chrome ada di mesin lain

Backend dan browser tidak harus satu mesin. Yang perlu diubah:

- [ ] Backend dijalankan dengan `--host 0.0.0.0` (kalau tidak, ia hanya mendengarkan localhost)
- [ ] Vite juga, bila webapp-nya mau dibuka dari sana: `npm run dev -- --host`
- [ ] Popup ekstensi → **⚙ Server** → isi alamat backend → **Simpan alamat** → setujui prompt izin

Detailnya di [README ekstensi](../../frontend/extension/README.md). Ingat: **belum ada auth** —
siapa pun yang bisa menjangkau alamat itu bisa mengunggah dan menghapus rekaman. Untuk tunnel
publik, matikan lagi setelah selesai.

---

## A. Pemblokir — harus dijalankan lebih dulu

### A1. Leg tab ekstensi benar-benar mengalir ⛔

Ini menentukan apakah Fase B rekaman meeting (label `saya`/`peserta`) boleh dikerjakan sama sekali.
Rekaman meeting yang ada punya kanal kiri **nol digital**, dan itu bisa berarti ruang Meet-nya
kosong **atau** leg tab tidak pernah mengalirkan sampel — dua sebab, angka identik.

- [ ] Reload ekstensi di `chrome://extensions`
- [ ] Buka tab yang **jelas berbunyi** (video apa pun)
- [ ] Rekam ~20 detik sambil **diam total**
- [ ] Selesai & transkrip
- [ ] Ukur berkasnya:

```bash
ffmpeg -hide_banner -i <upload_path> -af astats -f null - 2>&1 | grep -E "Channel:|RMS level dB"
```

**Lulus bila** Channel 1 (kiri/tab) berenergi (kira-kira −45..−10 dB) **dan** Channel 2 (kanan/mic)
mendekati noise floor — kebalikan persis dari rekaman uji sebelumnya.
**Gagal berarti** bug ada di `frontend/extension/offscreen/offscreen.js`, dan Fase B belum boleh dimulai.

---

## B. Ekstensi meeting — belum pernah diuji setelah perbaikan

Jalur medianya tidak bisa kujalankan tanpa Chrome-mu. Semua ini **belum terverifikasi**.

- [ ] **B1 — mikrofon ditolak.** Blokir izin mic, lalu rekam. Harapan: rekaman tetap jalan,
      popup memperingatkan sebelum mulai, berkasnya tetap 2 kanal dengan kanan senyap (bukan mono).
- [ ] **B2 — potongan hilang terlihat.** Mulai rekam, **matikan backend** ~20 detik di tengah,
      nyalakan lagi, lalu Selesai. Harapan: popup menyebut berapa potongan gagal dan ±berapa detik
      audio hilang. Dulu ini lenyap tanpa jejak.
- [ ] **B3 — peringatan tidak dimusnahkan START yang gagal.** Setelah B2, matikan backend lalu
      klik "Mulai rekam". Harapan: START gagal, **dan peringatan B2 masih ada** (bukan hilang).
- [ ] **B4 — peringatan tidak abadi.** Setelah sesi sukses yang berlubang, tutup popup lalu buka
      lagi. Harapan: peringatan **tidak** muncul lagi (ia milik sesi yang sudah ditutup).
- [ ] **B5 — batalkan sesi.** Rekam sebentar lalu "Batalkan & buang". Harapan: potongan terhapus,
      tidak ada baris rekaman menggantung di riwayat.
- [ ] **B6 — meeting sungguhan ≥2 orang.** Rekam meeting nyata, lalu ukur seperti A1. Harapan:
      kedua kanal berenergi. Simpan berkasnya — ini bahan kalibrasi Fase B.

---

## C. Terjemahan — sudah kuuji di skala kecil, perlu skala nyata

Sudah kuverifikasi: rekaman 104 segmen → 104 terjemahan, indeks identik, batas blok sejajar,
progres 0→38→76→100. Yang di bawah ini **belum**.

- [ ] **C1 — transkrip panjang (rec 1, 945 segmen).** Terjemahkan ke Inggris. Perhatikan waktu,
      biaya, dan apakah jumlah segmennya tetap 945. Ini ~24 blok; kalau ada blok yang gagal
      verifikasi, jumlah panggilan melonjak dan itu akan terasa.
- [ ] **C2 — chat bahasa non-Latin pada transkrip panjang.** Set bahasa aktif ke 日本語 pada rec 1,
      lalu tanyakan sesuatu yang **hanya ada di menit-menit akhir**. Harapan: jawabannya mengaku
      hanya menerima bagian awal rekaman. Pencocokan kata tidak pernah beririsan untuk bahasa tanpa
      spasi, jadi ini justru keadaan yang harus terlihat, bukan disembunyikan.
- [ ] **C3 — model kecil.** Ganti mesin AI ke Ollama (`llama3.1`), lalu minta ringkasan 日本語.
      Harapan realistis: **bisa gagal** — model kecil rutin mengabaikan instruksi bahasa. Kalau
      hasilnya berbahasa Indonesia, ia tetap tersimpan berlabel `ja`. Ini batas yang diketahui,
      bukan bug baru; tekan "Buat ulang" atau pakai mesin yang lebih besar.
- [ ] **C4 — restart di tengah terjemahan.** Mulai terjemahkan rec 1, matikan backend saat progres
      ~40%, nyalakan lagi. Harapan: job di-antre ulang sendiri dan selesai (bukan menggantung di
      `queued`).
- [ ] **C5 — dua klik "Buat ulang" ringkasan.** Klik dua kali cepat, atau dari dua tab. Harapan:
      **409** dengan pesan yang bisa dibaca, bukan 500 berisi `IntegrityError`.
- [ ] **C6 — bandingkan di panel lebar.** Aktifkan "Bandingkan", lalu geser lebar kolom transkrip
      sampai 900px dan sampai 360px. Harapan: dua kolom tetap terbaca, membungkus dengan wajar.

---

## D. Regresi jalur lama — yang paling mudah rusak diam-diam

Fase 0 mengubah **tipe balikan** `ASRProvider.transcribe`, dan Fase A–D menyentuh lima endpoint
yang sudah ada. Semua ini pernah jalan; pastikan masih.

- [ ] **D1 — upload biasa.** Unggah audio/video baru dengan "Deteksi otomatis". Harapan: transkrip
      jadi, dan header menampilkan bahasa terdeteksi.
- [ ] **D2 — upload dengan bahasa dipilih manual.** Pilih "Indonesia" saat mengunggah. Harapan:
      transkrip jadi, dan `detected_language` **tetap kosong** — yang dikembalikan provider pada
      jalur eksplisit cuma gema permintaan, bukan deteksi. Ini disengaja.
- [ ] **D3 — unduh dari URL.** Tempel link TikTok/X, lalu transkrip. Harapan: keduanya jalan.
- [ ] **D4 — provider Groq.** Set `TRANSKRIP_ASR_PROVIDER=groq` + kuncinya, lalu transkrip.
      **Belum pernah diuji sama sekali** setelah perubahan tipe balikan. Perhatikan juga apakah
      `detected_language` terisi kode ISO (`id`), bukan nama (`indonesian`) — normalisasinya sudah
      ada tapi bentuk balasan Groq belum pernah dilihat langsung.
- [ ] **D5 — ekspor asli.** Set bahasa ke "Asli", lalu unduh TXT/SRT/JSON. Harapan: isinya bahasa
      asli, nama berkas tanpa akhiran bahasa.
- [ ] **D6 — sitasi chat.** Klik menit di jawaban chat. Harapan: player melompat, transkrip
      bergulir, status main/jeda tidak berubah.
- [ ] **D7 — rekaman lama.** Buka rec 1/2/3 (dibuat sebelum Fase 0). Harapan: terbuka normal,
      pemilih menulis "Asli" saja tanpa nama bahasa, dan ringkasan Indonesia lamanya tetap tampil.

---

## E. Celah yang sudah diketahui — jangan dilaporkan sebagai bug baru

Ini bukan uji, melainkan hal yang **memang belum ditangani**. Ditulis di sini supaya tidak
dikira temuan.

| Celah | Akibatnya | Status |
|---|---|---|
| Transkrip ulang tidak menghapus terjemahan & ringkasan lama | Setelah ganti model ASR, terjemahan lama menggambarkan teks yang sudah berubah kata demi kata | belum ditangani |
| Model bisa mengabaikan instruksi bahasa | Hasil berbahasa lain tetap tersimpan berlabel bahasa yang diminta | tidak ada pemeriksaan otomatis |
| Catatan "transkrip terlalu panjang" selalu bahasa Indonesia | Ringkasan Jepang pada rekaman belasan jam berekor satu kalimat Indonesia | diterima sadar |
| Rekaman lama tanpa `detected_language` | Pemilih menawarkan menerjemahkan ke bahasa yang sama dengan aslinya | hilang setelah transkrip ulang |
| Lubang audio meeting hanya terlihat di popup | Menutup popup menghilangkan satu-satunya bukti | [task #31] |
| Path media absolut di DB | Memindahkan folder proyek mematikan rekaman lama | ada obatnya: `scripts/repair_media_paths.py` |
