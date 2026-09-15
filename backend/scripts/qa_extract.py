"""QA Fase 1 (transcript-as-context) — tes unit murni, tanpa jaringan/LLM.

Jalankan dari backend/:
    .venv/Scripts/python.exe scripts/qa_extract.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analysis.extract import (  # noqa: E402
    EXTRACT_CHUNK_CHARS,
    EXTRACT_MAX_CHUNKS,
    _parse,
    _split,
)
from analysis.openai_compat import LLMError  # noqa: E402

PASS = 0


def ok(label: str) -> None:
    global PASS
    PASS += 1
    print(f"  OK  {label}")


def expect_err(raw: str, label: str) -> None:
    try:
        _parse(raw)
    except LLMError:
        ok(f"{label} -> LLMError")
        return
    raise AssertionError(f"GAGAL: {label} seharusnya ditolak")


def main() -> None:
    # --- _split: pemotongan & flag terpotong --------------------------------
    line = "0| " + "kata uji yang panjang " * 6  # ~130 char per baris
    need = (EXTRACT_CHUNK_CHARS * 15 // len(line)) + 10
    big = "\n".join(f"{i*3000}| {line} nomor {i}" for i in range(need))
    chunks, truncated = _split(big)
    assert len(chunks) == EXTRACT_MAX_CHUNKS and truncated
    ok(f"_split >12 chunk: dipangkas ke {len(chunks)} + truncated=True")

    chunks, truncated = _split("0| pendek")
    assert len(chunks) == 1 and not truncated
    ok("_split pendek: 1 chunk, tanpa flag")

    # baris utuh tidak terbelah antar chunk
    for c in chunks:
        for ln in c.splitlines():
            assert ln.split("|")[0].strip().isdigit() or not ln.strip()
    ok("_split: tidak ada baris terbelah (semua berformat 'ms| teks')")

    # --- _parse: penolakan yang jelas ---------------------------------------
    expect_err("bukan json sama sekali", "bukan-JSON")
    expect_err('{"decisions": [{"text": "x", "at_ms": -5}]}', "at_ms negatif")
    expect_err('{"decisions": [{"at_ms": 100}]}', "text hilang")
    expect_err('{"decisions": [{"text": "", "at_ms": 100}]}', "text kosong")
    expect_err('{"kategori_asing": []}', "kunci asing")
    expect_err("[]", "bukan objek")

    # --- _parse: bentuk yang diterima ---------------------------------------
    d = _parse('```json\n{"decisions": [{"text": "pilih Hermes", "at_ms": 96300}]}\n```')
    assert d.decisions[0].at_ms == 96300 and d.requirements == [] and d.topics == []
    ok("fences dilucuti; kategori hilang di-backfill []")

    d = _parse('{"topics": ["AI Team!", "ok", "ok", 42, null]}')
    assert d.topics == ["ok"], d.topics
    ok(f"topics kotor disanitasi -> {d.topics}")

    d = _parse("kalimat pembuka {\"open_questions\": [{\"text\": \"q?\", \"at_ms\": 0}]} kalimat penutup")
    assert d.open_questions[0].text == "q?"
    ok("JSON di tengah kalimat diambil (objek terluar)")

    print(f"\n{PASS} tes PASS, 0 gagal.")


if __name__ == "__main__":
    main()
