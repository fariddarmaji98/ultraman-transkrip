# Todo — Ultraman Transkrip (umbrella)

Checklist level milestone. Detail per milestone ada di spec masing-masing.

- [ ] B0 — backend: `/transcripts` (simpan) + `/summarize` (DeepSeek/Ollama) + SQLite (`backend-summarize`)
- [ ] F1 — chrome extension: Voice transkrip (Web Speech API) + UI 2 tab + Summarize → backend (`chrome-extension`)
- [ ] F2 — chrome extension: tab audio Zoom/Meet (tabCapture + ASR on-device / scrape caption)
- [ ] B1 — backend: Q&A/search atas transkrip tersimpan
- [ ] F3 — mobile Flutter (`mobile-flutter`)
- [ ] B2 — robustness, auth, deploy

## Scaffolding awal (konvensi)

- [x] adopsi konvensi markdown dari ultraman-rok-bot
- [x] README.md + AGENTS.md (arsitektur backend + frontend)
- [x] skill `spec-generator` + `documentation`
- [x] spec umbrella `transkrip-tool`
- [x] spec `chrome-extension` (ui-map dari mockup user)
- [ ] ADR 0001 — centralized constants (backend) — selesai, cek path backend
- [ ] scaffolding kode: `backend/` (FastAPI) + `frontend/chrome-extension/` (MV3)
