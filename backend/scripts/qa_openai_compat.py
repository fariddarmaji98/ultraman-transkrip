"""Tes cepat untuk parser response OpenAI-compatible.

Jalankan dari `backend/` dengan venv aktif:
    python scripts/qa_openai_compat.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analysis.openai_compat import _safe_json


class _FakeResponse:
    def __init__(self, text: str):
        self._text = text

    @property
    def text(self) -> str:
        return self._text

    def json(self):
        return json.loads(self._text)


def main() -> None:
    # 1. JSON normal
    assert _safe_json(_FakeResponse('{"choices":[]}')) == {"choices": []}

    # 2. Dua JSON menempel (proxy error concat)
    dup = '{"error":{"message":"429","code":"x"}}{"error":{"message":"second","code":"y"}}'
    assert _safe_json(_FakeResponse(dup)) == {"error": {"message": "429", "code": "x"}}

    # 3. Array JSON valid
    assert _safe_json(_FakeResponse('[{"id":"a"},{"id":"b"}]')) == [{"id": "a"}, {"id": "b"}]

    # 4. Body kosong harus raise
    try:
        _safe_json(_FakeResponse(""))
        raise AssertionError("body kosong harus raise ValueError")
    except ValueError:
        pass

    # 5. Body non-JSON harus raise
    try:
        _safe_json(_FakeResponse("<html>error</html>"))
        raise AssertionError("body HTML harus raise ValueError")
    except ValueError:
        pass

    print("openai_compat parser: OK")


if __name__ == "__main__":
    main()
