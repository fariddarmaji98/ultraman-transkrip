# ADR 0004 — UI Gelap ala Colibri (tema tunggal + layout padat)

- Status: accepted
- Tanggal: 2026-07-19
- Terkait: [ADR 0002](0002-pivot-webapp-upload-transkrip.md), [docs/architecture/ui.md](../architecture/ui.md)

## Konteks

Permintaan user: redesign FE agar mirip [colibri.ai](https://colibri.ai/) — "aku suka UI yang
gelap dan tidak banyak bagian yang bolong (kosong)". UI awal bertema terang (indigo di atas putih)
dengan area konten besar yang sering kosong (empty state hollow).

## Keputusan

**Adopsi tema gelap tunggal + layout padat**, tanpa mode terang untuk sekarang.

1. **Tema via Tailwind v4 `@theme`** di `frontend/web/src/index.css` — token warna kustom
   (`canvas`, `panel`, `panel2`, `edge`, `edge2`, `fg`, `fg2`, `fg3`, `mint`, `mint2`), bukan palet
   default Tailwind. Aksen = mint/emerald `#34d399` di atas near-black `#080c0a`. Peta token di
   [docs/architecture/ui.md](../architecture/ui.md).
2. **Layout full-screen split**: `Sidebar` (340px) + area utama. Sidebar **diisi padat** (brand,
   upload, panel Engine, grid statistik, riwayat) supaya tidak ada bagian "bolong".
3. **Panel Engine butuh data server** → tambah endpoint `GET /api/config` (provider, model, batas
   upload). Statistik dihitung di FE dari daftar riwayat.
4. `color-scheme: dark` + background gelap di `index.html` (anti-flash).

## Alternatif yang ditimbang

- **Pertahankan tema terang indigo** — ditolak, user eksplisit minta gelap.
- **Dukung light + dark mode** — ditunda; menambah kompleksitas (dua set token, toggle) untuk nilai
  kecil saat ini. Token `@theme` memudahkan menambah mode terang nanti bila perlu.
- **Pakai component library (mis. shadcn/Radix)** — ditolak untuk sekarang; komponen custom kecil
  sudah cukup, tetap ringan & sesuai aturan repo (1 fungsi ≤ 20 baris).

## Konsekuensi

- **Tema tunggal (gelap).** Semua komponen di-restyle; tidak ada mode terang. Menambah mode terang =
  tambah override token, bukan rewrite.
- **Token warna kustom**, bukan util palet Tailwind (`slate`/`indigo`). Warna semantik tetap pakai
  util bawaan (`red-400`, `amber-400`) untuk status.
- **Backend nambah `GET /api/config`** — kontrak read-only, dipakai FE untuk panel Engine.
- **Komponen baru**: `Sidebar`, `EmptyState`. Layout `App` berubah dari grid ke flex full-screen.
- Redesign ini murni lapisan tampilan — tidak mengubah kontrak data transkrip, alur job, atau
  arah arsitektur (ADR 0002/0003 tetap).
