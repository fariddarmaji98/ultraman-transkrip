# ADR 0006 — Workspace 3 kolom + panel yang bisa digeser

- Status: accepted
- Tanggal: 2026-07-21
- Terkait: [ADR 0003](0003-modular-monolith-not-microservices.md), [ADR 0004](0004-dark-ui-colibri.md), [docs/architecture/ui.md](../architecture/ui.md), [colibri-direction.md](../planning/colibri-direction.md)

## Konteks

Setelah redesign gelap (ADR 0004), halaman detail rekaman memakai satu kolom `max-w-3xl` di tengah
area utama. Di layar lebar, ruang di kanan video menganggur — persis "bagian yang bolong" yang
ingin dihindari user.

Dua permintaan user berurutan:

1. Sidebar 340px yang mati bikin isinya terpotong (teks "Lokal · mesin" dan kartu statistik
   terpangkas scrollbar) → minta sidebar bisa digeser.
2. Saat detail muncul, bagi jadi **3 section**: kiri sidebar (tetap), **tengah untuk ringkasan +
   chat AI**, kanan untuk preview video + transkrip yang sudah ada.

Permintaan kedua sejalan dengan Fase I di [colibri-direction.md](../planning/colibri-direction.md)
(ringkasan + action item = M2, chat-with-transcript + sitasi = M3). Bedanya: backend-nya **belum ada**.

## Keputusan

**Halaman detail jadi workspace 3 kolom, dengan pembatas yang bisa digeser dan kolom tengah
disiapkan — tapi dikunci — untuk AI.**

1. **Header membentang penuh.** `TranscriptHeader` (judul editable, Ekspor, tutup) tetap satu baris
   di atas kedua kolom; ia milik dokumen, bukan milik salah satu kolom.
2. **Kolom tengah = `AiPanel`** (`flex-1`): kartu Ringkasan + area chat + input chat.
3. **Kolom kanan = `SourcePanel`** (lebar tetap, bisa digeser): player + progress + `SegmentList`,
   dengan scroll sendiri.
4. **Kontrol AI `disabled`, bukan diisi contoh.** Tombol "Buat ringkasan" dan input chat mati,
   dengan badge "belum aktif" dan `title` yang menyebut endpoint yang kurang.
5. **Lebar panel lewat satu hook**: `hooks/usePanelWidth.js` menerima
   `{key, min, max, initial, handleSide}`; `ResizeHandle` jadi komponen bersama. Sidebar
   280–560 (default 340), kolom kanan 360–900 (default 560). Lebar disimpan di `localStorage`.
6. **Interaksi geser**: pointer capture + selisih dari titik grab (tanpa lompatan), klik ganda =
   reset, panah kiri/kanan = geser via keyboard (Shift = langkah besar).

## Alternatif yang ditimbang

- **Isi kolom AI dengan ringkasan contoh** — **ditolak tegas**. Saat testing, hasil palsu gampang
  tertukar dengan hasil nyata. Panel yang jujur mati lebih murah daripada bug kepercayaan.
- **Tunda kolom tengah sampai M2 selesai** — ditolak; user minta layoutnya sekarang, dan mengunci
  rangkanya lebih dulu bikin pekerjaan M2 tinggal mengganti `disabled` dengan panggilan API.
- **Tab (Transkrip / Ringkasan / Chat)** ketimbang kolom berdampingan — ditolak; nilai utama chat
  justru saat transkrip sumbernya kelihatan bersamaan (sitasi menit di M3).
- **AI sebagai drawer/modal** — ditolak; chat adalah kerja berkelanjutan, bukan interupsi.
- **Proporsi tetap (50/50 atau grid `1fr 1fr`)** — ditolak; kebutuhan lebar video vs chat beda-beda
  per orang dan per rekaman.
- **Simpan lebar panel di backend (per user)** — ditunda sampai ada auth/multi-user;
  `localStorage` sudah tepat untuk preferensi per-perangkat.

## Konsekuensi

- **Video jadi lebih sempit** (≈509px di layar 1440px) karena berbagi ruang dengan kolom AI.
  Mitigasinya: pembatas bisa ditarik sampai 900px.
- **`main` tidak lagi men-scroll.** Tiap kolom punya scroll sendiri; `App` jadi
  `flex min-w-0 flex-1 overflow-hidden` dan `EmptyState` perlu `flex-1`.
- **`useSidebarWidth` dihapus**, digantikan `usePanelWidth` yang dipakai dua panel. Menambah panel
  geser ketiga = satu objek config, bukan hook baru.
- **Dua kunci `localStorage`**: `sidebar-width`, `source-width`. Nilai di luar batas otomatis
  di-clamp saat dibaca, jadi aman kalau batasnya diubah nanti.
- **Utang yang disengaja**: `AiPanel` tidak punya state, tidak memanggil API, dan tidak diuji
  perilakunya — memang belum ada perilaku. Saat M2/M3 dikerjakan, ADR ini perlu ditinjau ulang
  (terutama soal streaming jawaban dan sitasi yang menyorot segmen di kolom kanan).

## Amandemen (2026-07-22) — kolom tengah dibagi tab Ringkasan / Chat

Setelah M2 dan M3 benar-benar terisi, keputusan no. 2 ("kartu Ringkasan + area chat + input chat"
menumpuk dalam satu kolom) terbukti tidak dipakai: ringkasan yang sudah jadi memakan hampir seluruh
tinggi kolom, dan chat cuma kebagian sisa di bawahnya — cukup untuk dua-tiga baris. Sitasinya
kelihatan, isinya tidak.

Yang berubah:

1. **`AiPanel` jadi dua tab** — `Ringkasan` dan `Chat` — masing-masing dapat tinggi penuh kolom
   (terukur 768 dari 806 px; sisanya baris tab). Baris tab menggantikan label "ASISTEN AI", jadi
   tidak ada tinggi yang bertambah.
2. **Ini bukan pembatalan alternatif "Tab" di atas.** Yang ditolak dulu adalah men-tab-kan
   *transkrip* — dan itu tetap ditolak: kolom kanan tetap terlihat terus-menerus, justru supaya
   sitasi menit bisa dicocokkan sambil membaca jawaban. Yang di-tab di sini cuma dua isi kolom
   tengah, yang memang tidak pernah perlu dibaca bersamaan.
3. **Tab non-aktif disembunyikan (`display:none`), bukan dilepas dari DOM.** Kalau dilepas, pindah
   tab saat jawaban sedang ditunggu akan membuang state-nya: `ChatPanel` hanya memuat pesan saat
   mount, tidak ada polling, jadi jawabannya baru muncul setelah reload. Diuji: kirim pertanyaan →
   pindah ke Ringkasan → balasan tetap masuk (badge tab jadi 8) dan utuh saat kembali.
4. **Badge jumlah pesan di tab Chat**, sepola tab sidebar — supaya percakapan yang sedang berjalan
   tidak tak terlihat dari tab sebelah.
5. **Baris "CHAT" di dalam panel dihapus** karena judulnya sudah ada di tab. Barisnya dipakai ulang
   untuk yang belum kelihatan di mana pun: **model yang menjawab** (sepola kartu Ringkasan) +
   tombol Bersihkan; percakapan kosong = barisnya tidak dirender sama sekali.
6. **`TabBar` diekstrak** dari `SidebarTabs` dan dipakai keduanya. Menyalin komponen tab kedua akan
   membuat dua baris tab yang pelan-pelan beda rupa.

Konsekuensi: satu kunci `localStorage` baru (`ai-tab`), dan kedua tab kini selalu ter-mount saat
detail dibuka — `ChatPanel` tetap memanggil `GET /chat` sekali per rekaman walau tabnya tidak dibuka.

## Amandemen (2026-07-22) — player menempel + sitasi ikut menggulirkan transkrip

Dua permintaan yang sebenarnya satu tema: **jawaban chat dan videonya harus bisa dipakai bersamaan.**

1. **Player `sticky top-0`** di kolom kanan. Sebelumnya ia tergulir hilang begitu transkrip dibaca —
   padahal seluruh alasan kolom kanan ada adalah supaya sumbernya kelihatan.
   Jebakan CSS yang sempat lolos ke layar: kotak `sticky` **tidak boleh keluar dari content box
   induknya**, jadi `py-5` induk menyisakan celah 20 px di atas player tempat teks yang lewat
   mengintip. Padding atas dipindah ke pembungkus player (dan dikembalikan ke induk saat tidak ada
   player, mis. media sudah kena retensi).
2. **`seek(ms)` jadi satu pintu** untuk semua lompatan waktu — klik segmen maupun klik sitasi
   `[mm:ss]` di chat: geser player **dan** gulirkan transkrip ke segmen itu.
   - **Diam bila segmennya sudah terlihat**, supaya klik pada segmen yang ada di layar tidak
     menggeser bacaan orang.
   - Keterlihatan **dan** titik tengahnya dihitung dari **bawah player yang menempel**, bukan tepi
     atas scrollport — segmen yang tertutup player belum benar-benar terlihat. Karena itu pusatnya
     dihitung sendiri, bukan `scrollIntoView({block:'center'})` yang memusatkan ke seluruh
     scrollport termasuk bagian yang tertutup.
   - Waktu sitasi dicocokkan lewat `nearestSegment` (segmen pertama yang berakhir setelah waktu itu),
     bukan pencocokan persis — model membulatkan detik dan ada jeda hening antar segmen.
   - **Tidak memanggil `play()`.** Klik menit memindahkan posisi, bukan mengubah status: yang sedang
     main tetap main, yang jeda tetap jeda. Sebelumnya klik sitasi langsung menyalakan suara ke
     orang yang sedang membaca jawaban.
   - **Sorotan segmen diset langsung saat melompat**, tidak menunggu `timeupdate` — sitasi bisa
     jatuh di jeda hening, dan `currentSegment` mengembalikan -1 di situ. Sekaligus `onTime`
     sekarang mengabaikan -1 dan mempertahankan sorotan terakhir, jadi sorotannya tidak
     padam-nyala tiap kali pembicara berhenti sejenak.
3. **Tidak ada auto-scroll saat pemutaran biasa.** Sempat terpikir mengikuti `timeupdate`, ditolak:
   itu akan merebut gulungan dari orang yang sedang membaca bagian lain sambil mendengarkan.
   Hanya lompatan eksplisit yang menggulirkan.
4. **Bonus perbaikan**: `seek` dulu langsung menyentuh `mediaRef.current` — pada rekaman yang
   medianya sudah kena retensi (transkrip tetap ada, player tidak dirender), klik segmen melempar
   `TypeError` dan merobohkan halaman. Sekarang player-nya opsional; transkrip tetap bergulir.

### Gulirannya dianimasikan sendiri, bukan `behavior: 'smooth'`

`scrollIntoView({behavior:'smooth'})` sudah dipakai lebih dulu dan **tidak menganimasikan apa pun**.
Sebabnya terukur, bukan tebakan: lingkungan menyalakan `prefers-reduced-motion: reduce`, dan Blink
menurunkan smooth-scroll jadi lompatan seketika — sampel pertama sudah langsung di posisi akhir.
Karena permintaannya eksplisit, animasinya dijalankan sendiri lewat `requestAnimationFrame`
(ease-out kubik, 420 ms) sehingga tidak bergantung pada flag itu.

Konsekuensi yang harus dijaga, dan ini yang bikin kodenya bukan lima baris:

- **rAF bisa mati di tengah jalan.** Panel pratinjau yang dipakai untuk menguji melukis saat perlu —
  terukur **1 frame per ~1,7 detik**. Animasi yang berhenti di tengah akan meninggalkan transkrip
  ter-gulir separuh. Karena itu ada `setTimeout` penjaga yang memastikan tujuannya tetap tercapai
  walau mulusnya hilang. Di lingkungan seperti itu efek mulus memang **tidak akan terlihat** —
  bukan karena kodenya, melainkan karena tidak ada frame yang dilukis.
- **Klik beruntun**: tujuan terakhir disimpan di modul; animasi lama berhenti sendiri dan penjaganya
  tidak ikut menarik balik ke tujuan yang sudah basi.

### Yang diuji

| Uji | Hasil |
|---|---|
| Klik `[04:16]` saat player jeda | Player **tetap jeda**, posisi tepat detik 256 |
| Klik saat player sedang main | **Tetap main** — status tidak diubah, cuma posisinya |
| Guliran transkrip | `scrollTop` 0 → 6846, berhenti 264 px di bawah player dan 263 px di atas dasar — persis di tengah ruang yang terlihat |
| Sorotan segmen | `04:16 Pasar menyambutnya dengan positif` menyala walau player jeda |
| Klik segmen yang sudah di layar | `scrollTop` tidak bergeser sama sekali |
| Dua sitasi diklik beruntun | Yang terakhir menang (detik 256, scroll 6846) — tidak tarik-menarik |
