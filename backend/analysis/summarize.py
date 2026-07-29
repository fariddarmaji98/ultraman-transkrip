"""Ringkas transkrip jadi ringkasan + poin aksi, dalam bahasa yang diminta.

Transkrip pendek: satu panggilan. Transkrip panjang: dipotong, tiap potongan
diringkas, lalu ringkasan-ringkasan itu digabung (map-reduce) — karena satu
transkrip 28 menit tidak muat di context provider yang kecil.

Ringkasan berbahasa lain lahir LANGSUNG dari transkrip asli dalam satu panggilan,
bukan dengan menerjemahkan ringkasan Indonesia dan bukan dengan meringkas
transkrip terjemahan. Sekali jalan lebih murah, dan tiap tahap tambahan adalah
tempat baru bagi makna untuk hilang.
"""
from analysis.openai_compat import LLMError
from constants import (
    DEFAULT_AI_LANGUAGE,
    LANGUAGE_BY_ID,
    SUMMARY_CHUNK_CHARS,
    SUMMARY_MAX_CHUNKS,
)

# Ditulis dalam bahasa Inggris dengan sengaja. Sebelumnya SELURUH prompt
# berbahasa Indonesia — heading, label, instruksi — dan itu menarik model kecil
# untuk menjawab Indonesia betapa pun bahasa lain yang diminta. Mencabut satu
# kalimat pemaksa tidak cukup; kecondongannya ada di seluruh teksnya.
_RULES = (
    "You summarize transcripts of recordings. Do not add information that is not "
    "in the transcript; if something is not mentioned, say so plainly."
)

_FORMAT = (
    "## Summary\n"
    "3-6 essential sentences.\n\n"
    "## Key points\n"
    "- at most 6 bullets\n\n"
    "## Action items\n"
    "- things to follow up on; say there are none if that is the case."
)

_MERGE = (
    "Below are per-part summaries of one and the same recording. "
    "Merge them into a single coherent summary and drop repetitions."
)

# Ditempel di Python, tidak pernah lewat LLM, jadi ia tetap berbahasa Indonesia
# apa pun bahasa keluarannya. Diterima apa adanya: jalur ini baru aktif pada
# transkrip belasan jam, dan menambah tabel terjemahan sembilan bahasa untuk
# satu kalimat lebih mahal daripada masalahnya.
_TRUNCATED = (
    "Catatan: transkrip terlalu panjang untuk diringkas seluruhnya — "
    "ringkasan ini hanya mencakup bagian awal rekaman."
)


async def summarize(segments, llm, lang: str = DEFAULT_AI_LANGUAGE) -> str:
    """`llm` = provider hasil `analysis.get_llm()`; `lang` = bahasa keluaran."""
    text = "\n".join(s.text for s in segments if s.text)
    if not text.strip():
        raise LLMError("transkrip kosong — tidak ada yang bisa diringkas")
    chunks, truncated = _split(text)
    body = (
        await llm.complete(_ask(chunks[0], lang))
        if len(chunks) == 1
        else await _map_reduce(chunks, llm, lang)
    )
    # Pemotongan tidak boleh senyap: ringkasan yang menghilangkan separuh
    # rekaman tanpa memberi tahu itu menyesatkan.
    return f"{body}\n\n{_TRUNCATED}" if truncated else body


async def _map_reduce(chunks: list[str], llm, lang: str) -> str:
    parts = []
    for i, chunk in enumerate(chunks, start=1):
        prompt = f"This is part {i} of {len(chunks)}. Summarize only its key points."
        parts.append(await llm.complete(_ask(chunk, lang, prompt)))
    joined = "\n\n".join(parts)
    return await llm.complete(_ask(joined, lang, _MERGE))


def _system(lang: str) -> str:
    """Perintah bahasa ditaruh PALING AKHIR, dan menyebut heading secara eksplisit.

    Heading contoh di `_FORMAT` berbahasa Inggris; tanpa kalimat ini model rajin
    menyalinnya apa adanya, sehingga ringkasan Jepang berjudul "Summary".
    """
    name = LANGUAGE_BY_ID.get(lang, LANGUAGE_BY_ID[DEFAULT_AI_LANGUAGE])["en_name"]
    return (
        f"{_RULES} Write your entire answer in {name}, including the section "
        f"headings — translate the headings, do not copy them in English."
    )


def _ask(text: str, lang: str, instruction: str = "Summarize the transcript below.") -> list[dict]:
    return [
        {"role": "system", "content": _system(lang)},
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
