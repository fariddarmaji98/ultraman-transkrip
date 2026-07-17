"""Seam AI (M2+) — kontrak LLM & embedding. Belum diimplementasi; menjaga layer siap AI.

Sengaja hanya interface: summarize/chat/RAG menyusul (lihat docs/planning §5). Ini titik
tempel yang dijanjikan agar penambahan AI = adapter baru, bukan refactor.
"""
from typing import Iterator, Protocol


class LLMProvider(Protocol):
    def complete(
        self, messages: list[dict], stream: bool = False
    ) -> str | Iterator[str]:
        ...


class EmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...
