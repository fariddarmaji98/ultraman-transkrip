"""Adapter LLM lewat jalur OpenAI-compatible (`/chat/completions`) via httpx.

Satu adapter melayani Ollama lokal, Groq, DeepSeek, Claude, dan OpenAI — yang
berbeda hanya base_url + kunci. Menambah provider = entri di `constants`.
"""
import httpx

from constants import LLM_TIMEOUT_S


class LLMError(RuntimeError):
    """Gagal menghubungi / dijawab error oleh provider LLM."""


class OpenAICompatProvider:
    def __init__(self, base_url: str, model: str, api_key: str = "",
                 timeout: int = LLM_TIMEOUT_S):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.timeout = timeout

    async def complete(self, messages: list[dict]) -> str:
        data = await self._chat({"model": self.model, "messages": messages})
        return _content_of(data)

    async def ping(self) -> None:
        """Panggilan kecil untuk memastikan base_url, kunci, dan model benar."""
        await self._chat({
            "model": self.model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        })

    async def _chat(self, body: dict) -> dict:
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        url = f"{self.base_url}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(url, json=body, headers=headers)
        except httpx.HTTPError as exc:
            raise LLMError(f"tidak bisa menghubungi {self.base_url}") from exc
        if res.status_code >= 400:
            raise LLMError(_error_of(res))
        return res.json()


def _error_of(res: httpx.Response) -> str:
    """Pesan provider bila ada; kalau tidak, kode HTTP yang sudah diterjemahkan."""
    fallback = f"HTTP {res.status_code}"
    if res.status_code in (401, 403):
        fallback += " — kunci API ditolak provider"
    elif res.status_code == 404:
        fallback += " — model tidak ditemukan di provider ini"
    try:
        err = res.json().get("error")
    except ValueError:
        return fallback
    if isinstance(err, dict):
        return err.get("message") or fallback
    return str(err) if err else fallback


def _content_of(data: dict) -> str:
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError, AttributeError) as exc:
        raise LLMError("respons LLM tidak sesuai format OpenAI") from exc
