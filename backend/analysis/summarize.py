"""Ringkas transkrip jadi ringkasan + poin aksi.

Transkrip pendek: satu panggilan. Transkrip panjang: dipotong, tiap potongan
diringkas, lalu ringkasan-ringkasan itu digabung (map-reduce) — karena satu
transkrip 28 menit tidak muat di context provider yang kecil.
"""
from analysis.openai_compat import LLMError
from constants import SUMMARY_CHUNK_CHARS, SUMMARY_MAX_CHUNKS

_SYSTEM = (
    "Kamu meringkas transkrip rekaman berbahasa Indonesia. Tulis dalam bahasa "
    "Indonesia yang lugas. Jangan menambahkan informasi yang tidak ada di transkrip; "
    "bila sesuatu tidak disebutkan, katakan tidak ada."
)

_FORMAT = (
    "## Ringkasan\n"
    "3-6 kalimat inti.\n\n"
    "## Poin utama\n"
    "- maksimal 6 butir\n\n"
    "## Poin aksi\n"
    "- hal yang perlu ditindaklanjuti; tulis 'Tidak ada' bila memang tidak ada."
)


_TRUNCATED = (
    "Catatan: transkrip terlalu panjang untuk diringkas seluruhnya — "
    "ringkasan ini hanya mencakup bagian awal rekaman."
)


async def summarize(segments, llm) -> str:
    """`llm` = provider hasil `analysis.get_llm()`."""
    text = "\n".join(s.text for s in segments if s.text)
    if not text.strip():
        raise LLMError("transkrip kosong — tidak ada yang bisa diringkas")
    chunks, truncated = _split(text)
    body = (
        await llm.complete(_ask(chunks[0]))
        if len(chunks) == 1
        else await _map_reduce(chunks, llm)
    )
    # Pemotongan tidak boleh senyap: ringkasan yang menghilangkan separuh
    # rekaman tanpa memberi tahu itu menyesatkan.
    return f"{body}\n\n{_TRUNCATED}" if truncated else body


async def _map_reduce(chunks: list[str], llm) -> str:
    parts = []
    for i, chunk in enumerate(chunks, start=1):
        prompt = f"Ini bagian {i} dari {len(chunks)}. Ringkas poin-poin pentingnya saja."
        parts.append(await llm.complete(_ask(chunk, prompt)))
    joined = "\n\n".join(parts)
    return await llm.complete(_ask(joined, _MERGE))


_MERGE = (
    "Berikut ringkasan per bagian dari satu rekaman yang sama. "
    "Gabungkan jadi satu ringkasan utuh, buang pengulangan."
)


def _ask(text: str, instruction: str = "Ringkas transkrip berikut.") -> list[dict]:
    return [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": f"{instruction}\n\nFormat:\n{_FORMAT}\n\n---\n{text}"},
    ]


def _split(text: str) -> tuple[list[str], bool]:
    """Potong per baris supaya kalimat tidak terbelah. Balikkan juga flag terpotong."""
    chunks, buf = [], ""
    for line in text.splitlines():
        if len(buf) + len(line) + 1 > SUMMARY_CHUNK_CHARS and buf:
            chunks.append(buf)
            buf = ""
        buf += line + "\n"
    if buf.strip():
        chunks.append(buf)
    if not chunks:
        return [text[:SUMMARY_CHUNK_CHARS]], False
    return chunks[:SUMMARY_MAX_CHUNKS], len(chunks) > SUMMARY_MAX_CHUNKS
