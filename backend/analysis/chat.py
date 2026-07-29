"""Tanya-jawab dengan transkrip, jawaban wajib menyertakan sitasi [mm:ss].

Transkrip yang tidak muat dikirim sebagian: potongan yang paling cocok dengan
kata-kata pertanyaan. Pemilihannya sengaja sederhana (pencocokan kata, bukan
embedding) — pgvector menyusul saat library rekaman sudah besar.

Konteks yang dikirim SELALU transkrip asli, apa pun bahasa jawabannya, supaya
sitasi `[mm:ss]` menunjuk rekaman yang sungguhan.
"""
import re

from analysis.openai_compat import LLMError
from constants import (
    CHAT_BLOCK_LINES,
    CHAT_CONTEXT_CHARS,
    DEFAULT_AI_LANGUAGE,
    LANGUAGE_BY_ID,
)

# Bahasa Inggris dengan sengaja — alasannya sama seperti di `summarize.py`.
# Aturan sitasi ditulis tegas "jangan diterjemahkan": saat diminta menjawab
# dalam bahasa Jepang, model gemar melokalkan angka dan tanda kurungnya, dan
# begitu formatnya berubah sitasi berhenti bisa diklik tanpa satu pun error.
_RULES = (
    "Answer ONLY from the transcript below. Every claim must be followed by a "
    "timestamp citation in the exact format [mm:ss] that actually appears in the "
    "transcript. Copy the brackets and digits exactly — never translate, localize, "
    "or reformat them. If the answer is not in the transcript, say plainly that "
    "the transcript does not mention it; do not invent anything and do not use "
    "outside knowledge. Keep the answer concise."
)

_PARTIAL_RELEVANT = (
    " (Note: you were given only the excerpts of the transcript that best match "
    "the question, not the whole thing. If the question concerns another part, say so.)"
)
# Dibedakan dari yang di atas karena keadaannya memang berbeda, dan mendiamkannya
# adalah kegagalan senyap: pada bahasa tanpa spasi (Jepang, Mandarin, Thai)
# pencocokan kata tidak pernah menghasilkan irisan, sehingga yang terkirim
# sebenarnya AWAL transkrip — bukan bagian yang paling relevan.
_PARTIAL_HEAD = (
    " (Note: none of the question's words matched the transcript, so you were "
    "given the BEGINNING of the recording only, not the most relevant part. If the "
    "answer is not in this excerpt, say it may lie in a later part you cannot see.)"
)


async def ask(question: str, segments, history, llm, lang: str = DEFAULT_AI_LANGUAGE) -> str:
    """`history` = pesan lama terurut lama→baru; `llm` dari `analysis.get_llm()`."""
    if not segments:
        raise LLMError("belum ada transkrip untuk ditanyai")
    context, partial = _context(question, segments)
    system = f"{_system(lang, partial)}\n\nTranscript:\n{context}"
    messages = [{"role": "system", "content": system}]
    messages += [{"role": m.role, "content": m.text} for m in history]
    messages.append({"role": "user", "content": question})
    return await llm.complete(messages)


def _system(lang: str, partial: str | None) -> str:
    """Perintah bahasa paling akhir — instruksi terakhirlah yang paling dipatuhi."""
    name = LANGUAGE_BY_ID.get(lang, LANGUAGE_BY_ID[DEFAULT_AI_LANGUAGE])["en_name"]
    notes = {"relevant": _PARTIAL_RELEVANT, "head": _PARTIAL_HEAD}
    return (
        f"{_RULES}{notes.get(partial, '')} Write your entire answer in {name}, "
        f"except the [mm:ss] citations, which stay exactly as they appear."
    )


def _context(question: str, segments) -> tuple[str, str | None]:
    lines = [f"[{_stamp(s.start_ms)}] {s.text}" for s in segments if s.text]
    whole = "\n".join(lines)
    if len(whole) <= CHAT_CONTEXT_CHARS:
        return whole, None
    return _relevant(question, lines)


def _relevant(question: str, lines: list[str]) -> tuple[str, str]:
    """Ambil blok paling cocok sampai anggaran habis, lalu urutkan lagi kronologis."""
    wanted = _words(question)
    scored = [(_score(text, wanted), idx, text) for idx, text in _blocks(lines)]
    picked, size = [], 0
    for _, idx, text in sorted(scored, key=lambda b: -b[0]):
        if size + len(text) > CHAT_CONTEXT_CHARS:
            continue
        picked.append((idx, text))
        size += len(text)
    picked.sort()
    # Nol untuk SEMUA blok berarti urutan aslinya bertahan (`sorted` stabil),
    # jadi yang terambil adalah awal transkrip. Katakan begitu, jangan mengklaim
    # "paling relevan" — itu tepat yang terjadi pada bahasa tanpa spasi.
    kind = "relevant" if any(score for score, _, _ in scored) else "head"
    return "\n[…]\n".join(text for _, text in picked), kind


def _blocks(lines: list[str]) -> list[tuple[int, str]]:
    return [
        (i, "\n".join(lines[i : i + CHAT_BLOCK_LINES]))
        for i in range(0, len(lines), CHAT_BLOCK_LINES)
    ]


def _score(text: str, wanted: set[str]) -> int:
    return len(wanted & _words(text))


def _words(text: str) -> set[str]:
    """Kata >3 huruf saja — kata pendek (yang, dan, itu) tidak membedakan apa pun."""
    return {w for w in re.findall(r"\w+", text.lower()) if len(w) > 3}


def _stamp(ms: int) -> str:
    total = ms // 1000
    return f"{total // 60:02d}:{total % 60:02d}"
