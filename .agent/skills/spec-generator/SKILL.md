---
name: spec-generator
description: |
  Gunakan saat memulai pengerjaan fitur/sumber baru pada tool transkrip ini dan butuh folder spec lengkap.
  Skill ini menanyakan detail fitur secara interaktif lalu otomatis membuat
  folder spec beserta file markdown yang relevan (rules, todo, commits, card, apicontract)
  di .agent/spec/active/[nama-fitur]/.
  Trigger: buat spec, spec fitur baru, mulai task baru, generate spec, bikin folder spec,
  tambah sumber transkrip, mau ngoding fitur baru, setup spec.
---

# Spec Generator

Membuat folder spec fitur secara interaktif supaya developer tidak perlu copy-paste
template markdown berulang kali.

## Lokasi Output

```
.agent/spec/active/[nama-fitur]/
```

Aturan `nama-fitur` (kebab-case / lowercase):
- Pakai nama deskriptif → `backend-summarize`, `chrome-extension`, `mobile-flutter`, `backend-ask-search`
- Jika ada referensi ticket/issue: pakai ID lowercase → `trx-12`

Saat fitur selesai dan semua commit sudah masuk `main`, folder dipindah ke `.agent/spec/archive/`.

## Alur Wajib

### Step 1 — Tanya konteks inti

Tanyakan ke user secara ringkas (boleh sekaligus):

1. **Nama / ID fitur** → menentukan nama folder.
2. **Task mentah** — minta user paste deskripsi kebutuhan apa adanya. Kalau ada, ini jadi `card.md`.
3. **Jenis fitur** — pilih salah satu:
   - `backend-route` — endpoint/route FastAPI baru di `backend/app/` + schema + wiring
   - `backend-analysis` — fitur LLM di `backend/analysis/` (ringkasan, Q&A, ekstraksi) + prompt baru
   - `frontend-extension` — fitur di chrome extension (`frontend/chrome-extension/`): tombol sumber, UI, transkrip, config
   - `frontend-mobile` — fitur di app Flutter (`frontend/mobile/`)
   - `bugfix` — perbaikan bug pada modul existing
   - `enhancement` — penambahan/perubahan perilaku existing
   - `other` — jelaskan
4. **Sentuh API / server eksternal?** (ya/tidak). Kalau ya (backend endpoint baru, DeepSeek API, Ollama endpoint) → akan dibuat `apicontract.md`.
5. **Modul referensi di codebase** (opsional) — modul existing yang dijadikan acuan clone. Catat di `rules.md`.

### Step 2 — Gali detail untuk `rules.md`

`rules.md` adalah inti dari setiap spec dan **selalu dibuat**. Gali detail sesuai jenis fitur.
Lihat `references/file-conventions.md` untuk pertanyaan pemandu per jenis fitur.

### Step 3 — Tentukan file yang dibuat (otomatis)

| File | Dibuat kapan |
| --- | --- |
| `rules.md` | **Selalu** |
| `todo.md` | **Selalu** |
| `commits.md` | **Selalu** (diisi kosong, diupdate setelah commit) |
| `card.md` | Jika user menyediakan task mentah / PRD |
| `apicontract.md` | Jika fitur menyentuh API/server eksternal (DeepSeek/Ollama/yt-dlp) |

### Step 4 — Generate folder + file

1. Buat folder `.agent/spec/active/[nama-fitur]/`.
2. Tulis tiap file terpilih mengikuti format di `references/file-conventions.md`.
3. Isi file dengan jawaban user — bukan placeholder kosong. Kalau ada bagian yang belum ditentukan, tulis `TBD`.

### Step 5 — Konfirmasi

Tampilkan ringkasan: path folder + daftar file yang dibuat + 1 baris isi tiap file.
Tawarkan untuk langsung lanjut ke implementasi atau merevisi spec.

## Aturan Penting

- **Jangan mengarang isi.** Spec yang salah lebih berbahaya dari spec kosong. Kalau ragu, tanya atau tandai `TBD`.
- **Konsisten format.** Ikuti konvensi di `references/file-conventions.md`.
- **Bahasa mengikuti user.** Default Bahasa Indonesia.

## Referensi

- `references/file-conventions.md` — format & template tiap file beserta pertanyaan pemandu per jenis fitur.
