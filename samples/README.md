# Sampel Validasi

Audio Indonesia untuk menguji akurasi transkripsi (WER). Biner audio **tidak di-commit**
(lihat `.gitignore`) — regen dengan skrip di bawah. Transkrip acuan di-commit.

## `fleurs-id/`

Klip dari **Google FLEURS** ([huggingface.co/datasets/google/fleurs](https://huggingface.co/datasets/google/fleurs)),
config `id_id`, split `test`. Lisensi **CC-BY-4.0** © Google.

- `id_*.wav` — audio (di-ignore; regen: `python fetch_fleurs_id.py [N]`)
- `references.tsv` — transkrip acuan resmi (`nama_file<TAB>transkrip`), di-commit

Butuh: `pip install datasets soundfile` (dev-only, bukan dependency backend).

## Hasil validasi (5 klip, faster-whisper `int8`, CPU, 2026-07-18)

| Model | WER | Ukuran | Catatan |
|---|---|---|---|
| `base` | 23,0% | ~140 MB | terlalu lemah untuk Indonesia |
| `cahya/faster-whisper-medium-id` | 9,5% | ~1,5 GB | fine-tune Indonesia |
| `large-v3-turbo` | **5,4%** | ~1,5 GB | terbaik — jadi default lokal |

WER dinormalisasi (huruf kecil, tanpa tanda baca). Groq `whisper-large-v3-turbo` (default
saat `GROQ_API_KEY` diset) memakai bobot large-v3-turbo yang sama di sisi server.
