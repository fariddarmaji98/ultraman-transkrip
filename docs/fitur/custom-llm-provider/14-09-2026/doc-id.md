# Provider LLM Custom URL & Daftar Model dari Provider

- Tanggal: 14-09-2026
- Status: implemented
- Terkait: [ADR 0014](../../adr/0014-provider-custom-url.md), [ADR 0007](../../adr/0007-mesin-ai-dipilih-dari-ui.md)

## Summary

Popup **Mesin AI** kini mendukung **Custom URL**: satu entri provider untuk API proxy
OpenAI-compatible apa pun (contoh: BandelAI, OpenRouter, proxy pribadi). Nama model tidak lagi
diketik buta — tombol **"Muat daftar model"** mengambil daftar langsung dari provider
(`GET /v1/models`) dan menampilkannya sebagai dropdown beranotasi kemampuan:
`glm-5.3 · A · text, vision`.

## Motivation

Pengguna berlangganan API proxy berisi puluhan model lintas vendor. Katalog provider tetap
(Ollama/Groq/DeepSeek/Claude/OpenAI) tidak bisa menampungnya tanpa rilis kode per layanan.
Selain itu nama model proxy tidak bisa ditebak, dan kegagalan baru muncul saat ringkasan
dijalankan — terlambat untuk diperbaiki dari popup.

## Proposed Solution

1. Entri katalog `custom` (base URL kosong, diisi dari UI, disimpan di `runtime.json`).
2. `OpenAICompatProvider.list_models()` — `GET {base_url}/models`, normalisasi `id` +
   metadata opsional (`grade`, `vision`, `text`, `enabled`), format list-of-strings ditangani.
3. Route `POST /api/llm/models` — baca-only, pakai isian form, gagal = `200 {ok:false}`.
4. UI: field Model menjadi dropdown setelah dimuat; untuk provider custom freetext
   **di-disable** (wajib muat dulu); model habis stok **difilter** dari daftar; label opsi
   menampilkan grade + modality.

## Architecture Overview

```
SettingsModal.jsx ── "Muat daftar model" ──► POST /api/llm/models (isian form)
                                                │
                                                ▼
                                    OpenAICompatProvider.list_models()
                                    GET {base_url}/models  (kunci form)
                                                │ normalize + filter enabled:false
                                                ▼
                                    [{id, grade?, text?, vision?}, ...]
                                                │
                            dropdown ◄──────────┘  label: "id · grade · text, vision"

Simpan (PATCH /api/llm) ──► runtime.set_llm(provider, model, key, base_url)
                            ──► data/runtime.json {llm: {provider, model,
                                 keys.custom, custom_base_url}}
Ringkasan/chat ──► analysis.resolve() ──► base_url custom bila provider == "custom"
```

## Module / File Structure

| File | Perubahan |
|---|---|
| `backend/constants/__init__.py` | Entri katalog `custom` (label, note, base_url kosong) |
| `backend/analysis/openai_compat.py` | `list_models()` — GET /models, normalisasi + filter stok |
| `backend/analysis/__init__.py` | `resolve()`: provider custom pakai `runtime.custom_base_url()` |
| `backend/app/runtime.py` | `set_llm(..., base_url)`, `custom_base_url()`; persist `runtime.json` |
| `backend/app/schemas.py` | `LlmIn.base_url` (opsional) |
| `backend/app/routes/llm.py` | `POST /llm/models`; `_require_custom_url()`; tes pakai URL form |
| `frontend/web/src/api.js` | `listLlmModels()` |
| `frontend/web/src/components/SettingsModal.jsx` | `ModelField` dropdown + `UrlField` + `modelLabel` |

## Backend Flow

1. User pilih **Custom URL** → isi base URL (harus sampai `/v1`), API key.
2. Klik **Muat daftar model** → `POST /api/llm/models` dengan isian form (tidak disimpan).
3. Provider dipanggil; balikan dinormalkan; `enabled: false` dibuang; diurutkan per nama.
4. Dropdown menampilkan `id · grade · text, vision`. Model tersimpan yang tidak ada di
   daftar di-reset kosong (harus pilih ulang dari yang valid).
5. **Tes koneksi** → `POST /api/llm/test` (ping `max_tokens=5`).
6. **Simpan** → `PATCH /api/llm` → `runtime.json`; `resolve()` berikutnya memakai URL custom.

## Config & Setting

- Env `TRANSKRIP_LLM_BASE_URL` tetap menang atas `custom_base_url` (escape hatch existing).
- Env `TRANSKRIP_LLM_PROVIDER` tetap mengunci pilihan (ADR 0005).
- Tidak ada konstanta baru; `LLM_PROVIDERS` bertambah satu entri.

## Recovery & Edge Cases

| Kasus | Perilaku |
|---|---|
| Custom tanpa base URL (simpan/tes/muat) | 422 / `ok:false` — "base URL wajib diisi…" |
| Provider down saat muat daftar | `ok:false` + pesan; input tetap redup, bisa coba lagi |
| Proxy tanpa `/models` | `ok:false` "tidak mengembalikan daftar model" — provider bawaan tetap tersedia |
| Model tersimpan menguap (habis/diganti) | Dikosongkan setelah muat ulang; pilih ulang |
| Balikan list-of-strings (non-standar) | Ditangani: label hanya nama model |
| Kunci salah saat muat daftar | `ok:false` pesan provider (401 diterjemahkan) |

## Privasi

- Base URL & kunci disimpan plaintext di `data/runtime.json` (tergitignore) — perlakuan sama
  dengan kunci provider lain; deployment produksi pakai env.
- Nilai kunci tidak pernah dikirim balik ke browser (hanya flag `key_set`).
- Teks transkrip hanya keluar mesin bila provider aktif adalah cloud/proxy — UI menampilkan
  provider aktif (pola existing).

## Comments / Discussions

- Label `(A, text)` meniru katalog web BandelAI supaya pengguna proxy tidak perlu belajar
  format baru.
- `text` eksplisit diambil dari `modalities.input` — tanpa itu model text-only tampil
  ambigu (cuma grade, tak diketahui teks-saja atau metadata kurang).
- Cache daftar model sengaja tidak ada: stok proxy berubah cepat; on-demand lebih jujur.
