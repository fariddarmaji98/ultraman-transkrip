# ADR 0013 — Ekstraksi terstruktur transkrip (transcript as context)

- Status: accepted
- Tanggal: 2026-09-14
- Terkait: [ADR 0009](0009-ringkasan-transkrip.md), [ADR 0010](0010-chat-transkrip.md), [ADR 0011](0011-bahasa-keluaran-ai.md)
- Rencana: [transcript-as-context](../planning/transcript-as-context.md) (Fase 1)

## Konteks

Ringkasan (ADR 0009) dan chat (ADR 0010) mengubah transkrip jadi prosa yang enak dibaca manusia.
Tapi pembaca kedua konteks makin sering bukan manusia: agent coding, generator spec, atau diri
sendiri yang butuh jawaban cepat atas "apa saja keputusan dan kebutuhan dari rekaman ini?" — dan
prosa bebas-format tidak bisa menjawab itu secara andal.

Konsumsi ulang context butuh **struktur** (kategori tetap: decisions / requirements / constraints /
open_questions) dan **jejak** (sitasi ke menit rekaman). Keduanya sudah teruji terpisah di repo
ini: struktur kategori mengikuti pola heading ringkasan, sitasi menit mengikuti chat `[mm:ss]`.
ADR ini memutuskan bagaimana keduanya digabung dan disimpan.

## Keputusan

1. **Modul baru `analysis/extract.py`, bukan parameter `summarize`.** Ekstraksi dan ringkasan
   berbagi pola (map-reduce, provider via `get_llm()`, prompt Inggris + perintah bahasa di akhir)
   tapi berbeda kontrak: ringkasan mengembalikan prosa, ekstraksi mengembalikan JSON tervalidasi.
   Menjejalkan dua kontrak ke satu fungsi membuat keduanya rapuh terhadap perubahan satu sama lain.

2. **Tabel `recording_extracts`, satu baris per `(recording_id, lang)`.** Cermin pola `summaries`:
   unik per pasangan kunci, `provider` + `model` tercatat, "Buat ulang" menimpa. Bahasa jadi bagian
   kunci karena item extract berbahasa campuran istilah + narasi mengikuti bahasa keluaran yang
   diminta (pola ADR 0011) — extract Indonesia dan English dari rekaman yang sama adalah dua hasil
   berbeda, keduanya sah dan keduanya disimpan.

3. **Kolom `data` menyimpan JSON (Text), bukan tabel anak per-item.** Item extract tidak pernah
   di-query terpisah dari rekamannya (beda dengan `segments` yang dipaginasi player). Menormalkan
   empat kategori × N item jadi tabel anak menambah migrasi & join tanpa satu pun pemakai. Schema
   divalidasi pydantic di batas I/O (saat tulis hasil LLM & saat kirim ke klien), bukan di DB.

4. **`at_ms` integer milidetik, bukan string `[mm:ss]`.** Konsisten dengan `segments.start_ms`.
   String `[mm:ss]` hanya bentuk render (UI & ekspor). Milidetik bisa diurutkan, dibandingkan, dan
   digabung Fase 2 (brief lintas-rekaman) tanpa parsing balik — parsing balik string adalah sumber
   bug off-by-one yang persis ingin dihindari.

5. **Balikan LLM diverifikasi ketat, kegagalan tidak senyap.** JSON diparse dan divalidasi schema
   (kategori lengkap, `at_ms` integer ≥ 0, teks non-kosong); kategori hilang di-backfill `[]`
   (jawaban sah), tapi item rusak → `LLMError` yang sampai ke user. Ini pelajaran terjemahan
   (ADR 0011): model gemar menyimpang diam-diam, dan konteks yang dipakai agent memperparah
   dampaknya — satu requirement mengarang lebih mahal daripada satu ringkasan jelek.

6. **Transkrip panjang: map per potongan, reduce TANPA LLM.** Berbeda dari ringkasan (prosa harus
   digabung ulang oleh LLM), item extract bisa di-union secara mekanis: gabungkan array per
   kategori, urutkan per `at_ms`. Tidak ada panggilan "merge" kedua — lebih murah, dan lebih
   deterministik: LLM hanya melihat potongan, Python yang punya kata akhir atas urutan.

7. **Sitasi dipercayakan pada timestamp segmen, bukan dihitung ulang.** Prompt meminta model
   menyalin `at_ms` dari baris transkrip bergaya `[mm:ss]` yang diberikan; Python memverifikasi
   nilai wajar (0 ≤ at_ms ≤ durasi) tapi tidak mencocokkan kata-per-kata ke segmen — biayanya
   mahal dan manfaatnya kecil dibanding validasi rentang.

8. **Ekstraksi eksplisit lewat tombol, tidak otomatis pasca-transkrip.** Sama seperti unduhan
   video (ADR 0008): tindakan berbiaya LLM adalah keputusan user. Antrean worker tidak tersentuh —
   endpoint `POST /recordings/{id}/extract` menunggu hasilnya sinkron seperti ringkasan.

## Alternatif yang ditimbang

- **Memakai ringkasan existing sebagai sumber extract (dua tahap)** — ditolak. Ringkasan sudah
  kehilangan timestamp; extract dari prosa = sitasi mengarang. Sumbernya harus transkrip asli
  (pola ADR 0011 keputusan 4).
- **Satu panggilan LLM untuk ringkasan + extract sekaligus** — ditolak. Satu prompt dua tugas
  menurunkan keduanya; ringkasan condong jadi daftar butir, extract condong jadi prosa. Biaya
  panggilan terpisah adalah harga yang murah untuk kontrak yang bersih.
- **Tabel anak `extract_items` (normalized)** — ditolak; lihat keputusan 3.
- **`at_ms` opsional** — ditolak. Item tanpa jejak menit tidak bisa diaudit dan merusak janji
  inti fitur ini; model yang tidak bisa menunjuk menit harus memilih item yang bisa.
- **Menyimpan extract sebagai file markdown** — ditolak. Markdown adalah format ekspor (via
  `export/render.py`), bukan format simpan; query "extract rekaman X bahasa Y" harus satu baris DB.

## Konsekuensi

- **Skema extract dikunci pydantic, evolusi = migrasi sadar.** Menambah kategori kelima (mis.
  `risks`) berarti menyentuh schema + prompt + UI + ekspor — disengaja, supaya kategori tidak
  bertambah dadakan tanpa keputusan.
- **Balikan LLM menyimpang = ekstraksi gagal total untuk rekaman itu** (bukan sebagian).
  Diterima: lebih baik gagal keras dengan pesan jelas daripada context setengah benar yang
  dipercaya agent. Tombol "Buat ulang" adalah pemulihannya.
- **`create_all` tidak mengubah tabel lama** — tabel baru dibuat otomatis untuk instalasi baru;
  instalasi lama butuh migrasi `ALTER`/`CREATE TABLE` via `scripts/` (pola migrasi repo).
- **Brief lintas-rekaman (Fase 2) terikat format ini.** Perubahan skema di masa depan harus
  melewati pertimbangan "apa dampaknya ke agregasi brief".
- **Biaya LLM per bahasa** — sama seperti ringkasan (ADR 0011): tiap bahasa panggilan tersendiri,
  disimpan terpisah, dipakai ulang gratis.
