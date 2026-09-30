# ADR 0020 — Tangkap semua exception di route test koneksi LLM

- Status: accepted
- Tanggal: 30-09-2026
- Terkait: [ADR 0014](0014-provider-custom-url.md)

## Konteks

Route `POST /api/llm/test` memanggil `provider.ping()`, yang melakukan `POST /chat/completions`
ke provider. Handler hanya menangkap `LLMError`:

```python
try:
    await provider.ping()
except LLMError as exc:
    return {"ok": False, "detail": str(exc)}
```

`_chat()` menangkap `httpx.HTTPError` dan status >= 400 → `LLMError`. Tapi proxy yang balik
429 Too Many Requests dengan body non-JSON/non-standar bisa melempar exception di luar
`LLMError` — misalnya `json.JSONDecodeError` saat `res.json()` dipanggil pada response
non-JSON, atau `httpx.ConnectError` yang tidak tercakup `HTTPError` di versi httpx tertentu.

Hasil: **500 Internal Server Error** — FE menampilkan error generik, user tidak tahu penyebab
aslinya (rate limit proxy).

## Keputusan

Tambah catch-all `except Exception` setelah `except LLMError`, balik 200 `ok:false` dengan
`type(exc).__name__` + pesan. Kontrak FE tidak berubah: `ok:false` → tampilkan `detail`.

```python
except LLMError as exc:
    return {"ok": False, "detail": str(exc)}
except Exception as exc:
    return {"ok": False, "detail": f"error tak terduga: {type(exc).__name__}: {exc}"}
```

## Alternatif ditolak

1. **Pangkat `res.json()` di `_error_of` dengan try/except ValueError** — sudah ada, tapi
   tidak menutup exception type lain di luar `httpx.HTTPError`.
2. **Naikkan timeout test** — bukan masalah timeout; proxy balik 429 dalam <1 detik.
3. **Retry otomatis 429** — menambah kompleksitas; rate limit proxy = masalah kapasitas,
   bukan bug kode. Pesan jelas cukup.

## Konsekuensi

- Test koneksi tidak pernah 500 lagi — semua error jadi 200 `ok:false`.
- User dapat pesan actionable: "429 Too Many Requests" vs "error tak terduga: ConnectError".
- Catch-all tidak menutup `LLMError` (spesifik dulu, umum belakangan).