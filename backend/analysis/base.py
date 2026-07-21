"""Seam AI (M2+) — kontrak LLM & embedding.

Sengaja tipis: menambah mesin AI = adapter baru, bukan refactor pemanggil.
Streaming menyusul bersama chat (M3); sekarang ringkasan cukup sekali balas.
"""
from typing import Protocol


class LLMProvider(Protocol):
    async def complete(self, messages: list[dict]) -> str:
        ...


class EmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...
