# ADR 0001 — Sentralisasi Konstanta & Konfigurasi (`backend/constants/`)

- **Status**: Accepted
- **Tanggal**: 2026-06-21
- **Konteks spec**: lihat `.agent/spec/active/transkrip-tool/` dan `.agent/spec/active/backend-summarize/`
- **Scope**: berlaku untuk **backend** (Python). Frontend (chrome-extension/Flutter) punya konfigurasinya sendiri (`chrome.storage` / `shared_preferences`), tapi prinsip "satu sumber config" tetap dianut.

## Konteks

Backend punya nilai penting yang gampang tersebar sebagai *magic number/string* di banyak file:

- Endpoint & nama model LLM (DeepSeek `/v1/chat/completions`, Ollama `/api/chat`) bisa bocor ke logic `analysis/`.
- Default provider, bahasa default, timeout, max tokens rawan ditulis ulang.
- Path proyek (`STORE_DIR`, `DB_PATH`, `PROMPTS_DIR`) di-hardcode di banyak modul.
- Nama tabel/skema SQLite tersebar antara `store/` dan route.

Akibatnya: mengubah satu nilai (mis. ganti model default, pindah endpoint) menuntut edit di banyak file dan rawan tidak sinkron.

## Keputusan

Membuat paket **`backend/constants/`** sebagai **single source of truth**, dikelompokkan per-konteks:

| File | Isi |
|---|---|
| `constants/paths.py` | `ROOT`, `STORE_DIR`, `DB_PATH`, `PROMPTS_DIR`, `CONFIG_DIR`, `LOGS_DIR` |
| `constants/llm.py` | `PROVIDERS`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `TIMEOUT_S`, `MAX_TOKENS` |
| `constants/store.py` | nama tabel, versi skema, batas teks |
| `constants/lang.py` | `DEFAULT_LANGUAGE`, daftar bahasa didukung |

### Aturan ketergantungan

- `constants/` **tidak** mengimpor `app/`/`analysis/`/`store/` (lapisan paling dasar, bebas siklus).
- `app/`, `analysis/`, `store/` mengimpor dari `constants/`.
- **Default `config` (pydantic) mengambil nilai dari `constants/`** — `config/default.yaml` hanya cermin untuk dokumentasi/override. API key DeepSeek **dari env**, bukan constants/yaml.

### Hubungan `constants/` vs `config/`

- `constants/` = invarian level-kode & **default**; diubah developer.
- `config/*.yaml` = override runtime (mis. ganti provider, model, bahasa default); diubah user/operator.
- YAML menimpa default; field hilang dari YAML → fallback ke konstanta (bukan literal acak).

## Konsekuensi

**Positif**
- "Ubah A → B ikut": ganti `DEEPSEEK_MODEL` sekali → semua call summarize/ask ikut.
- Tambah provider LLM cukup di `constants/llm.py` (`PROVIDERS` + endpoint) + adapter `analysis/` → tidak ada endpoint nyasar di logic.
- Magic number hilang dari logic; lebih mudah di-review & di-test (mock adapter).

**Negatif / trade-off**
- Lapisan import tambahan; perlu disiplin agar nilai konteks-spesifik tidak salah tempat.
- `config/default.yaml` menduplikasi sebagian nilai (keterbacaan operator) — dijaga tetap cermin constants.

## Lihat juga

- `docs/architecture/constants.md` — peta detail + contoh dampak perubahan.
- `AGENTS.md` → bagian *Backend* & *Documentation & ADR*.
