# Fix: Test Koneksi LLM 500 saat Proxy Rate-Limit (429)

- Tanggal: 30-09-2026
- Status: implemented
- Terkait: [ADR 0020](../../adr/0020-catch-all-exception-test-llm.md), [ADR 0014](../../adr/0014-provider-custom-url.md)

## Summary

Test koneksi di popup **Mesin AI** mengembalikan **500 Internal Server Error** padahal
"Muat daftar model" berhasil. Penyebab: route `POST /api/llm/test` hanya menangkap
`LLMError`, tapi proxy yang balik **429 Too Many Requests** dengan body non-standar melempar
exception di luar `LLMError`. Fix: tambah catch-all `except Exception` → 200 `ok:false`.

## Motivation

User melaporkan: set Custom URL + API key → "Muat daftar model" berhasil (semua model
muncul), tapi "Test koneksi" gagal. Gejala menyesatkan — terlihat seperti konfigurasi
salah, padahal URL & key benar.

## Analisis

| Endpoint | Method | Berat | Rate limit? |
|---|---|---|---|
| `/v1/models` | GET | Ringan (list metadata) | Jarang kena |
| `/v1/chat/completions` | POST | Berat (panggil LLM) | Mudah kena RPM proxy |

Proxy `ai.darmaji.web.id` membatasi requests-per-minute. `GET /models` lolos, tapi
`POST /chat/completions` kena 429. Proxy balik 429 dengan body yang tidak bisa di-parse
oleh `res.json()` → `JSONDecodeError` (bukan `LLMError`) → 500.

## Solusi

Backend (`app/routes/llm.py`):

```python
try:
    await provider.ping()
except LLMError as exc:
    return {"ok": False, "detail": str(exc)}
except Exception as exc:                          # ← baru
    return {"ok": False, "detail": f"error tak terduga: {type(exc).__name__}: {exc}"}
```

Sebelum: 500 Internal Server Error (FE tampilkan error generik).
Sesudah: 200 `{"ok": false, "detail": "...429 Too Many Requests..."}` (FE tampilkan pesan jelas).

## Verifikasi

```
# Sebelum fix: 500
POST /api/llm/test → 500 Internal Server Error

# Sesudah fix: 200 ok:false + pesan 429
POST /api/llm/test → {"ok":false,"detail":"...HTTP 429 Too Many Requests..."}
```

## Catatan

- Bukan kode yang salah — URL + key + model benar. 429 = rate limit proxy, bukan aplikasi.
- Fix = error handling, bukan retry. User tunggu beberapa detik lalu retry.
- Catch-all tidak menutup `LLMError` (spesifik dulu, umum belakangan).