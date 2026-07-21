# Arsitektur — UI Frontend (tema gelap + layout)

Peta design system & struktur komponen FE (`frontend/web/`, React 19 + Vite + Tailwind v4).
Keputusan & alasan tema gelap di [docs/adr/0004-dark-ui-colibri.md](../adr/0004-dark-ui-colibri.md).

## Prinsip

1. **Tema tunggal gelap.** Aksen mint/emerald di atas near-black. Tidak ada mode terang (belum).
2. **Token warna terpusat.** Semua warna dasar via `@theme` di `src/index.css` — komponen pakai
   util yang di-generate (`bg-panel`, `text-fg`, `text-mint`, …), bukan hex tersebar.
3. **Padat, bukan bolong.** Sidebar diisi info berguna (engine, statistik) daripada ruang kosong.
4. **Komponen kecil.** 1 fungsi/komponen ≤ 20 baris; ikon = SVG inline (tanpa lib ikon).

## Token warna (`src/index.css` → `@theme`)

| Token | Hex | Util | Peran |
|---|---|---|---|
| `--color-canvas` | `#080c0a` | `bg-canvas` | background halaman |
| `--color-panel` | `#0c1210` | `bg-panel` | sidebar / top bar |
| `--color-panel2` | `#111815` | `bg-panel2` | kartu (upload, engine, stat, item) |
| `--color-edge` | `#1b2621` | `border-edge` | garis/hairline default |
| `--color-edge2` | `#26332c` | `border-edge2` | garis hover / lebih tegas |
| `--color-fg` | `#e7efe9` | `text-fg` | teks utama |
| `--color-fg2` | `#9db0a6` | `text-fg2` | teks pendukung |
| `--color-fg3` | `#63756c` | `text-fg3` | label/hint redup |
| `--color-mint` | `#34d399` | `text-mint` / `bg-mint` | aksen utama (aktif, selesai, tombol) |
| `--color-mint2` | `#6ee7b7` | `bg-mint2` | aksen hover |

Warna semantik status tetap pakai util Tailwind bawaan: `amber-400` (antre/ekstrak),
`red-400`/`red-500` (gagal/hapus). `color-scheme: dark` diset agar kontrol native (select,
scrollbar) ikut gelap; `index.html` set background gelap anti-flash.

## Layout

```
App (flex h-screen)
├─ Sidebar (lebar bisa digeser 280–560px, default 340; bg-panel)  ── selalu tampil
│   ├─ ResizeHandle (hairline mint di tepi kanan; klik ganda = reset)
│   ├─ Brand (logo mint + nama + tagline)
│   ├─ UploadPanel (file, bahasa, tombol Transkrip, progress upload)
│   ├─ EnginePanel (provider + ModelPicker dari /api/config + status engine)
│   ├─ StatsGrid (Selesai / Diproses / Gagal / Total — dihitung dari riwayat)
│   └─ RecordingList (Riwayat: item + StatusBadge ikon + tanggal·durasi + hapus)
└─ main (flex-1)
    ├─ TranscriptView (bila ada rekaman dipilih) — bersama sidebar = 3 kolom
    │   ├─ TranscriptHeader (membentang penuh: judul editable + Ekspor + tutup)
    │   ├─ AiPanel (KOLOM TENGAH, flex-1) — ringkasan + chat; terkunci s/d M2/M3
    │   └─ SourcePanel (KOLOM KANAN, 360–900px, default 560; scroll sendiri)
    │       ├─ ResizeHandle (tepi kiri)
    │       ├─ MediaPlayer (video/audio dari /source)
    │       ├─ ProgressSteps + ProgressBar (saat status pending)
    │       └─ SegmentList (transkrip; klik segmen → seek player)
    └─ EmptyState (bila tak ada dipilih: ikon + info, bukan kotak kosong)
```

## Peta komponen (`src/components/`)

| Komponen | Tugas |
|---|---|
| `Sidebar` | rangka sidebar + sub-komponen Brand/EnginePanel/StatsGrid |
| `ModelPicker` | dropdown model lokal (`PATCH /api/config`); terkunci saat engine sibuk |
| `ResizeHandle` | batang geser lebar panel (dipakai sidebar & kolom kanan); induk wajib `relative` |
| `AiPanel` | kolom tengah: kartu Ringkasan + chat. Kontrol sengaja `disabled` selama backend M2/M3 belum ada — jangan tampilkan hasil palsu |
| `UploadPanel` | pilih file + bahasa, unggah (XHR + progress), panggil `onUploaded` |
| `RecordingList` | daftar riwayat + `ConfirmModal` hapus |
| `StatusBadge` | status → ikon (jam/spinner/centang/peringatan) + tooltip |
| `TranscriptView` | poll detail rekaman, susun header + player + progress + transkrip |
| `TranscriptHeader` | top bar: judul editable (`PATCH`), ekspor, tombol tutup |
| `SegmentList` | render segmen + highlight aktif + seek |
| `ProgressSteps` | stepper tahap (Antre→Ekstrak→Transkrip→Selesai) |
| `ConfirmModal` | dialog konfirmasi (hapus) |
| `EmptyState` | placeholder area utama saat kosong |

Data ke FE: `GET /api/config` (provider, model, batas upload) untuk EnginePanel; sisanya lewat
`GET /api/recordings` (+ detail/job) seperti biasa. Statistik dihitung di FE, tidak ada endpoint stats.

## Menambah / mengubah

- **Ubah warna tema**: edit token di `@theme` (`index.css`) → seluruh util ikut. Jangan hardcode hex di komponen.
- **Tambah mode terang** (nanti): tambah override token di `:root[data-theme=light]` / media query + toggle; komponen tak berubah karena pakai util token.
- **Tambah info sidebar**: bikin sub-komponen di `Sidebar.jsx` (pola `EnginePanel`/`StatsGrid`), jaga ≤ 20 baris.
- **Ubah batas lebar panel**: konstanta `WIDTH` (Sidebar) / `SOURCE_W` (TranscriptView) — `{ key, min, max, initial, handleSide }` dioper ke `hooks/usePanelWidth.js`; lebar tersimpan di `localStorage`.
- **Aktifkan AI**: ganti kontrol `disabled` di `AiPanel.jsx` begitu endpoint ringkasan/chat siap; strukturnya sudah pada tempatnya.

## Anti-pattern (jangan)

- Hardcode warna hex di komponen (pakai util token `@theme`).
- Kembalikan area utama jadi kotak kosong besar tanpa isi (isi dengan info/aksi).
- Impor library ikon berat untuk beberapa glyph (cukup SVG inline).
