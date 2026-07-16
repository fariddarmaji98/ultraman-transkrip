# Todo — Webapp Transkrip MVP (M0+M1)

## M0 — fondasi

- [ ] scaffold monorepo baru: `backend/`, `frontend/web/`, `deploy/` (struktur planning §3)
- [ ] `deploy/docker-compose.yml`: caddy + api + worker + postgres (image `pgvector/pgvector:pg16`) + volume media; Caddyfile (serve dist, proxy /api, body limit > cap agar 413 datang dari app)
- [ ] backend skeleton: FastAPI app factory, loguru, healthcheck `/api/health`
- [ ] `store/`: model SQLAlchemy `recordings`/`jobs`/`segments` + Alembic init + migrasi pertama
- [ ] Procrastinate wiring (app + worker entrypoint) + job dummy end-to-end lewat compose
- [ ] `constants/` + `config/default.yaml` + pembacaan env

## M1 — MVP transkrip

- [ ] `media/`: ffprobe validasi+durasi, ekstraksi ffmpeg → 16 kHz mono opus/flac
- [ ] `asr/base.py`: protocol `ASRProvider`; stub `LLMProvider`/`EmbeddingProvider` di `analysis/base.py`
- [ ] `asr/groq.py`: upload + parse verbose_json → segments; handle limit 100 MB (chunk silence fallback)
- [ ] `asr/local_whisper.py`: faster-whisper int8, model dari config
- [ ] worker task `transcribe` (status/progress/retry/idempoten) + task periodik `cleanup`
- [ ] route: health, auth login, POST/GET/DELETE recordings (upload streaming + ffprobe sinkron), GET jobs, export (pysubs2), serve media (range; cek playback Opus di iOS Safari)
- [ ] FE: setup Vite+React, halaman login, upload (Uppy XHR + progress), daftar rekaman
- [ ] FE: halaman transkrip — polling job, render segmen + timestamp, player sinkron (timeupdate+refs), klik segmen → seek
- [ ] FE: tombol export + hapus + indikator provider aktif
- [ ] recovery: 422 non-media, 413 cap, pesan failed actionable + retry
- [ ] uji manual: upload mp3 pendek & mp4 1 jam (id) → transkrip → export SRT valid; matikan Groq key → fallback lokal jalan
- [ ] (M5 awal, opsional) deploy ke VPS: compose up + TLS + GitHub Action ssh-deploy
