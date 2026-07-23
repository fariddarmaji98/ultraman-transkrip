# Planning — Terjemahan (transkrip, ringkasan, chat)

> Fitur: rekaman berbahasa A ditranskrip apa adanya, lalu **teksnya** bisa diterjemahkan ke bahasa
> B/C/D. Ringkasan bisa diminta dalam bahasa lain, dan chat menjawab dalam bahasa pertanyaannya.
> Memakai seam `analysis/` yang sudah ada ([ADR 0007](../adr/0007-mesin-ai-dipilih-dari-ui.md)) —
> terjemahan jadi pemakai ketiganya, setelah [ringkasan](../adr/0009-ringkasan-transkrip.md) dan
> [chat](../adr/0010-chat-transkrip.md).

## 1. Bentuk fiturnya

**Transkrip asli lebih dulu, selalu.** Terjemahan bekerja di atas **teks yang sudah jadi**, bukan
di atas audio, dan tidak pernah menggantikan aslinya. Tiga hal terpisah yang kebetulan senasib:

```
audio bahasa A ──► transkrip bahasa A  (seperti sekarang, tak berubah)
                          │
                          ├──► TERJEMAHAN TRANSKRIP ke bahasa B   (disimpan, per segmen)
                          ├──► RINGKASAN langsung dalam bahasa B  (tidak disimpan per bahasa)
                          └──► CHAT: tanya bahasa Jepang → jawab bahasa Jepang
```

Yang penting dari urutan ini: **rekaman aslinya tetap jadi sumber kebenaran.** Sitasi `[mm:ss]`
tetap menunjuk audio yang sebenarnya, apa pun bahasa yang sedang ditampilkan.

## 2. Ringkasan & chat **tidak diterjemahkan** — dihasilkan langsung

Keputusan terpenting di dokumen ini, dan yang paling mudah salah.

Godaannya: ringkas dulu lalu terjemahkan ringkasannya, atau terjemahkan transkrip lalu ringkas.

| Cara | Panggilan LLM | Masalah |
|---|---|---|
| Ringkas → terjemahkan | 2× | Kesalahan menumpuk dua lapis; istilah teknis rusak di lapis kedua |
| Terjemahkan → ringkas | 2×, yang pertama mahal | Membakar token untuk seluruh transkrip padahal hasilnya cuma beberapa paragraf |
| **Ringkas langsung dalam bahasa tujuan** | **1×** | — |

Model membaca transkrip Indonesia dan **menulis ringkasannya langsung dalam bahasa Jepang**. Bukan
trik — LLM memang multibahasa, dan sumbernya tetap teks asli sehingga tak ada
terjemahan-dari-terjemahan.

**Konsekuensinya besar untuk perencanaan:** ringkasan & chat multibahasa hanyalah **perubahan
prompt**. Tidak ada tabel baru, tidak ada job, tidak ada penyimpanan. Terjemahan transkrip adalah
pipeline tersendiri. Dua pekerjaan yang biayanya jauh berbeda — dan itu yang menentukan urutan
pengerjaannya (§8).

## 3. Chat mengikuti bahasa pertanyaan — tanpa setelan apa pun

Tanya dalam bahasa Jepang → dijawab bahasa Jepang. Tanya bahasa Indonesia → dijawab Indonesia.
**Tidak perlu pemilih bahasa**: pertanyaannya sendiri sudah menyatakan maunya.

Hari ini `analysis/chat.py` mengunci itu:

```
"Jawab dalam bahasa Indonesia yang ringkas."
```

Diganti jadi instruksi untuk mengikuti bahasa pertanyaan. Itu satu baris, dan langsung memberi
seluruh fitur chat multibahasa.

Dua hal yang harus dijaga di prompt barunya:

- **Format sitasi `[mm:ss]` tidak boleh ikut "diterjemahkan"** jadi format lain. Ia dipakai
  `CitedText` di FE untuk melompatkan player; kalau modelnya berkreasi jadi `[5分25秒]`, tombolnya
  mati. Regex-nya ada di `CitedText.jsx` dan sengaja ketat.
- **Kutipan dari transkrip boleh diterjemahkan**, tapi waktunya tetap waktu asli. Yang dijamin
  aplikasi hanya bahwa menitnya ada di dalam durasi ([ADR 0010](../adr/0010-chat-transkrip.md)) —
  itu tidak berubah oleh bahasa.

Ringkasan **tidak** bisa memakai trik yang sama: tak ada pertanyaan yang bisa dibaca bahasanya.
Jadi ringkasan butuh pemilih bahasa; chat tidak.

## 4. Terjemahan transkrip — bagian yang sulit

Transkrip bukan teks biasa: tiap potongan **terikat timestamp**. Terjemahannya harus tetap bisa
dipetakan balik ke segmen aslinya, kalau tidak player, sitasi, dan ekspor SRT ikut rusak.

| Cara | Hasil |
|---|---|
| Satu panggilan per segmen | Pemetaan aman, **kualitas buruk** — tanpa konteks, kalimat terpenggal diterjemahkan sepotong-sepotong; ratusan panggilan, lambat dan mahal |
| Seluruh transkrip sebagai satu teks | Kualitas terbaik, **pemetaan hilang** — tak ada cara tahu kalimat mana milik menit mana |
| **Blok bernomor** | Konteks cukup + pemetaan terjaga ✅ |

**Blok bernomor**: kirim ~40 segmen sekaligus, masing-masing berawalan indeksnya.

```
12| Jadi target kita kuartal ini
13| naik dua puluh persen.
```

Model diminta mengembalikan penomoran yang sama persis, lalu hasilnya **diverifikasi**: indeks
12..51 harus ada semua, tidak kurang, tidak lebih.

**Verifikasi itu wajib, bukan kehati-hatian berlebihan.** Model suka **menggabungkan** dua baris
pendek jadi satu kalimat yang lebih enak dibaca. Terdengar sepele — sampai sadar akibatnya:
seluruh sisa blok bergeser satu nomor, dan terjemahan menit 5 menempel di menit 6 sampai akhir
blok. Rusaknya senyap, dan baru ketahuan saat ada yang mengklik sitasi.

Bila verifikasi gagal: ulangi blok itu dengan ukuran separuh; masih gagal → jatuhkan ke per-segmen
**untuk blok itu saja**. Lambat tapi benar, dan tidak pernah diam-diam (pelajaran dari pemotongan
senyap di [ADR 0009](../adr/0009-ringkasan-transkrip.md)).

## 5. Bahasa sumber harus diketahui — dan sekarang dibuang

`faster_whisper` mengembalikan bahasa hasil deteksi di `info.language`, tapi
`asr/local_whisper.py` **hanya memakai `info.duration`** dan membuang sisanya. Kolom
`Recording.language` menyimpan yang **diminta user** (`auto`), bukan yang **terdeteksi**.

Artinya untuk semua rekaman `auto` — dan itu default-nya — sistem tidak tahu bahasa aslinya apa.
Padahal itu dibutuhkan untuk:

- **menyembunyikan pilihan yang tak masuk akal** (jangan tawarkan "terjemahkan ke Indonesia" untuk
  rekaman yang memang Indonesia),
- **memberi tahu model bahasa asalnya** — penting untuk rekaman campur Indonesia-Inggris yang lazim
  di rapat kerja,
- menampilkan "Bahasa: Indonesia" di UI, yang berguna terlepas dari fitur ini.

Perbaikannya kecil: kolom `Recording.detected_language`, diisi dari `info.language` saat transkrip
selesai. Groq juga mengembalikan `language` di `verbose_json`, jadi kedua provider bisa mengisinya.

Prompt ringkasan hari ini bahkan mengasumsikannya: *"Kamu meringkas transkrip rekaman berbahasa
Indonesia"* — asumsi yang salah begitu ada rekaman berbahasa lain, terlepas dari fitur terjemahan.

## 6. Model data

- **`Recording.detected_language`** (§5) — kode ISO hasil deteksi ASR, nullable.
- **`segment_translations`** — `id, recording_id, lang, idx, text`, unik per
  `(recording_id, lang, idx)`. Bentuknya sengaja **mencerminkan `segments`**: waktunya diambil dari
  segmen asli, jadi tidak ada timestamp yang perlu disinkronkan — dan karenanya tidak bisa melenceng.
- **Tidak ada tabel job baru** — pakai `Job.kind = 'translate'`, mekanismenya sudah ada.
- **Ringkasan tidak disimpan per bahasa.** Tabel `summaries` tetap satu baris per recording; minta
  bahasa lain = buat ulang. Menyimpannya per bahasa akan melahirkan kebun ringkasan basi dalam lima
  bahasa yang tak ada yang tahu mana yang terbaru.

## 7. Job berlatar, bukan sinkron — beda dari ringkasan

Ringkasan sinkron karena terukur 4,9 dtk (5 menit) dan 16 dtk (28 menit): **keluarannya pendek**.
Terjemahan mengeluarkan sebanyak yang dimasukkan — transkrip 28 menit ≈ 25.000 karakter masuk,
25.000 karakter keluar, dan token keluaran itu bagian yang lambat.

Perkiraan kasar: ~7.000 token keluaran ÷ ~50 token/dtk ≈ **2–3 menit** di provider cloud cepat; di
Ollama CPU berkali lipat.

→ **Terjemahan transkrip jadi job** (`Job.kind='translate'`, progres per blok). Ini pemakai
`analysis/` pertama yang butuh antrean; `summarize` dan `chat` cukup sinkron.

Ringkasan & chat dalam bahasa lain **tetap sinkron** — biayanya sama persis dengan sekarang.

## 8. Roadmap — diurutkan dari yang termurah, bukan dari yang paling terlihat

1. **Fase 0 — simpan bahasa terdeteksi.** Kolom `detected_language` + isi dari kedua provider ASR
   (§5). Kecil, dan semua fase lain bergantung padanya. Berguna sendiri walau terjemahan batal.
2. **Fase A — chat menjawab dalam bahasa pertanyaan.** Satu baris prompt (§3). Tanpa UI baru,
   tanpa tabel, tanpa endpoint. Kemungkinan besar fitur dengan rasio nilai-per-baris tertinggi di
   seluruh proyek ini.
3. **Fase B — ringkasan dalam bahasa pilihan.** Pemilih bahasa di panel AI + parameter bahasa di
   prompt ringkasan. Masih tanpa tabel dan tanpa job.
4. **Fase C — terjemahan transkrip.** `analysis/translate.py` (blok bernomor + verifikasi §4),
   tabel `segment_translations`, `Job.kind='translate'`, endpoint
   `POST /api/recordings/{id}/translate {lang}`, pemilih Asli/Terjemahan di kolom transkrip.
5. **Fase D — ekspor & tampilan berdampingan.** `?fmt=srt&lang=ja`, plus mode dua kolom
   asli-vs-terjemahan (berguna untuk memeriksa hasil, dan untuk yang sedang belajar bahasa).

Fase A dan B bisa selesai dalam satu sesi. Fase C adalah pekerjaan yang sesungguhnya.

## 9. UI (garis besar)

- **Chat: tidak ada kontrol baru.** Ketik bahasa Jepang, dijawab bahasa Jepang.
- **Ringkasan: pemilih bahasa** di kartu Ringkasan, default = bahasa terdeteksi. Artinya perilaku
  hari ini tidak berubah bagi yang tidak memakainya.
- **Transkrip: pemilih `Asli` + bahasa yang sudah diterjemahkan**, plus "Terjemahkan ke…" untuk
  yang belum. Yang belum ada **harus terlihat belum ada** — jangan memuat diam-diam saat dipilih.
- **Progres terjemahan** memakai `ProgressBar` yang sudah ada, sepola unduhan.
- **Sitasi tetap menunjuk waktu asli** apa pun bahasanya (§1, §3).

## 10. Alternatif yang ditimbang

- **`task="translate"` bawaan Whisper** — ditolak sebagai jalur utama: ia **hanya bisa ke bahasa
  Inggris**, itu batasan modelnya dan bukan sesuatu yang bisa diakali lewat parameter. Untuk
  "bahasa B, C, D" ia tidak menjawab kebutuhan. Ia juga bekerja di atas audio, sehingga menuntut
  ASR diulang — sementara arah fitur ini justru bekerja di atas teks yang sudah jadi.
- **Model MT khusus (NLLB-200, M2M100)** — ditunda, bukan ditolak. Lebih murah dan bisa lokal,
  tapi menambah dependency + unduhan model baru, sedangkan seam `analysis/` sudah ada dan sudah
  terbukti dipakai dua fitur. Layak ditinjau bila biaya terjemahan jadi masalah nyata.
- **Menerjemahkan otomatis begitu transkrip selesai** — ditolak: mahal, dan kebanyakan rekaman
  tidak akan pernah dibaca dalam bahasa lain. Terjemahan harus diminta.
- **Menyimpan ringkasan per bahasa** — ditolak (§6).

## 11. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| **Segmen bergeser senyap** karena model menggabungkan baris | Verifikasi indeks per blok; ulang dengan blok lebih kecil; fallback per-segmen (§4) |
| Sitasi `[mm:ss]` diubah model jadi format lokal (`[5分25秒]`) | Prompt menegaskan format wajib apa adanya; regex `CitedText` sengaja ketat sehingga kegagalannya terlihat, bukan senyap |
| Biaya membengkak (tiap bahasa = satu transkrip penuh) | Job berlatar + simpan hasilnya; jangan pernah menerjemahkan otomatis |
| Kualitas buruk untuk bahasa yang jarang | Daftar bahasa dibatasi yang memang ditangani baik LLM umum — jangan tawarkan semua kode ISO |
| Nama orang & istilah teknis ikut diterjemahkan | Instruksi prompt: pertahankan nama diri dan istilah teknis apa adanya |
| Rekaman campur dua bahasa (Indonesia-Inggris) | Lazim di rapat nyata; sebutkan bahasa sumber ke model, jangan andalkan tebakannya |
| Rekaman `auto` tak diketahui bahasanya | Fase 0 lebih dulu — itu sebabnya ia nomor satu |

## 12. Sumber

Seam AI internal: [ADR 0007](../adr/0007-mesin-ai-dipilih-dari-ui.md) ·
pola map-reduce & anti-pemotongan-senyap: [ADR 0009](../adr/0009-ringkasan-transkrip.md) ·
sitasi menit yang bisa diklik: [ADR 0010](../adr/0010-chat-transkrip.md) ·
batasan `task=translate`: [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
