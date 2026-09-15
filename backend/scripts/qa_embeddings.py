"""QA Fase 3 — unit test index embedding dengan provider dummy (tanpa Ollama/jaringan).

Jalankan dari backend/:
    .venv/Scripts/python.exe scripts/qa_embeddings.py
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analysis.embeddings import EmbeddingIndex  # noqa: E402

PASS = 0


def ok(label: str) -> None:
    global PASS
    PASS += 1
    print(f"  OK  {label}")


class Dummy:
    """Vector deterministik dari isi teks — cukup untuk logika index/filter."""

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(sum(ord(c) for c in t)) / 1000] + [0.0] * 7 for t in texts]


PAYLOAD_ID = {
    "decisions": [
        {"text": "pakai postgres untuk database", "at_ms": 1},
        {"text": "telegram sebagai channel", "at_ms": 2},
    ],
    "requirements": [{"text": "butuh auth multi user", "at_ms": 3}],
    "constraints": [],
    "open_questions": [],
}
PAYLOAD_EN = {
    "decisions": [{"text": "ganti jadi sqlite", "at_ms": 9}],
    "requirements": [], "constraints": [], "open_questions": [],
}


def main() -> None:
    tmp = Path(tempfile.mkdtemp()) / "emb.jsonl"
    idx = EmbeddingIndex(path=tmp)

    n = idx.index_extract(1, "id", PAYLOAD_ID, ["project-x"], Dummy())
    assert n == 3
    idx.index_extract(1, "en", PAYLOAD_EN, [], Dummy())
    assert len(idx.items) == 4
    ok("index: 3 item (id) + 1 item (en)")

    idx.index_extract(1, "id", PAYLOAD_ID, ["project-x"], Dummy())
    assert len(idx.items) == 4
    ok("re-index (rec, lang) yang sama menggantikan, tidak menduplikasi")

    res = idx.search("database", Dummy())
    assert res and res[0]["recording_id"] == 1 and "score" in res[0]
    ok(f"search mengembalikan hasil berperingkat (top: {res[0]['text']!r})")

    res = idx.search("database", Dummy(), label="project-x")
    assert res and all("project-x" in r.get("labels", []) for r in res)
    assert idx.search("database", Dummy(), label="tidak-ada") == []
    ok("filter label: menyaring benar, label fiktif = kosong")

    res = idx.search("auth", Dummy(), category="requirements")
    assert res and all(r["category"] == "requirements" for r in res)
    ok("filter kategori menyaring benar")

    idx.drop(1, "en")
    assert len(idx.items) == 3
    reloaded = EmbeddingIndex(path=tmp)
    assert len(reloaded.items) == 3
    ok("drop satu bahasa + persist + reload dari file konsisten")

    idx.drop(1)
    assert len(idx.items) == 0
    ok("drop seluruh rekaman")

    print(f"\n{PASS} tes PASS, 0 gagal.")


if __name__ == "__main__":
    main()
