"""Regenerasi sampel validasi FLEURS id_id (audio + transkrip acuan).

Sumber: Google FLEURS (https://huggingface.co/datasets/google/fleurs), config id_id,
split test. Lisensi CC-BY-4.0 (c) Google. Audio di-decode sendiri (Audio(decode=False))
supaya tak butuh torchcodec/torch.

Butuh: pip install datasets soundfile
Pakai: python fetch_fleurs_id.py [N]   (default N=5)
"""
import io
import sys
from pathlib import Path

import soundfile as sf
from datasets import Audio, load_dataset

N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
OUT = Path(__file__).parent / "fleurs-id"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ds = load_dataset("google/fleurs", "id_id", split=f"test[:{N}]")
    ds = ds.cast_column("audio", Audio(decode=False))
    refs = []
    for i, ex in enumerate(ds):
        raw = ex["audio"]
        data = raw.get("bytes") or Path(raw["path"]).read_bytes()
        array, sr = sf.read(io.BytesIO(data))
        sf.write(OUT / f"id_{i}.wav", array, sr)
        refs.append(f"id_{i}.wav\t{ex['transcription']}")
    (OUT / "references.tsv").write_text("\n".join(refs) + "\n", encoding="utf-8")
    print(f"tersimpan {len(refs)} sampel ke {OUT}")


if __name__ == "__main__":
    main()
