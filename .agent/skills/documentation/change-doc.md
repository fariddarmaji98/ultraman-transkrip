# Rules Dokumentasi Perubahan

Gunakan panduan ini saat user meminta dokumentasi perubahan dari commit/range/branch/current branch.

## Workflow

1. Tentukan range perubahan (`git diff`, `git log`, branch saat ini vs `main`)
2. Kelompokkan perubahan per area: `backend/app/`, `backend/analysis/`, `backend/store/`, `backend/prompts/`, `frontend/chrome-extension/`, `frontend/mobile/`, `config`/`constants`
3. Identifikasi file penting yang berubah + alasannya
4. Petakan dampak ke hasil (kualitas/format transkrip, hasil ringkasan/Q&A, kontrak endpoint, skema store)
5. Tulis dokumentasi dalam Bahasa Indonesia dan Inggris

## Output Default

```text
docs/[nama-perubahan]/[hari-DD-MM-YYYY]/
  doc-id.md
  doc-en.md
```

## Struktur Wajib

1. Summary
2. Scope (range commit/branch)
3. Changes by Area (backend / frontend)
4. Key Files
5. Behavior Impact (perubahan yang terlihat user: transkrip/ringkasan/UI)
6. Risk & Regression Notes
7. Release Notes (ringkasan singkat untuk changelog)

## Rule Repo Transkrip

- Fokus pada dampak ke hasil, bukan sekadar daftar diff
- Sebutkan perubahan kontrak endpoint (breaking untuk frontend) — sinkronkan dengan `apicontract.md`
- Sebutkan perubahan provider/prompt LLM (memengaruhi ringkasan & privasi data)
- Sebutkan perubahan skema store (berisiko migrasi data lama)
- Tandai perubahan yang butuh update config / reload extension

## Verifikasi

- Backend: call endpoint sampel; Extension: load unpacked + rekam pendek
- Jangan menjadikan unit test sebagai gate wajib repo ini
