"""Provider Groq: whisper-large-v3-turbo (OpenAI-compatible). Aktif bila GROQ_API_KEY diset."""
from pathlib import Path

import httpx

from app.config import settings
from asr.base import Segment

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = "whisper-large-v3-turbo"


class GroqProvider:
    def transcribe(self, audio_path: Path, language: str) -> list[Segment]:
        data = self._post(audio_path, language)
        return [_to_segment(i, s) for i, s in enumerate(data["segments"])]

    def _post(self, audio_path: Path, language: str) -> dict:
        form = {"model": GROQ_MODEL, "response_format": "verbose_json"}
        if language != "auto":
            form["language"] = language
        headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
        with audio_path.open("rb") as f:
            resp = httpx.post(
                GROQ_URL, headers=headers, data=form,
                files={"file": f}, timeout=600,
            )
        resp.raise_for_status()
        return resp.json()


def _to_segment(idx: int, s: dict) -> Segment:
    return Segment(
        idx=idx,
        start_ms=int(s["start"] * 1000),
        end_ms=int(s["end"] * 1000),
        text=s["text"].strip(),
    )
