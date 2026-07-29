"""Terjemahkan segmen transkrip tanpa merusak pemetaannya ke timestamp.

Tiap segmen terikat waktu, jadi terjemahannya harus tetap satu-lawan-satu. Tiga
cara yang mungkin, dan hanya satu yang benar:

- satu panggilan per segmen → pemetaan aman, tapi tanpa konteks hasilnya buruk
  dan ratusan panggilan itu lambat serta mahal;
- seluruh transkrip sebagai satu teks → kualitas terbaik, pemetaan hilang;
- **blok bernomor** → konteks cukup, pemetaan terjaga. Ini yang dipakai.

Verifikasinya bukan kehati-hatian berlebih. Model gemar MENGGABUNGKAN dua baris
pendek jadi satu kalimat yang lebih enak dibaca; begitu itu terjadi, seluruh sisa
blok bergeser satu nomor dan terjemahan menit 5 menempel di menit 6 sampai akhir
blok — tanpa satu pun error, sampai ada yang mengklik sitasi.
"""
import re

from constants import (
    DEFAULT_AI_LANGUAGE,
    LANGUAGE_BY_ID,
    TRANSLATE_BLOCK_SEGMENTS,
    TRANSLATE_MIN_BLOCK,
)

_LINE = re.compile(r"^\s*(\d+)\s*\|\s*(.*)$")

_RULES = (
    "You translate lines of a recording transcript. These rules must not be broken:\n"
    "- Output exactly one numbered line for every input line, in the same order.\n"
    "- Keep the `N| ` prefix and reuse the SAME number as the input line.\n"
    "- NEVER merge two input lines into one, and never split one into two, even if "
    "the result would read better. Each number maps to a timestamp in a recording; "
    "merging shifts every following line onto the wrong moment.\n"
    "- A line that is only a fragment stays a fragment. Do not complete it.\n"
    "- Translate only. No notes, no explanations, no quotes around the text."
)


async def translate_segments(texts, llm, lang, source=None, on_progress=None) -> list[str]:
    """Balikkan daftar sepanjang `texts` — urutan dan jumlahnya dijamin sama.

    `on_progress` di-**await** (beda dari `ASRProvider.transcribe` yang sinkron
    karena hidup di thread): di sini semuanya sudah di event loop, jadi pemanggil
    bisa menulis progres ke DB langsung tanpa poller.
    """
    out: list[str] = []
    for start in range(0, len(texts), TRANSLATE_BLOCK_SEGMENTS):
        block = texts[start : start + TRANSLATE_BLOCK_SEGMENTS]
        out += await _block(block, llm, lang, source, start)
        if on_progress:
            await on_progress(len(out))
    return out


async def _block(texts, llm, lang, source, offset: int) -> list[str]:
    """Satu blok; bila penomorannya tidak utuh, pecah dua dan coba lagi."""
    if not texts:
        return []
    if len(texts) <= TRANSLATE_MIN_BLOCK:
        # Satu baris tidak perlu penomoran, dan penomoran di sini cuma menambah
        # satu cara lagi untuk gagal — plus satu panggilan sia-sia sebelum
        # jatuh ke jalur ini juga. Langsung saja.
        return [await _one(t, llm, lang) for t in texts]
    raw = await llm.complete(_ask(texts, lang, source, offset))
    got = _parse(raw, offset, len(texts))
    if got:
        return got
    half = len(texts) // 2
    return await _block(texts[:half], llm, lang, source, offset) + await _block(
        texts[half:], llm, lang, source, offset + half
    )


def _parse(raw: str, offset: int, n: int) -> list[str] | None:
    """None = penomorannya tidak utuh, jadi blok ini tidak boleh dipakai."""
    found: dict[int, str] = {}
    cur = None
    for line in raw.splitlines():
        m = _LINE.match(line)
        if m:
            cur = int(m.group(1))
            found[cur] = m.group(2).strip()
        elif cur is not None and line.strip():
            # Baris sambungan (model membungkus kalimat panjang) — disambung ke
            # nomor terakhir, bukan dibuang, supaya teksnya tidak hilang diam-diam.
            found[cur] = f"{found[cur]} {line.strip()}".strip()
    wanted = range(offset, offset + n)
    if any(not found.get(i) for i in wanted):
        return None
    return [found[i] for i in wanted]


def _ask(texts, lang: str, source, offset: int) -> list[dict]:
    numbered = "\n".join(f"{offset + i}| {t}" for i, t in enumerate(texts))
    last = offset + len(texts) - 1
    return [
        {"role": "system", "content": _system(lang, source, offset, last)},
        {"role": "user", "content": numbered},
    ]


def _system(lang: str, source, offset: int, last: int) -> str:
    """Perintah bahasa & rentang nomor ditaruh paling akhir — itu yang paling dipatuhi."""
    name = _name(lang)
    asal = f" The source lines are in {_name(source)}." if source else ""
    return (
        f"{_RULES}\n\n{asal} Translate into {name}. "
        f"Output line numbers {offset} through {last} — all of them, and nothing else."
    )


def _name(lang: str) -> str:
    return LANGUAGE_BY_ID.get(lang, LANGUAGE_BY_ID[DEFAULT_AI_LANGUAGE])["en_name"]


async def _one(text: str, llm, lang: str) -> str:
    """Jalan terakhir untuk satu segmen: tanpa penomoran, tidak ada yang bisa bergeser."""
    messages = [
        {
            "role": "system",
            "content": f"Translate the user's text into {_name(lang)}. "
            "Reply with the translation only — no notes, no quotes. "
            "If it is a fragment, keep it a fragment.",
        },
        {"role": "user", "content": text},
    ]
    return (await llm.complete(messages)).strip()
