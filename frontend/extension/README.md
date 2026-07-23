# Ekstensi — Rekam Meeting

Merekam **audio tab meeting + mikrofon** lalu mengirimnya ke backend Ultraman Transkrip untuk
ditranskrip. Rencana & alasannya: [meeting-capture.md](../../docs/planning/meeting-capture.md).

**JavaScript polos — tidak ada framework, tidak ada build step** (alasan di planning §3.1).
Folder ini bisa langsung dimuat Chrome apa adanya.

## Memasang (dev)

1. Jalankan backend lebih dulu (`http://localhost:8000`).
2. Buka `chrome://extensions` → nyalakan **Developer mode**.
3. **Load unpacked** → pilih folder `frontend/extension/`.
4. Buka popup ekstensi → **Izinkan mikrofon** (sekali saja, lihat di bawah).

Setelah mengubah kode: tombol **reload** di kartu ekstensi. Tidak ada langkah build.

## Cara pakai

1. Buka meeting di tab (Google Meet, Zoom **web**, Teams).
2. Klik ikon ekstensi → opsional isi judul → **Mulai rekam**.
3. Selesai meeting → **Selesai & transkrip**. Rekamannya muncul di webapp dan langsung
   masuk antrean transkrip.

## Bagian-bagiannya

| Folder | Tugas |
|---|---|
| `popup/` | remote control: mulai/stop, timer, status izin mic. Bukan UI produk — transkrip & ringkasan ada di webapp |
| `background/` | service worker: minta izin tangkap tab, kelola offscreen, mulai/tutup sesi ke backend. **Tidak menyentuh media** |
| `offscreen/` | satu-satunya yang memegang media: tangkap tab + mic → gabung stereo → `MediaRecorder` → kirim potongan |
| `permission/` | halaman sekali-pakai untuk memunculkan prompt izin mikrofon |
| `lib/` | `config.js` (alamat backend, angka) + `api.js` (klien backend) |

## Hal yang harus diketahui sebelum menyentuh kodenya

- **Mikrofon ditangkap terpisah dari tab, dan itu wajib.** Meet/Zoom membisukan playback suara
  kita sendiri (anti-echo), jadi audio tab **tidak berisi suara kita**. Popup memperingatkan
  sebelum merekam, bukan sesudah — tahu suaramu hilang setelah meeting dua jam selesai sudah
  terlambat.
- **Prompt izin mic tidak bisa muncul di offscreen document** — ia gagal diam-diam. Karena itu
  ada `permission/`, halaman terlihat yang membuka pintunya sekali untuk seluruh ekstensi.
- **Kiri = tab, kanan = mic. Jangan pernah dicampur jadi satu kanal.** Pemisahan inilah yang
  nanti dipakai membedakan "saya" vs "peserta" (planning §4.1); begitu tercampur, hilang permanen.
- **Tab yang ditangkap akan membisu bagi user** kecuali sumbernya juga disambungkan ke
  `context.destination`. Tanpa itu, user duduk dalam sunyi sepanjang meeting sementara
  rekamannya baik-baik saja.
- **`content script` tidak mendukung `import` ES module.** Service worker, offscreen, dan popup
  mendukung. Saat adapter platform ditambahkan (Fase C), tulis sebagai satu berkas mandiri.
- **Keluaran `MediaRecorder` belum bisa langsung dipakai.** Ia WebM mode *live*: tanpa durasi di
  header dan tanpa indeks pencarian. Backend me-remux-nya (`-c copy`) saat sesi ditutup —
  jangan hapus langkah itu, tanpanya rekaman ditolak "tidak terbaca" dan player tak bisa seek.
- **Jangan mengirim pesan ke offscreen tanpa memeriksa keberadaannya.** Bila sudah ditutup,
  Chrome melempar *"Receiving end does not exist"* yang akan menutupi error yang sebenarnya.

## Batasan (nyatakan ke user, jangan digagalkan diam-diam)

- **Aplikasi desktop Zoom tidak tertangkap** — ekstensi hanya melihat tab browser. Pakai Zoom web.
- **Tab ditutup / refresh / navigasi = rekaman putus** dan izinnya harus diminta ulang.
- **Chromium saja** (Chrome/Edge/Brave). Firefox & Safari tidak punya `tabCapture`.
- **Harus dimulai dari klik** — aturan Chrome, bukan pilihan kita.
- Backend restart di tengah sesi **tidak** memutus rekaman: seluruh state sesi ada di disk + DB
  (teruji di Fase A backend).

## Belum ada di Fase A

Label siapa yang bicara (Fase B/C) dan transkrip real-time (Fase D). Sekarang: rekam → transkrip
setelah selesai.
