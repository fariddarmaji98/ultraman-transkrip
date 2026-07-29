"""Provider Groq: whisper-large-v3-turbo (OpenAI-compatible). Aktif bila GROQ_API_KEY diset."""
import logging
from pathlib import Path

import httpx

from app.config import settings
from asr.base import Segment, TranscriptResult
from constants import LANGUAGE_AUTO, LANGUAGE_BY_ID, LANGUAGE_CODE_BY_NAME

logger = logging.getLogger(__name__)
GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = "whisper-large-v3-turbo"


class GroqProvider:
    def transcribe(self, audio_path, language, on_progress=None):
        data = self._post(audio_path, language)  # satu panggilan; on_progress diabaikan
        # Sama seperti provider lokal: bila bahasanya diminta, form-nya sendiri
        # yang memberi tahu Groq harus mengasumsikan apa — balasannya cuma gema.
        return TranscriptResult(
            segments=[_to_segment(i, s) for i, s in enumerate(data["segments"])],
            language=_lang_code(data.get("language")) if language == LANGUAGE_AUTO else None,
        )

    def _post(self, audio_path: Path, language: str) -> dict:
        form = {"model": GROQ_MODEL, "response_format": "verbose_json"}
        if language != LANGUAGE_AUTO:
            form["language"] = language
        headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
        with audio_path.open("rb") as f:
            resp = httpx.post(
                GROQ_URL, headers=headers, data=form,
                files={"file": f}, timeout=600,
            )
        resp.raise_for_status()
        return resp.json()


def _lang_code(raw) -> str | None:
    """Terima kode ISO maupun nama Inggris; yang tak dikenal jadi None, bukan mentah.

    `verbose_json` ala OpenAI lazimnya mengembalikan NAMA ("indonesian"),
    sedangkan faster-whisper mengembalikan kode ("id"). Bentuk balasan Groq
    belum pernah diverifikasi dengan panggilan sungguhan, jadi keduanya diterima.
    Menulis nilai asing apa adanya akan membuat satu kolom berisi dua kosakata,
    dan `WHERE detected_language='id'` diam-diam melewatkan rekaman Groq.
    """
    if not isinstance(raw, str) or not raw.strip():
        return None
    key = raw.strip().lower()
    code = key if key in LANGUAGE_BY_ID else LANGUAGE_CODE_BY_NAME.get(key)
    if not code:
        logger.warning("bahasa dari Groq tidak dikenal: %r — disimpan kosong", raw)
    return code


def _to_segment(idx: int, s: dict) -> Segment:
    return Segment(
        idx=idx,
        start_ms=int(s["start"] * 1000),
        end_ms=int(s["end"] * 1000),
        text=s["text"].strip(),
    )
