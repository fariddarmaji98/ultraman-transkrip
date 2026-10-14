# Plan: API Transkrip

## Payload
- `url` — URL video/audio (opsional, salah satu dengan `file`)
- `file` — upload file langsung (opsional, salah satu dengan `url`)
- `content_type` — `"audio"` | `"video"`
- `summary` — `true`/`false`

## Alur
1. Kalau payload `url` → download video/audio dulu
2. Buat transkrip
3. Kalau `summary=true` → buat ringkasan pakai model LLM default
4. Kembalikan response (transkrip + ringkasan)

## Penyimpanan
- File tersimpan di sistem dengan flag `from_api` (field baru di DB)
- Recording muncul di aplikasi Ultraman Transkrip seperti unduhan video biasa
- Status, progress, segmen — sama dengan flow unduh manual

## TODO berikutnya (setelah stabil)
- Auto-delete file hasil request API setelah response dikirim
- Data transkrip tetap tersimpan di DB, hanya file media yang dihapus
