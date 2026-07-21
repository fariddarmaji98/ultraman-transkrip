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
