# Pelajaran — definisi ganda yang tak terlihat linter

> Bug nyata: **fitur upload mati total selama 3 commit** tanpa ada yang sadar.
> Diperbaiki di `816b210`, disebabkan oleh `4cec044`.
> Dokumen ini menyimpan **penyebab dan penjaganya**, bukan sekadar ceritanya.

## Apa yang terjadi

`app/routes/recordings.py` punya dua fungsi bernama sama:

```python
async def _probe_or_reject(path: Path) -> int:      # baris 302 — ffprobe, untuk upload
    ...

async def _probe_or_reject(url: str) -> MediaInfo:  # baris 322 — yt-dlp, untuk URL
    ...
```

Python tidak punya overload: definisi kedua **menimpa** yang pertama. Jadi `upload_recording`
memanggil prober URL dengan sebuah `Path`, dan setiap upload berakhir 500:

```
AttributeError: 'WindowsPath' object has no attribute 'decode'
```

Nama kedua lahir dari kebiasaan yang biasanya benar — *"clone modul terdekat"* (AGENTS.md).
Fungsi probe untuk URL disalin dari fungsi probe untuk file, lengkap dengan namanya.

## Kenapa lolos begitu lama

Tiga hal yang masing-masing masuk akal, tapi bertumpuk jadi titik buta:

1. **Import tetap sukses.** Tidak ada `SyntaxError`, tidak ada `ImportError`. Aplikasi menyala
   normal dan `/api/health` menjawab `ok`. Yang rusak hanya satu jalur, hanya saat dipanggil.
2. **Jalur yang rusak sedang tidak dipakai.** Fitur baru (unduh dari URL) yang dites berulang kali;
   fitur lama (upload) diasumsikan aman karena tidak disentuh — padahal disentuh, lewat nama.
3. **Verifikasi hanya menyasar yang baru.** Commit downloader diuji dengan URL sungguhan sampai
   tuntas. Tidak sekali pun mencoba upload.

## Kenapa linter tidak menolong

Ini bagian yang paling penting, dan berlawanan dengan dugaan. **Diuji empiris**, bukan diasumsikan:

| Kasus uji | ruff `F811` | pylint `E0102` |
|---|---|---|
| `def f` didefinisikan dua kali | kena | kena |
| `async def f` didefinisikan dua kali | kena | kena |
| `def f` beranotasi tipe, dua kali | kena | kena |
| **`def _f` (berawalan garis bawah), dua kali** | **lolos** | **lolos** |

Yang menentukan bukan `async`, bukan anotasi, bukan ada-tidaknya pemanggil — melainkan **garis
bawah di depan nama**. Kedua alat memperlakukan nama berawalan `_` sebagai boleh-ditimpa.

Dan **seluruh helper di backend ini berawalan `_`** (`_probe_or_reject`, `_create_job`,
`_segments_of`, …). Artinya: memasang linter akan memberi rasa aman yang **palsu** untuk justru
pola yang paling rawan di codebase ini.

## Penjaga yang dipasang

`backend/scripts/check_duplicate_defs.py` — pemeriksa AST ~45 baris yang mencari fungsi/kelas
top-level dengan nama sama dalam satu modul. Dekorator yang memang sah menimpa nama
(`@overload`, `@x.setter`, `@register`) dikecualikan.

```bash
cd backend && .venv/Scripts/python scripts/check_duplicate_defs.py
```

Keluar dengan kode 1 bila ada temuan, jadi bisa dijadikan langkah CI saat repo punya CI.
Terverifikasi: **gagal** pada versi buggy (menunjuk baris 322 menimpa 302), **bersih** pada kode
sekarang, dan tidak menemukan kasus lain di seluruh backend.

## Pelajaran yang berlaku lebih luas

1. **Menyalin fungsi berarti mengganti namanya.** Kalau dua fungsi punya *tipe parameter* berbeda,
   namanya wajib berbeda — Python tidak akan mengingatkan.
2. **Fitur baru bisa merusak fitur lama tanpa menyentuh barisnya.** Tabrakan nama, konstanta yang
   dipakai bersama ([lihat `ACTIVE_STATUSES`](constants.md)), dan state modul semuanya bisa begitu.
   Setelah mengubah modul yang dipakai bersama, **jalankan jalur lama juga**, bukan hanya yang baru.
3. **Alat diam ≠ kode benar.** Sebelum menyimpulkan "linter akan menangkapnya", uji dulu dengan
   kasus yang sesungguhnya. Dugaan pertama di sini salah, dan hanya pengujianlah yang menunjukkannya.
4. **Yang paling berbahaya adalah kegagalan yang senyap di jalur yang jarang dilewati.** Endpoint
   yang tidak pernah dites setelah refactor adalah endpoint yang statusnya tidak diketahui.
