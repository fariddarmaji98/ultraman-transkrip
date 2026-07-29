# Planning — Terjemahan (transkrip, ringkasan, chat)

> Fitur: transkrip dibuat dalam bahasa aslinya, lalu **teksnya** bisa dipindah-bahasakan lewat
> pemilih di kolom kanan. Ringkasan dan chat mengikuti bahasa yang sedang aktif. **Semua hasil
> disimpan**, jadi berpindah bahasa yang sudah pernah dibuat itu instan.
> Memakai seam `analysis/` ([ADR 0007](../adr/0007-mesin-ai-dipilih-dari-ui.md)) — pemakai
> ketiganya setelah [ringkasan](../adr/0009-ringkasan-transkrip.md) dan
> [chat](../adr/0010-chat-transkrip.md).

## 1. Dua pemilih bahasa yang berbeda — jangan sampai tertukar

Ini sumber kebingungan terbesar fitur ini, jadi ditegaskan lebih dulu:

| | **Sidebar kiri** (sudah ada) | **Kolom kanan** (baru) |
|---|---|---|
| Label | "Deteksi otomatis / Indonesia / Inggris" | pemilih bahasa di atas transkrip |
| Mengatur | **bahasa yang didengar mesin ASR** | **bahasa yang ditampilkan** |
| Kapan berlaku | sebelum transkrip dibuat | setelah transkrip ada |
| Mengubahnya berarti | transkrip harus dibuat ulang | terjemahkan teks yang sudah ada |
| Menyentuh audio? | ya | **tidak pernah** |

Kiri menjawab *"rekaman ini bahasanya apa?"*. Kanan menjawab *"aku mau membacanya dalam bahasa
apa?"*. Keduanya tidak berhubungan, dan yang kanan **tidak pernah** menjalankan ulang Whisper.

## 2. Alur

```
1. Transkrip dibuat  →  bahasa asli (dari pemilih kiri / deteksi otomatis)
                        ini SELALU tersimpan dan tak pernah tergantikan

2. Pemilih di kolom kanan:  [ Asli (Indonesia) ▾ ]  →  pilih 日本語
                            └─ belum ada?  jalankan job terjemahan (progres terlihat)
                            └─ sudah ada?  tampil INSTAN dari simpanan

3. Ringkasan & Chat mengikuti bahasa aktif
   └─ belum ada versi bahasa itu? tombol muncul untuk membuatnya
   └─ sudah ada? tampil instan
```

**Bahasa aktif adalah satu keadaan untuk seluruh halaman**, bukan tiga setelan terpisah. Memilih
日本語 di kolom kanan berarti transkrip, ringkasan, dan chat semuanya berbicara Jepang.

## 3. Semua disimpan, per bahasa — termasuk ringkasan dan chat

**Ini mengoreksi keputusan di revisi pertama dokumen ini**, yang menolak menyimpan ringkasan per
bahasa dengan alasan takut menumpuk ringkasan basi. Prioritasnya salah: menerjemahkan ulang
transkrip 28 menit tiap kali berpindah bahasa itu **menit-menit dan uang**, sementara "ringkasan
basi" hanya perlu tombol buat-ulang yang memang sudah ada.

Jadi tiap artefak menyimpan **penanda bahasa**:

| Artefak | Kunci | Catatan |
|---|---|---|
| Transkrip asli | `segments` (seperti sekarang) | tidak berubah, tetap sumber kebenaran |
| Transkrip terjemahan | `segment_translations(recording_id, lang, idx)` | mencerminkan `segments`; waktunya diambil dari aslinya |
| Ringkasan | `summaries(recording_id, lang)` — **unik per pasangan** | satu ringkasan per bahasa |
| Chat | `chat_messages.lang` | satu utas per bahasa |

Berpindah ke bahasa yang sudah pernah dibuat = **membaca dari DB**, tanpa panggilan LLM sama
sekali. Itu inti permintaannya.

### Chat: satu utas per bahasa

Konsekuensi yang harus disadari: memilih 日本語 menampilkan percakapan Jepang, yang **awalnya
kosong** walau kamu punya percakapan panjang dalam bahasa Indonesia. Itu disengaja — percakapan
yang separuh Indonesia separuh Jepang lebih membingungkan daripada dua utas terpisah, dan
riwayat yang dikirim ke model jadi konsisten satu bahasa.

Riwayat Indonesia-mu **tidak hilang**; ia muncul lagi begitu bahasa dikembalikan. UI harus
menyatakan ini, bukan membiarkan orang mengira percakapannya terhapus.

> **Perubahan dari revisi pertama:** dulu direncanakan chat otomatis mengikuti bahasa pertanyaan
> ("tanya Jepang → dijawab Jepang", tanpa kontrol). Itu ditinggalkan karena bertabrakan dengan
> penyimpanan: kalau bahasa jawaban ditentukan tiap pertanyaan, tidak ada penanda yang stabil
> untuk menyimpan dan memanggilnya kembali. **Bahasa aktif yang menentukan.** Mengetik bahasa
> Jepang saat bahasa aktif Indonesia tetap dijawab Indonesia — pindahkan pemilihnya untuk berganti.

## 4. Ringkasan & chat: dihasilkan langsung, bukan diterjemahkan

Keputusan ini bertahan dari revisi pertama, dan penting.

Ringkasan bahasa Jepang **tidak** dibuat dengan menerjemahkan ringkasan Indonesia, dan **tidak**
dengan meringkas transkrip yang sudah diterjemahkan. Model membaca **transkrip asli** dan menulis
ringkasannya langsung dalam bahasa Jepang.

| Cara | Panggilan LLM | Masalah |
|---|---|---|
| Ringkas → terjemahkan | 2× | Kesalahan menumpuk dua lapis |
| Terjemahkan → ringkas | 2×, yang pertama mahal | Membakar token untuk seluruh transkrip |
| **Ringkas transkrip asli, tulis dalam bahasa tujuan** | **1×** | — |

Efek sampingnya bagus: **ringkasan Jepang tidak menunggu terjemahan transkrip selesai.** Keduanya
berdiri sendiri. Kamu bisa minta ringkasan Jepang tanpa pernah menerjemahkan transkripnya.

Hal yang sama untuk chat: konteks yang dikirim ke model **selalu transkrip asli**, hanya
jawabannya yang berbahasa Jepang. Sitasi `[mm:ss]` karenanya tetap menunjuk rekaman sungguhan.

## 5. Terjemahan transkrip — bagian yang sulit

Tiap segmen terikat timestamp. Terjemahannya harus tetap terpetakan balik, kalau tidak player,
sitasi, dan ekspor SRT ikut rusak.

| Cara | Hasil |
|---|---|
| Satu panggilan per segmen | Pemetaan aman, **kualitas buruk** — tanpa konteks; ratusan panggilan, lambat dan mahal |
| Seluruh transkrip sebagai satu teks | Kualitas terbaik, **pemetaan hilang** |
| **Blok bernomor** | Konteks cukup + pemetaan terjaga ✅ |

Kirim ~40 segmen sekaligus, masing-masing berawalan indeksnya:

```
12| Jadi target kita kuartal ini
13| naik dua puluh persen.
```

Model diminta mengembalikan penomoran yang sama persis, lalu **diverifikasi**: indeks 12..51 harus
ada semua, tidak kurang, tidak lebih.

**Verifikasi itu wajib.** Model gemar **menggabungkan** dua baris pendek jadi satu kalimat yang
lebih enak dibaca. Terdengar sepele — sampai sadar akibatnya: seluruh sisa blok bergeser satu
nomor, dan terjemahan menit 5 menempel di menit 6 sampai akhir blok. Rusaknya senyap, baru
ketahuan saat ada yang mengklik sitasi.

Gagal verifikasi → ulangi blok itu dengan ukuran separuh → masih gagal → jatuhkan ke per-segmen
**untuk blok itu saja**. Lambat tapi benar, dan tidak pernah diam-diam (pelajaran dari pemotongan
senyap di [ADR 0009](../adr/0009-ringkasan-transkrip.md)).

## 6. Bahasa sumber harus diketahui — dan sekarang dibuang

`faster_whisper` mengembalikan bahasa terdeteksi di `info.language`, tapi
`asr/local_whisper.py` **hanya memakai `info.duration`**. Kolom `Recording.language` menyimpan yang
**diminta** (`auto`), bukan yang **terdeteksi**.

Untuk rekaman `auto` — default-nya — sistem tak tahu bahasa aslinya apa. Padahal pemilih di kolom
kanan harus bisa menuliskan **"Asli (Indonesia)"**, dan tidak menawarkan menerjemahkan ke bahasa
yang sama dengan aslinya.

Perbaikannya kecil: kolom `Recording.detected_language`, diisi saat transkrip selesai. Groq juga
mengembalikan `language` di `verbose_json`, jadi kedua provider bisa mengisinya.

Prompt ringkasan hari ini bahkan sudah salah tanpa fitur ini: *"Kamu meringkas transkrip rekaman
berbahasa Indonesia"* — asumsi yang runtuh begitu ada rekaman berbahasa lain.

## 7. Job berlatar untuk terjemahan; ringkasan & chat tetap sinkron

Ringkasan sinkron karena keluarannya pendek — terukur 4,9 dtk (5 menit) dan 16 dtk (28 menit).
Terjemahan **mengeluarkan sebanyak yang dimasukkan**: 25.000 karakter masuk, 25.000 keluar, dan
token keluaran itu bagian yang lambat. Perkiraan ~7.000 token ÷ ~50 token/dtk ≈ **2–3 menit** di
provider cloud cepat.

→ Terjemahan transkrip jadi **job** (`Job.kind='translate'`, progres per blok, memakai `ProgressBar`
yang sudah ada). Ringkasan & chat multibahasa **tetap sinkron** — biayanya sama dengan sekarang.

## 8. Model data

- **`Recording.detected_language`** — kode ISO hasil deteksi ASR, nullable (§6).
- **`segment_translations`** — `id, recording_id, lang, idx, text`; unik `(recording_id, lang, idx)`.
- **`summaries` + kolom `lang`** — unik `(recording_id, lang)`; "buat ulang" mengganti baris
  **untuk bahasa itu saja**. ⚠️ **Koreksi:** rencana ini semula menulis "baris lama diisi
  `detected_language` saat migrasi" — itu **mustahil**. `detected_language` baru lahir di Fase 0
  dan NULL untuk semua rekaman lama (kelimanya diminta `auto` dan belum ditranskrip ulang), jadi
  mengisi dari kolom itu sama dengan mengisi NULL. Yang benar justru lebih sederhana: isi dengan
  `DEFAULT_AI_LANGUAGE` (`id`), karena prompt lama memaksa bahasa Indonesia sehingga ringkasan
  dan chat yang tersimpan **memang** berbahasa itu.
- **`chat_messages` + kolom `lang`** — utas dipilih dengan `WHERE recording_id=? AND lang=?`.
- **`Job.kind = 'translate'`** — tanpa tabel job baru.

Migrasi: `create_all` tidak mengubah tabel lama, jadi butuh skrip ALTER seperti
`migrate_add_meeting_columns.py`. Perhatikan: menambah kolom ke tabel yang **sudah punya baris**
berarti nilai lama harus diisi, bukan dibiarkan NULL — kalau tidak, ringkasan lama akan hilang
dari tampilan begitu difilter per bahasa.

## 9. Roadmap — dari yang termurah

1. **✅ Fase 0 — bahasa terdeteksi.** Kolom `detected_language` + isi dari kedua provider ASR (§6),
   dan hapus asumsi "berbahasa Indonesia" di prompt ringkasan.
   - Bahasa dibawa lewat tipe balikan baru `TranscriptResult`, bukan atribut samping.
   - **Hanya diisi bila permintaannya `auto`.** Pada permintaan eksplisit, faster-whisper
     memantulkan kode yang diminta dengan probabilitas 1 dan Groq bahkan diberi tahu lebih dulu
     lewat form-nya — menyimpan gema itu sebagai "terdeteksi" menghapus jejak bahwa ia bukan deteksi.
   - Katalog bahasa pindah ke `constants` dan disajikan lewat `GET /api/config`; balasan Groq
     dinormalkan karena ia memberi NAMA bahasa, bukan kode.
2. **✅ Fase A — ringkasan & chat multibahasa.** Kolom `lang` di `summaries` + `chat_messages`,
   parameter bahasa di prompt, pemilih bahasa di panel AI. **Belum ada terjemahan transkrip** —
   dan memang tidak perlu, karena keduanya membaca transkrip asli (§4).
   - Seluruh prompt ditulis ulang jadi **bahasa Inggris**, bukan sekadar mencabut kalimat pemaksa:
     ketika heading, label, dan instruksi semuanya berbahasa Indonesia, model tetap condong
     menjawab Indonesia betapa pun bahasa lain yang diminta. Perintah bahasa ditaruh paling akhir.
   - Chat menyebutkan bila potongan yang dikirim ternyata **awal transkrip**, bukan bagian
     terelevan. Pada bahasa tanpa spasi (Jepang, Mandarin, Thai) pencocokan kata tidak pernah
     menghasilkan irisan, jadi tanpa ini jawabannya percaya diri atas bagian yang salah.
   - Terverifikasi dengan LLM sungguhan: ringkasan Jepang lengkap dengan heading Jepang
     (`## 要約`), dan sitasi `[mm:ss]` tetap utuh serta bisa diklik.
   - Batasan yang diterima sadar: catatan "transkrip terlalu panjang" ditempel di Python dan
     tidak pernah lewat LLM, jadi ia tetap berbahasa Indonesia. Jalurnya baru aktif pada
     transkrip belasan jam.
3. **Fase B — terjemahan transkrip.** `analysis/translate.py` (blok bernomor + verifikasi §5),
   tabel `segment_translations`, `Job.kind='translate'`, endpoint
   `POST /api/recordings/{id}/translate {lang}`, pemilih Asli/bahasa di kolom kanan + progres.
4. **Fase C — satu bahasa aktif untuk seluruh halaman.** Menyatukan pemilih kolom kanan dan panel
   AI jadi satu keadaan (§2), plus penanda "versi bahasa ini belum dibuat".
5. **Fase D — ekspor & tampilan berdampingan.** `?fmt=srt&lang=ja`, dan mode dua kolom
   asli-vs-terjemahan untuk memeriksa hasil.

Fase A berdiri sendiri dan bisa dipakai tanpa Fase B. Fase B adalah pekerjaan yang sesungguhnya.

## 10. UI

- **Pemilih bahasa di kolom kanan**, tepat di atas daftar segmen (di bawah player):
  `Asli (Indonesia)` + bahasa yang **sudah** diterjemahkan + "Terjemahkan ke…" untuk yang belum.
- **Yang belum ada harus terlihat belum ada.** Memilih bahasa baru memulai job dengan progres,
  bukan memuat diam-diam lalu membeku beberapa menit.
- **Ringkasan & chat**: bila versi bahasa aktif belum ada, tampilkan tombol membuatnya — bukan
  kosong tanpa penjelasan, dan bukan pula versi bahasa lain yang menyesatkan.
- **Chat kosong setelah ganti bahasa** harus dijelaskan ("percakapan bahasa lain tersimpan
  terpisah"), supaya tidak terbaca sebagai riwayat yang terhapus.
- **Sitasi tetap menunjuk waktu asli** apa pun bahasanya.

## 11. Alternatif yang ditimbang

- **`task="translate"` bawaan Whisper** — ditolak: **hanya bisa ke bahasa Inggris**, itu batasan
  modelnya. Ia juga bekerja di atas audio dan menuntut ASR diulang, sedangkan seluruh arah fitur
  ini adalah bekerja di atas teks yang sudah jadi.
- **Chat mengikuti bahasa pertanyaan otomatis** — ditinggalkan (§3): tidak memberi penanda bahasa
  yang stabil untuk disimpan dan dipanggil kembali.
- **Tidak menyimpan ringkasan per bahasa** — dibatalkan (§3): menerjemahkan ulang itu mahal,
  ringkasan basi cuma perlu tombol buat-ulang.
- **Model MT khusus (NLLB-200, M2M100)** — ditunda. Lebih murah dan bisa lokal, tapi menambah
  dependency + unduhan model, sedangkan seam `analysis/` sudah terbukti dipakai dua fitur.
- **Menerjemahkan otomatis begitu transkrip selesai** — ditolak: mahal, dan kebanyakan rekaman tak
  akan pernah dibaca dalam bahasa lain.

## 12. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| **Segmen bergeser senyap** karena model menggabungkan baris | Verifikasi indeks per blok; ulang blok lebih kecil; fallback per-segmen (§5) |
| Sitasi `[mm:ss]` diubah model jadi format lokal (`[5分25秒]`) | Prompt menegaskan format wajib; regex `CitedText` ketat sehingga gagalnya terlihat, bukan senyap |
| Dua pemilih bahasa membingungkan | Label & penempatan berbeda tegas (§1); yang kiri di panel Engine, yang kanan menempel pada transkrip |
| Chat terlihat "hilang" setelah ganti bahasa | Penjelasan di UI (§10); riwayat lama utuh dan kembali saat bahasa dikembalikan |
| Migrasi menghapus ringkasan lama dari tampilan | Isi `lang` baris lama dengan `detected_language` saat ALTER, jangan biarkan NULL (§8) |
| Biaya membengkak (tiap bahasa = satu transkrip penuh) | Semuanya disimpan — bayar sekali per bahasa; jangan pernah menerjemahkan otomatis |
| Nama orang & istilah teknis ikut diterjemahkan | Instruksi prompt: pertahankan nama diri dan istilah teknis apa adanya |
| Rekaman campur Indonesia-Inggris | Lazim di rapat nyata; sebutkan bahasa sumber ke model, jangan andalkan tebakannya |

## 13. Sumber

Seam AI internal: [ADR 0007](../adr/0007-mesin-ai-dipilih-dari-ui.md) ·
map-reduce & anti-pemotongan-senyap: [ADR 0009](../adr/0009-ringkasan-transkrip.md) ·
sitasi menit yang bisa diklik: [ADR 0010](../adr/0010-chat-transkrip.md) ·
batasan `task=translate`: [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
