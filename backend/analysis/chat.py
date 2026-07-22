"""Tanya-jawab dengan transkrip, jawaban wajib menyertakan sitasi [mm:ss].

Transkrip yang tidak muat dikirim sebagian: potongan yang paling cocok dengan
kata-kata pertanyaan. Pemilihannya sengaja sederhana (pencocokan kata, bukan
embedding) — pgvector menyusul saat library rekaman sudah besar.
"""
import re

from analysis.openai_compat import LLMError
from constants import CHAT_BLOCK_LINES, CHAT_CONTEXT_CHARS

_SYSTEM = (
    "Kamu menjawab pertanyaan HANYA berdasarkan transkrip di bawah. "
    "Setiap klaim wajib diikuti sitasi waktu dalam format [mm:ss] yang benar-benar "
    "ada di transkrip. Bila jawabannya tidak ada di sana, katakan terus terang bahwa "
    "transkrip tidak menyebutkannya — jangan mengarang dan jangan memakai pengetahuan luar. "
    "Jawab dalam bahasa Indonesia yang ringkas."
)
_PARTIAL = (
    "\n\n(Catatan: yang diberikan hanya potongan transkrip yang paling relevan, "
    "bukan keseluruhan. Bila pertanyaannya menyangkut bagian lain, katakan begitu.)"
)


async def ask(question: str, segments, history, llm) -> str:
    """`history` = pesan lama terurut lama→baru; `llm` dari `analysis.get_llm()`."""
    if not segments:
        raise LLMError("belum ada transkrip untuk ditanyai")
    context, partial = _context(question, segments)
    system = f"{_SYSTEM}{_PARTIAL if partial else ''}\n\nTranskrip:\n{context}"
    messages = [{"role": "system", "content": system}]
    messages += [{"role": m.role, "content": m.text} for m in history]
    messages.append({"role": "user", "content": question})
    return await llm.complete(messages)


def _context(question: str, segments) -> tuple[str, bool]:
    lines = [f"[{_stamp(s.start_ms)}] {s.text}" for s in segments if s.text]
    whole = "\n".join(lines)
    if len(whole) <= CHAT_CONTEXT_CHARS:
        return whole, False
    return _relevant(question, lines), True


def _relevant(question: str, lines: list[str]) -> str:
    """Ambil blok paling cocok sampai anggaran habis, lalu urutkan lagi kronologis."""
    blocks = _blocks(lines)
    wanted = _words(question)
    picked, size = [], 0
    for idx, text in sorted(blocks, key=lambda b: -_score(b[1], wanted)):
        if size + len(text) > CHAT_CONTEXT_CHARS:
            continue
        picked.append((idx, text))
        size += len(text)
    picked.sort(key=lambda b: b[0])
    return "\n[…]\n".join(text for _, text in picked)


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
