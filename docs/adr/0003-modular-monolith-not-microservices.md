# ADR 0003 — Modular Monolith, Bukan Microservices (arah conversation-intelligence)

- Status: accepted
- Tanggal: 2026-07-19
- Terkait: [ADR 0002](0002-pivot-webapp-upload-transkrip.md), [planning arah Colibri](../planning/colibri-direction.md)

## Konteks

User ingin mengembangkan repo ini menjadi produk seperti [colibri.ai](https://colibri.ai/) —
AI meeting assistant: rekam + transkrip **live** saat meeting, ringkasan + action item, library
call yang bisa dicari, conversation intelligence (analitik, coaching), integrasi Zoom/Slack/CRM.

Pertanyaan yang diajukan: **gabung di repo ini (monolith) atau bikin repo baru dan panggil
transkripsi sebagai microservice via API internal?**

## Keputusan

**Modular monolith di repo ini.** Transkripsi tetap **modul internal** yang dipanggil lewat fungsi
in-process (bukan service HTTP terpisah). Produk conversation-intelligence tumbuh sebagai
modul-modul baru di atas core yang sama, dalam satu repo & satu deployable.

**Extract sebuah modul menjadi service terpisah hanya bila ada pemicu nyata** (lihat di bawah) —
bukan dari awal.

## Alasan

1. **Solo dev.** Microservice sejak awal = dua kali beban operasional (deploy ganda, versioning,
   auth antar-service, panggilan network, debug terdistribusi). Hasil paling umum: *distributed
   monolith* — rugi dua-duanya.
2. **Seam sudah bersih.** Core transkripsi sudah modular (`asr/` di balik interface `ASRProvider`,
   model job/segments, `media/`, `worker/`). Boundary rapi → extract nanti murah bila perlu.
3. **Roadmap sudah menuju sana.** Rencana M2 (ringkasan) + M3 (chat/search "second brain") sangat
   overlap dengan Colibri. Menggabungkan = natural, bukan dipaksakan.
4. **In-process > HTTP internal.** Panggilan fungsi langsung lebih cepat, tanpa perlu membuat &
   menjaga kontrak API antar dua proyek sendiri, tanpa menangani kegagalan network buatan sendiri.
5. **Real-time toh pipeline baru.** Bagian tersulit Colibri (transkrip live) adalah pekerjaan baru
   apa pun struktur reponya — memisah repo tidak menghematnya.

## Pemicu untuk extract ke service terpisah (nanti)

- Muncul **consumer kedua yang independen** dari core transkripsi.
- Transkripsi perlu **di-scale di mesin GPU** terpisah dari web app.
- Ada **batas tim** (beberapa orang memiliki area berbeda).

## Konsekuensi

- Repo tumbuh jadi multi-modul → perlu disiplin menjaga batas antar-modul (modul saling panggil
  lewat interface, bukan reach-in ke internal). Struktur target di planning.
- **Auth + multi-tenancy jadi wajib** (produk meeting = data banyak user/org).
- **Real-time capture** jadi milestone besar tersendiri (streaming ASR + WebSocket + sumber audio).
  Menariknya, rencana chrome-extension lama (tangkap audio tab Zoom/Meet) yang sempat ditinggalkan
  di ADR 0002 **relevan lagi** di sini sebagai salah satu metode capture.
- Bila kelak jadi produk komersial dengan brand terpisah: tetap lebih disarankan **monorepo
  multi-app dengan transkripsi sebagai package bersama** ketimbang dua repo yang dikopel HTTP,
  sampai salah satu pemicu di atas muncul.
- Merekam meeting terikat consent/hukum — jadi kewajiban produk, bukan sekadar catatan (lihat planning §9).
