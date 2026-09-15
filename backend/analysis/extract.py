"""Ekstrak keputusan / kebutuhan / batasan / pertanyaan-terbuka dari transkrip.

Ini saudara terstruktur dari `summarize.py` (ADR 0013): sama-sama map-reduce di
atas `LLMProvider`, tapi balikannya JSON tervalidasi dengan jejak `at_ms` — untuk
dikonsumsi agent/generator sebagai context membangun project, bukan prosa untuk
dibaca manusia.

Beda penting dari ringkasan: penggabungan potongan TANPA panggilan LLM kedua.
Array JSON bisa di-union secara mekanis lalu diurutkan per `at_ms`; tidak ada
prosa yang harus dirangkum ulang. Lebih murah dan deterministik.

Baris transkrip diberi format `{start_ms}| {text}` — model menyalin integer
`at_ms` apa adanya, bukan mengonversi `[mm:ss]` (konversi mengundang error
off-by-one yang persis dihindari ADR 0013 keputusan 4).
"""
import json
import re

from pydantic import BaseModel, Field, ValidationError

from analysis.openai_compat import LLMError
from constants import (
    DEFAULT_AI_LANGUAGE,
    EXTRACT_CATEGORIES,
    EXTRACT_CHUNK_CHARS,
    EXTRACT_MAX_CHUNKS,
    LANGUAGE_BY_ID,
)

_RULES = (
    "You extract structured facts from a recording transcript to be used as "
    "context for building a project. Every item must come from the transcript; "
    "invent nothing. Output ONLY valid JSON with exactly these five keys and no "
    "others: \"decisions\", \"requirements\", \"constraints\", \"open_questions\", "
    "and \"topics\". The first four map to arrays of objects with \"text\" (string) "
    "and \"at_ms\" (integer). \"topics\" is an array of 2-4 short lowercase tags "
    "(letters, digits, hyphen only) describing what the recording is about — the "
    "theme, not every noun mentioned. An empty category is an empty array — that "
    "is a valid answer, not a failure. No markdown fences, no commentary."
)

_FORMAT = (
    "Lines are transcript segments formatted as `at_ms| text`. `at_ms` is the "
    "exact integer before the `|` on the line where the item appears — copy it "
    "exactly, never compute or change it.\n"
    "- decisions: things that were decided or settled.\n"
    "- requirements: things requested or needed (features, deliverables).\n"
    "- constraints: limits, tech-stack choices, deadlines, policies.\n"
    "- open_questions: things still undecided or unresolved.\n"
    "If nothing fits a category, output an empty array for it."
)

_TRUNCATED = (
    "Catatan: transkrip terlalu panjang untuk diekstrak seluruhnya — hasil ini "
    "hanya mencakup bagian awal rekaman."
)


class ExtractItem(BaseModel):
    """Satu item ekstraksi. `at_ms` divalidasi non-negatif; rentang terhadap
    durasi diverifikasi terpisah oleh pemanggil (yang tahu durasinya)."""

    text: str = Field(min_length=1)
    at_ms: int = Field(ge=0)


class ExtractData(BaseModel):
    """Empat kategori kunci ekstraksi + topik. Kategori hilang di-backfill `[]` oleh
    pydantic — itu jawaban sah, bukan error; item rusak = ValidationError.

    `topics` = auto-tag LLM (ADR 0018): 0–4 tag pendek lowercase, dibersihkan
    dari karakter asing di validator — bukan alasan gagal."""
    decisions: list[ExtractItem] = []
    requirements: list[ExtractItem] = []
    constraints: list[ExtractItem] = []
    open_questions: list[ExtractItem] = []
    topics: list[str] = []

    @staticmethod
    def sanitize_topics(raw: list) -> list[str]:
        """Tag wajar: lowercase, huruf-angka-hyfen, maks 32 char, maks 4 buah.
        Tag menyimpang dibuang, bukan menggagalkan ekstraksi — topik adalah
        pelengkap, bukan kontrak inti."""
        out: list[str] = []
        for t in raw:
            if not isinstance(t, str):
                continue
            tag = t.strip().lower()[:32]
            if tag and all(c.isalnum() or c == "-" for c in tag) and tag not in out:
                out.append(tag)
        return out[:4]

    def items(self, category: str) -> list[ExtractItem]:
        return getattr(self, category)

    def all_items(self) -> list[ExtractItem]:
        return [i for c in EXTRACT_CATEGORIES for i in self.items(c)]


async def extract(segments, llm, lang: str = DEFAULT_AI_LANGUAGE) -> tuple[ExtractData, bool]:
    """`llm` = provider hasil `analysis.get_llm()`; balikkan (data, terpotong)."""
    lines = [f"{s.start_ms}| {s.text}" for s in segments if s.text]
    if not lines:
        raise LLMError("transkrip kosong — tidak ada yang bisa diekstrak")
    chunks, truncated = _split("\n".join(lines))
    merged: dict[str, list[ExtractItem]] = {c: [] for c in EXTRACT_CATEGORIES}
    topics: list[str] = []
    for chunk in chunks:
        data = _parse(await llm.complete(_ask(chunk, lang)))
        for cat in EXTRACT_CATEGORIES:
            merged[cat].extend(data.items(cat))
        for t in data.topics:
            if t not in topics:
                topics.append(t)
    for cat in EXTRACT_CATEGORIES:
        merged[cat] = _dedup(merged[cat])
    return ExtractData(topics=topics[:4], **merged), truncated


def _parse(raw: str) -> ExtractData:
    """Balikan LLM → `ExtractData`. Gagal = LLMError, tidak pernah senyap."""
    cleaned = _strip_fences(raw)
    try:
        obj = json.loads(cleaned)
    except ValueError as exc:
        raise LLMError("format balikan LLM tidak berupa JSON") from exc
    if not isinstance(obj, dict):
        raise LLMError("format balikan LLM tidak berupa objek JSON")
    # Kunci asing tidak boleh lolos diam-diam: ekstraksi yang membawa kategori
    # tak dikenal adalah gejala prompt menyimpang, bukan data yang layak dipakai.
    unknown = set(obj) - set(EXTRACT_CATEGORIES) - {"topics"}
    if unknown:
        raise LLMError(f"kategori tak dikenal dari LLM: {sorted(unknown)}")
    obj["topics"] = ExtractData.sanitize_topics(obj.get("topics") or [])
    try:
        return ExtractData.model_validate(obj)
    except ValidationError as exc:
        raise LLMError("item ekstraksi tidak valid dari LLM") from exc


def _strip_fences(raw: str) -> str:
    """Toleransi ringan: ```json ... ``` atau teks penyerta di luar kurung."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        return text.strip()
    # Model kadang menaruh JSON di tengah kalimat. Ambil objek terluar pertama.
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return text[start:end + 1]
    return text


def _dedup(items: list[ExtractItem]) -> list[ExtractItem]:
    """Union potongan bisa menghasilkan duplikat (item sama disebut di 2 blok)."""
    seen: set[tuple[int, str]] = set()
    out: list[ExtractItem] = []
    for it in sorted(items, key=lambda i: i.at_ms):
        key = (it.at_ms, it.text.strip())
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


def _system(lang: str) -> str:
    name = LANGUAGE_BY_ID.get(lang, LANGUAGE_BY_ID[DEFAULT_AI_LANGUAGE])["en_name"]
    return f"{_RULES} Write the \"text\" values in {name}."


def _ask(text: str, lang: str) -> list[dict]:
    return [
        {"role": "system", "content": _system(lang)},
        {"role": "user", "content": f"{_FORMAT}\n\n---\n{text}"},
    ]


def _split(text: str) -> tuple[list[str], bool]:
    """Potong per baris supaya segmen tidak terbelah (pola summarize._split)."""
    chunks, buf = [], ""
    for line in text.splitlines():
        if len(buf) + len(line) + 1 > EXTRACT_CHUNK_CHARS and buf:
            chunks.append(buf)
            buf = ""
        buf += line + "\n"
    if buf.strip():
        chunks.append(buf)
    if not chunks:
        return [text[:EXTRACT_CHUNK_CHARS]], False
    return chunks[:EXTRACT_MAX_CHUNKS], len(chunks) > EXTRACT_MAX_CHUNKS
