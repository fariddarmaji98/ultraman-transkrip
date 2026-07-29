# ADR 0011 — Bahasa: yang terdengar vs yang diminta, dan keluaran AI multibahasa

- Status: accepted
- Tanggal: 2026-07-29
- Terkait: [ADR 0005](0005-model-asr-runtime.md), [ADR 0007](0007-mesin-ai-dipilih-dari-ui.md), [ADR 0009](0009-ringkasan-transkrip.md), [ADR 0010](0010-chat-transkrip.md)
- Rencana: [terjemahan](../planning/terjemahan.md) (Fase 0 & A dari lima fase)

## Konteks

Aplikasi ini dibangun dengan satu asumsi diam-diam: semuanya berbahasa Indonesia. Asumsi itu
tertulis harfiah di prompt — *"Kamu meringkas transkrip rekaman berbahasa Indonesia"* — dan sudah
salah pada hari ia ditulis, karena unggahan dan unduhan sosmed bisa berbahasa apa saja.

Lebih dalam dari itu: sistem **tidak tahu** bahasa rekamannya. `Recording.language` menyimpan yang
**diminta** (hampir selalu `"auto"`), bukan yang **terdengar**. Padahal kedua provider ASR
melaporkannya dan keduanya membuangnya: `faster-whisper` mengembalikan `(segments, info)` tapi
adapter hanya memakai `info.duration`; Groq mengembalikan seluruh `verbose_json` tapi hanya
`data["segments"]` yang disentuh.

Kebutuhannya sendiri sederhana dan sering: transkrip rapat berbahasa Indonesia, tapi ringkasannya
harus dikirim ke rekan yang berbahasa Inggris atau Jepang.

## Keputusan

1. **Bahasa terdeteksi dibawa lewat tipe balikan, bukan atribut samping.** `transcribe()` kini
   mengembalikan `TranscriptResult(segments, language)`. Bahasa adalah **hasil** transkripsi, bukan
   efek sampingnya, dan polanya sudah ada di repo: `MediaSource.probe()` mengembalikan `MediaInfo`.
   Biayanya satu call site — `transcribe()` cuma dipanggil dari `worker/pipeline.py`.

2. **Bahasa hanya disimpan bila permintaannya `auto`.** Pada permintaan eksplisit, faster-whisper
   memantulkan kode yang diminta dan menetapkan `language_probability = 1`; Groq bahkan diberi tahu
   lebih dulu lewat `form["language"]`. Menyimpan gema itu sebagai "terdeteksi" akan menghapus jejak
   bahwa ia bukan hasil deteksi. `NULL` berarti "belum pernah dideteksi", dan itu keadaan yang jujur.

3. **Katalog bahasa hidup di `constants` dan disajikan lewat `GET /api/config`.** Sebelumnya
   satu-satunya daftar ada hardcoded di `UploadPanel.jsx` dengan tiga entri — di sisi yang salah.
   Balasan Groq dinormalkan saat masuk (ia memberi NAMA bahasa, faster-whisper memberi kode); nilai
   asing disimpan `NULL` dan dicatat, tidak pernah ditulis mentah.

4. **Ringkasan dan chat dihasilkan LANGSUNG dalam bahasa tujuan dari transkrip asli.** Satu
   panggilan LLM. Bukan meringkas-lalu-menerjemahkan, dan bukan meringkas transkrip terjemahan —
   tiap tahap tambahan adalah tempat baru bagi makna untuk hilang, dan konteks yang tetap asli
   membuat sitasi `[mm:ss]` selalu menunjuk rekaman yang sungguhan.

5. **Seluruh prompt ditulis ulang jadi bahasa Inggris**, bukan sekadar mencabut kalimat
   *"Tulis dalam bahasa Indonesia"*. Selama heading, `Format:`, `Transkrip:`, dan instruksi
   map-reduce semuanya berbahasa Indonesia, model tetap condong menjawab Indonesia betapa pun bahasa
   lain yang diminta — kecondongannya ada di seluruh teks, bukan di satu kalimat. Perintah bahasa
   ditaruh **paling akhir**, dan heading diminta ikut diterjemahkan.

6. **Setiap bahasa punya barisnya sendiri, dan semuanya disimpan.** `summaries` unik per
   `(recording_id, lang)`; `chat_messages.lang` memisahkan utas. Berpindah ke bahasa yang sudah
   pernah dibuat tidak memanggil AI sama sekali.

7. **Baris lama diisi `id`, bukan `detected_language`.** Rencana awal menyebut yang kedua; itu
   mustahil, karena kolom itu baru lahir dan `NULL` untuk semua rekaman lama. Yang benar lebih
   sederhana: prompt lama memaksa bahasa Indonesia, jadi isinya memang berbahasa itu.
   `DEFAULT_AI_LANGUAGE` sengaja sama dengan nilai backfill, sehingga membuka rekaman lama tanpa
   menyentuh pemilih berperilaku persis seperti sebelum fitur ini ada.

8. **Chat mengaku ketika potongannya adalah awal transkrip**, bukan bagian terelevan. Pemilihan
   konteks memakai pencocokan kata ([ADR 0010](0010-chat-transkrip.md)), dan pada bahasa tanpa spasi
   irisannya **selalu** kosong — `sorted` yang stabil lalu mengembalikan urutan asli. Tanpa ini,
   pertanyaan soal menit 25 dijawab percaya diri dari menit 0–8 sementara prompt tetap mengklaim
   "paling relevan".

9. **Dua pemilih bahasa, dua maksud berbeda.** Yang di panel unggah menentukan bahasa apa yang
   **didengarkan** mesin transkrip; yang di panel AI menentukan bahasa **tulisan** ringkasan dan
   chat. Yang kedua tidak menyentuh transkrip sama sekali.

## Alternatif yang ditimbang

- **Atribut samping pada provider** (`provider.detected_language` diisi di dalam `transcribe`) —
  ditolak. Diff-nya paling kecil, kontraknya paling buruk: kopling temporal yang tak terlihat di
  `Protocol`, sehingga adapter ketiga tidak dituntun mengisinya, dan state mutable yang diam-diam
  bergantung pada worker `concurrency=1`.
- **Callback `on_language`** — ditolak. Waktunya asimetris parah: di provider lokal bahasa sudah
  diketahui sebelum satu segmen pun keluar, di Groq baru sesudah satu-satunya POST selesai.
- **Menerjemahkan ringkasan Indonesia ke bahasa tujuan** — ditolak; dua panggilan LLM untuk hasil
  yang lebih buruk, dan istilah teknis dua kali melewati corong yang bisa keliru.
- **Mengisi `detected_language` juga pada permintaan eksplisit** — ditolak; lihat keputusan 2. Ini
  yang paling menggoda karena datanya *ada*, dan justru itu jebakannya.
- **Tabel heading per bahasa (9 × 3 string)** — ditolak; berarti menerjemahkan sendiri ke Korea,
  Arab, dan Mandarin tanpa cara memverifikasinya. Model yang menulis isinya lebih layak dipercaya
  menulis judulnya.
- **Bahasa AI mengikuti `detected_language` rekaman** — ditunda ke Fase C. Menyatukan pemilih kolom
  kanan dan panel AI adalah keputusan UI tersendiri, bukan efek samping fase ini.

## Konsekuensi

- **Model bisa mengabaikan instruksi bahasa, dan hasilnya tetap tersimpan sebagai bahasa itu.**
  Diuji dengan DeepSeek dan patuh, tapi model kecil (default repo `ollama`/`llama3.1`) lebih rawan.
  Tidak ada pemeriksaan otomatis; yang ada hanya tombol "Buat ulang". Batas ini nyata dan diketahui.
- **Biaya berlipat per bahasa.** Tiap bahasa adalah panggilan LLM tersendiri. Yang meredamnya adalah
  penyimpanan: sekali dibuat, berpindah ke sana gratis.
- **Catatan "transkrip terlalu panjang" tetap berbahasa Indonesia** apa pun bahasa keluarannya — ia
  ditempel di Python dan tidak pernah lewat LLM. Diterima sadar: jalurnya baru aktif pada transkrip
  belasan jam.
- **`ASRProvider` adalah `Protocol` tanpa `@runtime_checkable`.** Adapter yang lupa diperbarui tidak
  error saat impor, hanya meledak di titik pakai — dan jalur Groq baru aktif bila
  `TRANSKRIP_GROQ_API_KEY` diset. Karena itu kedua adapter diubah bersamaan, bukan satu-satu.
- **Rekaman lama tidak punya `detected_language`** sampai ditranskrip ulang. Itu perilaku yang
  benar, tapi harus diingat saat menguji: "tidak muncul" bukan berarti "tidak jalan".
- **Transkrip ulang mengganti seluruh segmen tapi tidak menyentuh ringkasan & chat lama.** Sudah
  begitu sebelum ADR ini; kini lebih terasa karena barisnya berlabel bahasa. Belum ditangani.
