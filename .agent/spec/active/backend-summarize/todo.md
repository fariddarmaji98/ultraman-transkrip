# Todo — B0 Backend Summarize + Store

- [ ] `backend/requirements.txt`: fastapi, uvicorn, pydantic, httpx, pyyaml, loguru
- [ ] struktur: `backend/app/`, `backend/analysis/`, `backend/store/`, `backend/prompts/`, `backend/constants/`, `backend/config/`
- [ ] `constants/`: paths, llm (endpoint DeepSeek/Ollama, default model, timeout), bahasa default
- [ ] `config/default.yaml` + loader pydantic (default dari constants; api key dari env)
- [ ] `store/`: skema SQLite `transcripts` + `summaries` + fungsi simpan/ambil
- [ ] `analysis/`: interface `summarize(text, lang, style)` provider-agnostik
- [ ] `analysis/`: adapter DeepSeek (httpx → /v1/chat/completions)
- [ ] `analysis/`: adapter Ollama (httpx → /api/chat)
- [ ] `prompts/summary.md`: prompt ringkasan (poin kunci + action item, output ikut bahasa)
- [ ] `app/`: `POST /transcripts`, `GET /transcripts/{id}`, `POST /summarize`
- [ ] CORS untuk origin chrome-extension
- [ ] recovery: provider down (502), input kosong (422), no api key (400)
- [ ] uji manual: `uvicorn app.main:app --reload` → curl `/summarize` dengan transkrip sampel
- [ ] (B1) `POST /ask` + FTS5 search
