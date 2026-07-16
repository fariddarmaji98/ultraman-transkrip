# ADR 0002 — Pivot ke Webapp Upload-Based, Transkripsi di Server

- Status: accepted
- Tanggal: 2026-07-16
- Menggantikan: arsitektur "FE menangani transkrip real-time" (README/AGENTS lama, spec `transkrip-tool`, `chrome-extension`, `backend-summarize`, `mobile-flutter`)

## Konteks

Arah lama: transkripsi real-time di sisi klien (Chrome extension + Web Speech API), backend hanya summarize + store. Arah itu punya batasan struktural yang sudah tercatat sendiri di spec lama: Web Speech API hanya mendengar mikrofon (audio tab Zoom/Meet butuh milestone terpisah yang rumit), kualitas ASR tidak kita kendalikan, dan tidak ada jalur untuk memproses **rekaman yang sudah ada** (file audio/video).

Permintaan user (Juli 2026): aplikasi upload rekaman (audio/video) → transkrip; FE + BE terpisah; di-deploy online; BE jadi pusat gravitasi yang bisa dikembangkan dengan AI.

## Keputusan

1. **Transkripsi pindah ke backend** (batch, dari file yang di-upload), bukan real-time di klien.
2. FE langkah 1 = **web SPA (React + Vite)**, menggantikan Chrome extension sebagai frontend pertama.
3. Engine ASR di balik **interface `ASRProvider`**: Groq API `whisper-large-v3-turbo` (default), faster-whisper lokal (fallback/privasi), WhisperX GPU (nanti, + diarization).
4. **PostgreSQL + Procrastinate** menggantikan rencana SQLite: satu datastore untuk queue + metadata + pgvector.
5. **Bangun sendiri, bukan fork** — hasil riset repo existing: kandidat terdekat (Whishper, Scriberr) macet dan berbasis Go; komponen ASR yang matang justru diadopsi sebagai container/library, bukan produknya.

Detail lengkap + sumber riset: [docs/planning/webapp-upload-transkrip.md](../planning/webapp-upload-transkrip.md).

## Konsekuensi

- Tujuan produk lama ("second brain": simpan, ringkas, tanya dengan sitasi) **tetap** — hanya cara akuisisi transkrip yang berubah.
- Spec lama di `.agent/spec/active/` (transkrip-tool, chrome-extension, backend-summarize, mobile-flutter) superseded → diarsipkan/ditandai; struktur `backend/` di AGENTS.md perlu revisi (tambah `asr/`, `media/`, `worker/`; `store/` jadi Postgres).
- README + AGENTS.md perlu ditulis ulang mengikuti arsitektur baru.
- Real-time / meeting-capture bisa kembali kelak sebagai *sumber input tambahan* yang mengirim audio ke backend yang sama — bukan sebagai arsitektur utama.
- Biaya berjalan muncul (VPS + API per jam audio), sebelumnya murni lokal. Estimasi ~$7–13/bulan pada pemakaian moderat.
