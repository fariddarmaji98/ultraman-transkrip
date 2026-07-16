---
name: documentation
description: |
  Gunakan untuk membuat dokumentasi engineering berbasis codebase tool transkrip ini.
  Trigger: dokumentasi perubahan, dokumentasi fitur baru, release notes, fitur/sumber belum terdokumentasi.
---

# Documentation Skill Entrypoint

Skill ini punya 2 mode context:

1. `change-doc.md`

- Pakai saat user meminta dokumentasi perubahan dari commit/range/branch/current branch.
- Fokus pada perubahan per area (backend app/analysis/store, frontend chrome-extension/mobile), file penting, dampak ke hasil transkrip/ringkasan, dan impact release notes.

2. `new-doc.md`

- Pakai saat user meminta dokumentasi fitur baru atau modul existing yang belum terdokumentasi.
- Fokus pada gambaran fitur, flow transkrip (frontend) → kirim → simpan/ringkas (backend), config, dan recovery.

## Routing Rule

- Jika prompt menyebut `commit`, `branch`, `diff`, `perubahan`, `release notes`, pilih `change-doc.md`
- Jika prompt menyebut `fitur baru`, `belum ada dokumentasi`, pilih `new-doc.md`
- Jika ambigu dan tidak ada referensi git, pilih `new-doc.md`

## Repo Alignment

Selalu sinkron dengan struktur repo ini (monorepo backend + frontend):

- `backend/app/`: route FastAPI + schema
- `backend/analysis/`: integrasi LLM (ringkasan, Q&A)
- `backend/prompts/`: template prompt LLM
- `backend/store/`: persistensi transkrip + index
- `backend/constants/` + `backend/config/`: konstanta & setting
- `frontend/chrome-extension/`: transkrip klien (MV3) + UI
- `frontend/mobile/`: app Flutter
- `docs/`: output dokumentasi

Gunakan verifikasi repo ini bila butuh:

- backend: `uvicorn app.main:app --reload` + call endpoint sampel
- extension: load unpacked + rekam pendek
- unit test hanya jika user memang meminta atau perubahan terlokalisasi (mis. parsing, adapter LLM dengan mock)

Jangan anggap unit test adalah gate wajib repo ini.
