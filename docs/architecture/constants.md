# Arsitektur — Centralized Constants (backend)

Peta detail paket `backend/constants/` sebagai single source of truth. Keputusan & alasan di `docs/adr/0001-centralized-constants.md`.

## Prinsip

1. **Satu nilai, satu tempat.** Tiap konstanta hidup di satu file `constants/` sesuai konteks.
2. **Lapisan paling dasar.** `constants/` tidak mengimpor `app/`/`analysis/`/`store/`. Boleh diimpor siapa saja.
3. **Default config = constants.** Model pydantic di `config/` ambil default dari `constants/`; YAML hanya override. API key dari env.

## Peta File

| File | Contoh isi | Dipakai oleh |
|---|---|---|
| `constants/paths.py` | `ROOT`, `STORE_DIR`, `DB_PATH`, `PROMPTS_DIR`, `LOGS_DIR` | semua modul backend |
| `constants/llm.py` | `PROVIDERS`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `TIMEOUT_S` | `analysis/`, `config/` |
| `constants/store.py` | nama tabel (`transcripts`,`summaries`), versi skema | `store/` |
| `constants/lang.py` | `DEFAULT_LANGUAGE`, daftar bahasa didukung | `app/`, `analysis/`, `config/` |

## Contoh dampak perubahan

- **Ganti model LLM default**: ubah `DEEPSEEK_MODEL`/`OLLAMA_MODEL` di `constants/llm.py` → default config + semua call ikut.
- **Tambah provider** (mis. LM Studio): tambah entry di `PROVIDERS` + base_url + adapter di `analysis/` → tidak ada endpoint hard-coded di logic.
- **Pindah lokasi DB**: ubah `DB_PATH` di `constants/paths.py` → `store/` ikut tanpa sentuh route.

## Anti-pattern (jangan)

- Tulis URL endpoint / nama model / nama tabel langsung di logic `analysis/`/`app/`.
- Taruh API key di constants atau commit ke repo (pakai env).
- Impor `app/`/`analysis/` dari dalam `constants/` (bikin siklus).

## Catatan Frontend

Frontend tidak pakai paket Python ini, tapi menganut prinsip yang sama: endpoint backend & setting bahasa hidup di **satu** modul config (`lib/config.js` untuk extension, satu service untuk Flutter), bukan tersebar.
