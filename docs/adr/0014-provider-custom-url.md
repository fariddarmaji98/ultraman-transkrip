# ADR 0014 — Provider LLM Custom URL + daftar model dari provider

- Status: accepted
- Tanggal: 2026-09-14
- Terkait: [ADR 0007](0007-mesin-ai-dipilih-dari-ui.md), [ADR 0011](0011-bahasa-keluaran-ai.md)
- Rencana: — (perbaikan pada jalur `analysis/` yang sudah ada)

## Konteks

Katalog provider di [ADR 0007](0007-mesin-ai-dipilih-dari-ui.md) menutup lima nama tetap:
Ollama, Groq, DeepSeek, Claude, OpenAI. Pengguna kini banyak berlangganan **API proxy
OpenAI-compatible** (satu base URL, puluhan model dari banyak vendor di belakangnya) — pola
yang tidak muat ke katalog: menambah tiap proxy sebagai entri katalog berarti merilis kode
untuk setiap layanan langganan baru.

Dua masalah menyertainya: nama model di proxy **tidak bisa ditebak** (glm-5.3, kimi-k3,
deepseek-v4-…), dan pengguna tidak tahu model mana yang berkemampuan apa atau masih ada stok —
informasi yang justru dilaporkan proxy lewat `GET /v1/models`.

## Keputusan

1. **Provider `custom` sebagai entri katalog dengan base_url kosong.** URL, kunci, dan model
   diisi dari UI dan disimpan di `runtime.json` (`llm.custom_base_url`) — env
   `TRANSKRIP_LLM_BASE_URL` tetap menang sebagai escape hatch. Menambah proxy baru = mengetik
   URL, bukan menunggu rilis.

2. **`OpenAICompatProvider.list_models()` memanggil `GET {base_url}/models` dan menormalkan
   balikannya.** Konvensi OpenAI-compatible: `data[].id`. Ekstensi non-standar yang dilaporkan
   proxy ikut diangkat bila ada — `grade`, `vision`/`modalities.input`, `text` — dan diabaikan
   bila tidak (OpenAI/Groq/Ollama tetap jalan). Provider yang membalik list of strings
   (bukan objek) juga ditangani.

3. **Model dengan `enabled: false` dibuang dari daftar.** Stok habis = tidak ditawarkan;
   field itu hanya ada pada proxy, jadi provider polos tidak kehilangan apa pun. Sebelumnya
   habis hanya dijegal ke akhir daftar — menghapusnya lebih jujur: pilihan yang tidak bisa
   dipakai bukan pilihan.

4. **Untuk provider custom, field model adalah dropdown yang WAJIB dimuat dulu; freetext
   di-disable.** Nama model proxy tidak bisa ditebak, dan salah ketik baru terasa saat
   ringkasan dijalankan (kegagalan senyap di saat terburuk). Provider bawaan tetap boleh
   diketik: default katalognya dijamin valid, memuat daftar di sana adalah bantuan, bukan
   syarat.

5. **Kemampuan model ditampilkan di label dropdown** (`glm-5.3 · A · text, vision`), cermin
   katalog web proxy. `text` diambil dari `modalities.input` — tanpa itu, model text-only
   tampil cuma `· A` dan pengguna tak tahu apakah itu teks-saja atau data tak lengkap.

6. **`POST /api/llm/models` memakai isian form apa adanya, tidak menyimpan apa pun.** Panggilan
   daftar adalah operasi baca; menumpangnya ke PATCH akan menyimpan setelan yang mungkin masih
   sedang diedit. Gagal = `200 {ok: false, detail}` — popup tetap terbuka dan menampilkan
   alasannya, bukan error HTTP yang menutup alur.

## Alternatif yang ditimbang

- **Menambah tiap proxy populer sebagai entri katalog** — ditolak; tidak beresaldo: daftar
  tidak akan pernah lengkap dan tiap entri baru menunggu rilis.
- **Habis stok ditampilkan dengan tag `habis`** — ditolak setelah dicoba; membebani daftar
  dengan pilihan yang pasti gagal. Bila proxy kelak menambah stok, muat ulang daftar
  menyingkapnya.
- **Freetext tetap aktif untuk custom** — ditolak; lihat keputusan 4. Satu-satunya pembenaran
  freetext adalah provider yang TIDAK punya `/models` — itu provider bawaan, yang memang
  dibiarkan bebas diketik.
- **Dropdown native `<select>` dengan opsi terkaya** — dipakai apa adanya; komponen custom
  (listbox dengan tag berwarna) menunda untuk UI polish, bukan kebutuhan fungsional.

## Konsekuensi

- **Proxy tanpa `/models` tidak bisa dipakai lewat provider custom.** Batas ini disadari dan
  diterima: proxy OpenAI-compatible tanpa endpoint models itu langka, dan provider bawaan
  tetap menutup kebutuhan "tanpa daftar".
- **`GET /models` dipanggil on-demand tiap klik "Muat daftar model"** — tidak di-cache; stok
  dan daftar proxy berubah cepat, cache justru sumber keputusan basi.
- **`custom_base_url` disimpan plaintext di `runtime.json`** bersama kunci — perlakuan yang
  sama dengan kunci provider lain (README sudah memperingatkan; deployment sungguhan pakai env).
- **Model tersimpan bisa menguap dari daftar** (stok habis / diganti proxy). Muat ulang
  men-drop nilai yang tidak ada lagi; ringkasan yang sudah tersimpan tidak terpengaruh —
  teksnya tidak bergantung pada model masih hidup atau tidak.
- **Balikan `list_models()` berubah bentuk** (list[str] → list[dict]) — hanya dipakai route
  `/llm/models` yang lahir bersamaannya, tidak ada pemanggil lain.
