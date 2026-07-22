# ADR 0010 — Chat dengan transkrip (M3): sitasi menit, konteks pilih-kata

- Status: accepted
- Tanggal: 2026-07-22
- Terkait: [ADR 0006](0006-workspace-tiga-kolom.md), [ADR 0007](0007-mesin-ai-dipilih-dari-ui.md), [ADR 0009](0009-ringkasan-transkrip.md)

## Konteks

Chat adalah kontrol mati terakhir di aplikasi — semua yang lain sudah hidup. UI-nya bahkan sudah
terlanjur menjanjikan sesuatu yang spesifik sejak [ADR 0006](0006-workspace-tiga-kolom.md):
*"Jawaban akan mengutip menit sumbernya di transkrip sebelah kanan."*

Janji itu yang membedakannya dari sekadar menempel transkrip ke ChatGPT: jawabannya **tertaut ke
rekamannya**, bisa diperiksa, bisa diputar dari titik yang disebut.

Kendala yang sama dengan ringkasan muncul lagi, tapi lebih tajam: transkrip 28 menit tidak muat di
context provider kecil. Bedanya, ringkasan bisa map-reduce (semua bagian diringkas lalu digabung),
sedangkan chat butuh **bagian yang relevan dengan pertanyaan** — itu masalah retrieval, bukan
kompresi.

## Keputusan

1. **Sitasi `[mm:ss]` diwajibkan lewat prompt**, dan di FE dirender jadi tombol yang melompatkan
   player sekaligus menyorot segmen. Prompt juga melarang memakai pengetahuan luar: bila jawabannya
   tak ada di transkrip, model harus mengaku.
2. **Percakapan disimpan** di tabel `chat_messages` per rekaman, bukan hanya di state FE. Alasannya
   ini bagian dari "second brain", bukan sesi sekali pakai — pindah rekaman lalu kembali tidak boleh
   menghapus riwayat. `provider`/`model` dicatat pada balasan asisten, sepola `summaries`
   ([ADR 0009](0009-ringkasan-transkrip.md)).
3. **Pemilihan konteks pakai pencocokan kata, bukan embedding.** Transkrip dipotong per blok
   (`CHAT_BLOCK_LINES`), tiap blok diberi skor dari irisan kata pertanyaan (kata >3 huruf saja —
   "yang", "dan", "itu" tidak membedakan apa pun), blok terbaik dipilih sampai anggaran habis, lalu
   **diurutkan ulang kronologis** supaya alur bicaranya tidak teracak.
4. **Model diberitahu saat konteksnya sebagian**, sehingga ia bisa berkata "bagian itu tidak ada di
   potongan yang saya terima" alih-alih menyimpulkan dari yang kebetulan terpilih.
5. **Sitasi di luar durasi rekaman tidak bisa diklik** — dicoret di UI. Sitasi itu dihasilkan model,
   jadi bisa saja mengarang menit; melompat ke menit yang tidak ada hanya membingungkan.
6. **Sinkron**, sama seperti ringkasan. Terukur 1–2 detik per pertanyaan.

## Alternatif yang ditimbang

- **Embedding + pgvector (RAG sungguhan)** — ditunda, bukan ditolak. Butuh Postgres (yang butuh
  Docker, belum ada di mesin dev) plus model embedding dan pipeline indexing. Pencocokan kata sudah
  cukup untuk satu rekaman; ia baru benar-benar kalah saat pencarian **lintas** rekaman, dan itu
  memang fitur berikutnya, bukan yang ini.
- **Kirim seluruh transkrip tiap pertanyaan** — ditolak; berhasil di DeepSeek, gagal di Ollama, dan
  membakar token untuk bagian yang tidak relevan.
- **Chat tanpa menyimpan riwayat (stateless)** — ditolak; kehilangan percakapan tiap pindah rekaman
  membuat fitur ini terasa seperti mainan.
- **Streaming jawaban token demi token** — ditunda. Jawaban 1–2 detik tidak cukup lama untuk membuat
  streaming terasa berharga, dan `LLMProvider` sengaja disederhanakan ke `async complete()`
  ([ADR 0007](0007-mesin-ai-dipilih-dari-ui.md)).
- **Memvalidasi setiap sitasi ke segmen sungguhan** — hanya batas durasi yang dicek. Mencocokkan
  persis ke segmen akan menolak sitasi yang sebenarnya masuk akal (model membulatkan detik), jadi
  penjagaannya sengaja longgar: cukup mencegah yang jelas mustahil.

## Konsekuensi

- **Pencocokan kata bisa meleset saat pertanyaannya parafrase.** Bertanya "berapa duit yang
  dikeluarkan" pada transkrip yang menyebut "menggelontorkan dana" tidak beririsan kata sama sekali.
  Ini batas nyata yang baru hilang dengan embedding.
- **Sitasi tetap buatan model.** Yang dijamin aplikasi hanyalah: menit yang disebut ada di dalam
  durasi rekaman. Apakah ia benar-benar kalimat yang dimaksud, tetap perlu diklik untuk diperiksa —
  dan justru itu gunanya dibuat bisa diklik.
- **Tiap pertanyaan memanggil API berbayar**, dan riwayat ikut dikirim (`CHAT_HISTORY_TURNS` pesan
  terakhir), jadi percakapan panjang makin mahal per giliran.
- **Panel AI kini hidup sepenuhnya** — tidak ada lagi kontrol mati di aplikasi. Penanda "belum
  aktif" dan placeholder "(segera)" dihapus karena tidak lagi benar.
- `analysis/` sekarang berisi seam + adapter + dua pemakai (`summarize`, `chat`). Pemakai ketiga
  tinggal mengikuti pola yang sama.
