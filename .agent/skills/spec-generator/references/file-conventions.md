# File Conventions — Spec Generator

Format & template tiap file spec untuk repo **ultraman-transkrip** (monorepo: backend Python+FastAPI untuk summarize/store, frontend chrome-extension MV3 + Flutter untuk transkrip; LLM DeepSeek/Ollama).
Ikuti struktur ini supaya semua spec lintas fitur seragam. Isi `[...]` dengan jawaban user; pakai `TBD` kalau belum ditentukan.

## Daftar Isi

1. [rules.md](#rulesmd) — inti, selalu dibuat
2. [todo.md](#todomd) — selalu dibuat
3. [commits.md](#commitsmd) — selalu dibuat
4. [card.md](#cardmd) — opsional (task mentah/PRD)
5. [apicontract.md](#apicontractmd) — opsional (jika sentuh API/server eksternal)
6. [Pertanyaan pemandu per jenis fitur](#pertanyaan-pemandu-per-jenis-fitur)

---

## rules.md

**File inti — selalu dibuat.** Breakdown teknis implementasi dari sudut pandang developer.

Template `backend-route` / `backend-analysis`:

```markdown
# [Nama Fitur] — [ID opsional]

## Main

- endpoint/fitur: `[METHOD /path]` atau operasi LLM `[nama]`
- modul: `backend/app/[...].py` (route) / `backend/analysis/[...].py` (LLM)
- referensi clone: `backend/[...]` (route/adapter existing terdekat)

## Endpoint / Interface

- request: [field + tipe]
- response: [bentuk]
- (jika LLM) provider: [deepseek / ollama / dari config], prompt: `backend/prompts/[...]`

## Store

- tabel/skema yang dibaca/ditulis: `[...]`

## Config / Constants

- nilai baru di `backend/constants/[...]` + `config/default.yaml`

## Recovery

- provider gagal / timeout / input invalid: [cara handle + kode status]

## Note

- [catatan penting, edge case, privasi data]
```

Template `frontend-extension` / `frontend-mobile`:

```markdown
# [Nama Fitur] — [ID opsional]

## Main

- fitur UI/transkrip: [deskripsi]
- lokasi: `frontend/chrome-extension/[...]` atau `frontend/mobile/lib/[...]`
- referensi clone: [komponen/handler existing terdekat]

## UI

- letak di tab Transkrip / Config (lihat ui-map): [...]
- elemen baru: [tombol/dropdown/panel]

## Transkrip / Capture

- sumber audio: [mic Web Speech API / tabCapture / plugin STT mobile]
- bahasa: [dari setting]

## Backend Wiring

- panggil endpoint: `[METHOD /path]` (lihat apicontract / backend spec)

## Recovery

- izin ditolak / error STT / backend down: [cara handle]

## Note

- [scope, batasan, hal mudah lupa — mis. Web Speech hanya mic]
```

Template `bugfix` / `enhancement`:

```markdown
# [Nama Fitur] — [ID opsional]

## Main

- [ringkasan perubahan/perilaku baru]
- [lokasi file yang diubah, mis. backend/analysis/summary.py / frontend/chrome-extension/lib/...]

## Config

- [setting/model/prompt/endpoint yang ditambah atau diubah]

## Flow [Nama Alur]

- [langkah 1]
- [langkah 2]

## Note

- [scope spec ini]
- [hal yang sempat terlewat / mudah lupa]
```

---

## todo.md

Checklist implementasi bertahap. Gunakan checkbox `- [ ]`. Tandai `[x]` saat task selesai.

```markdown
# Todo — [ID/Nama Fitur]

- [ ] clone modul referensi → `[backend/app|backend/analysis|frontend/...]/[...]`
- [ ] rename semua nama konsisten
- [ ] implementasi inti (route/handler/UI/transkrip)
- [ ] wiring: daftarkan route / sambungkan ke backend endpoint / tambah ke UI tab
- [ ] config/constants baru (`backend/constants/` atau `lib/config`)
- [ ] handle recovery (input invalid / provider down / izin ditolak)
- [ ] uji manual (call endpoint / load unpacked extension / run app)
- [ ] [item spesifik fitur]
```

---

## commits.md

Diisi kosong saat spec dibuat, diupdate setelah setiap commit yang relevan. Dipakai untuk validasi terhadap `main` sebelum arsip.

```markdown
# Commits — [ID/Nama Fitur]

<!-- tambahkan commit setelah implementasi selesai: - `<hash>` <pesan commit> -->
```

---

## card.md

Task mentah apa adanya dari user / catatan. **Jangan diedit/dirapikan** — salin verbatim.

```markdown
Task:

[deskripsi task mentah dari user]

[link referensi: video, dokumen, contoh transkrip, dsb]

[catatan tambahan]
```

---

## apicontract.md

Dibuat kalau fitur menyentuh API/server eksternal (mis. DeepSeek API, Ollama endpoint, layanan transkrip cloud). Satu heading `#` per operasi.

```markdown
# [nama operasi]

- api: `/path/endpoint`  (mis. DeepSeek `/v1/chat/completions`, Ollama `/api/generate`)
- method: GET / POST / PUT / DELETE
- auth: [api key / none / lokal]
- params / body:
  - [field]: [tipe]
- response:

\`\`\`json
{ }
\`\`\`
```

---

## Pertanyaan pemandu per jenis fitur

**backend-route:**
- Endpoint apa (`METHOD /path`) & request/response-nya?
- Baca/tulis tabel apa di `store/`?
- Route existing mana yang jadi referensi clone?
- Recovery & kode status error?

**backend-analysis:**
- Operasi LLM apa (ringkas / Q&A / action item / klasifikasi)?
- Provider: DeepSeek API, Ollama lokal, atau configurable?
- Prompt-nya seperti apa & disimpan di `backend/prompts/` mana?
- Butuh kutipan referensi balik ke transkrip?

**frontend-extension:**
- Letak di tab Transkrip atau Config? Elemen UI baru apa?
- Sumber audio: mic (Web Speech API) / tabCapture? (ingat: Web Speech hanya mic)
- Endpoint backend mana yang dipanggil?
- Recovery: izin mic ditolak / error STT / backend down?

**frontend-mobile:**
- Fitur sejajar dengan extension yang mana?
- Plugin STT / HTTP client apa?
- Endpoint backend yang dipanggil?

**bugfix:**
- Bug-nya apa & di modul mana?
- Cara reproduksi & expected behavior?

**enhancement:**
- Perilaku lama vs perilaku baru?
- Modul/file yang berubah? Ada setting/prompt baru?
