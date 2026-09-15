"""Embedding provider + index pencarian semantic lintas-rekaman (Fase 3, ADR 0019).

Menutup janji `EmbeddingProvider` (stub sejak ADR 0009): pencarian context lama
dari library — "keputusan soal database sepanjang 3 meeting terakhir?" dijawab
dari arsip, bukan satu rekaman.

Desain (sederhana by design — skala user tunggal):
- Provider: Ollama `/api/embed` (nomic-embed-text default, lokal & gratis).
  Satu jalur `embed()` — ganti provider = kelas baru memenuhi Protocol.
- Unit index = SATU EXTRACT ITEM (bukan segmen): item context adalah butir
  yang dicari agent ("apa keputusan soal X"), segmen hanya pendukungnya.
- Simpan: JSONL di data/embeddings.jsonl — {id, recording_id, lang, category,
  at_ms, text, vector}. Load ke memori saat start; append saat ekstraksi baru.
  Ratusan ribu item × 768 float masih wajar di RAM untuk skala ini; kalau
  membesar, baru pindah ke pgvector (pola "jangan bawa dependensi sebelum
  volume membenarkan" — ADR 0013).
- Pencarian: cosine similarity brute-force di NumPy — akurat dan cukup cepat
  untuk ribuan item; ANN (hnswlib) menyusul kalau profilnya berat.
- Label filter (ADR 0018) di DEPAN pencarian: label menyaring ruang dulu
  (murat, deterministik), embedding memeringkat di dalamnya.
"""
import json
from pathlib import Path
from typing import Protocol

import numpy as np
from loguru import logger

from app.config import settings


class EmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...


class OllamaEmbeddings:
    """Ollama /api/embed — lokal, gratis, tanpa kunci. Batch per 32 teks."""

    def __init__(self, model: str = "nomic-embed-text", base_url: str = "http://127.0.0.1:11434"):
        self.model = model
        self.base_url = base_url

    def embed(self, texts: list[str]) -> list[list[float]]:
        import httpx

        out: list[list[float]] = []
        for i in range(0, len(texts), 32):
            batch = texts[i:i + 32]
            res = httpx.post(
                f"{self.base_url}/api/embed",
                json={"model": self.model, "input": batch}, timeout=120,
            )
            res.raise_for_status()
            out.extend(res.json()["embeddings"])
        return out


class EmbeddingIndex:
    """Index in-memory + persist JSONL. Idempoten per (recording_id, lang)."""

    def __init__(self, path: Path | None = None):
        self.path = path or (settings.data_dir / "embeddings.jsonl")
        self.items: list[dict] = []          # metadata per item
        self._vectors: np.ndarray | None = None  # matrix (n, dim), sinkron items
        self._load()

    # --- lifecycle ---------------------------------------------------------

    def _load(self) -> None:
        if not self.path.exists():
            return
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                self.items.append(json.loads(line))
            except ValueError:
                logger.warning("baris embedding rusak dilewati: {}", line[:60])
        if self.items:
            self._vectors = np.array([it["vector"] for it in self.items], dtype=np.float32)
            for it in self.items:
                it.pop("vector", None)  # vector hidup di matrix, bukan per item
            self._normalize()
            logger.info("index embedding: {} item dimuat", len(self.items))

    def _persist_append(self, entries: list[dict]) -> None:
        with self.path.open("a", encoding="utf-8") as f:
            for e in entries:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")

    def _normalize(self) -> None:
        norms = np.linalg.norm(self._vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        self._vectors = self._vectors / norms

    # --- penulisan ---------------------------------------------------------

    def index_extract(self, recording_id: int, lang: str, payload: dict,
                      labels: list[str], provider: EmbeddingProvider) -> int:
        """Index satu extract (4 kategori). Extract lama rekaman+bahasa yang sama
        dibuang dulu — 'buat ulang' tidak boleh menggandakan item."""
        from constants import EXTRACT_CATEGORIES

        self.drop(recording_id, lang)
        entries: list[dict] = []
        for cat in EXTRACT_CATEGORIES:
            for it in payload.get(cat, []):
                entries.append({
                    "recording_id": recording_id, "lang": lang, "category": cat,
                    "at_ms": it["at_ms"], "text": it["text"], "labels": labels,
                })
        if not entries:
            return 0
        vectors = provider.embed([e["text"] for e in entries])
        persist = [{**e, "vector": v} for e, v in zip(entries, vectors)]
        self._persist_append(persist)
        new = np.array(vectors, dtype=np.float32)
        self._vectors = new if self._vectors is None else np.vstack([self._vectors, new])
        for e in entries:
            self.items.append(e)
        self._normalize()
        return len(entries)

    def drop(self, recording_id: int, lang: str | None = None) -> None:
        """Buang item rekaman (semua bahasa, atau satu) dari memori + file."""
        keep = [
            (it, i) for i, it in enumerate(self.items)
            if not (it["recording_id"] == recording_id
                    and (lang is None or it["lang"] == lang))
        ]
        if len(keep) == len(self.items):
            return
        self.items = [it for it, _ in keep]
        if self._vectors is not None and keep:
            self._vectors = self._vectors[[i for _, i in keep]]
        elif not keep:
            self._vectors = None
        self._rewrite_file()
        logger.info("index embedding: item recording={} (lang={}) dihapus", recording_id, lang or "*")

    def _rewrite_file(self) -> None:
        """Tulis ulang seluruh file (dipakai drop — JSONL append tak bisa menghapus)."""
        if self._vectors is None:
            self.path.write_text("", encoding="utf-8")
            return
        with self.path.open("w", encoding="utf-8") as f:
            for it, vec in zip(self.items, self._vectors):
                f.write(json.dumps({**it, "vector": vec.tolist()}, ensure_ascii=False) + "\n")

    # --- pencarian ---------------------------------------------------------

    def search(self, query: str, provider: EmbeddingProvider, limit: int = 8,
               label: str | None = None, category: str | None = None) -> list[dict]:
        """Cari item context paling mirip query. Label & kategori menyaring
        DULU (ruang kecil, deterministik), lalu cosine memeringkat."""
        if not self.items or self._vectors is None:
            return []
        q = np.array(provider.embed([query])[0], dtype=np.float32)
        q = q / (np.linalg.norm(q) or 1.0)
        pool_idx = [
            i for i, it in enumerate(self.items)
            if (label is None or label in it.get("labels", []))
            and (category is None or it["category"] == category)
        ]
        if not pool_idx:
            return []
        sims = self._vectors[pool_idx] @ q
        top = sorted(zip(pool_idx, sims), key=lambda p: -p[1])[:limit]
        return [
            {**self.items[i], "score": round(float(s), 4)}
            for i, s in top
        ]


# singleton — dipakai route extract & MCP
_index: EmbeddingIndex | None = None


def get_index() -> EmbeddingIndex:
    global _index
    if _index is None:
        _index = EmbeddingIndex()
    return _index


def get_embeddings() -> OllamaEmbeddings:
    return OllamaEmbeddings()
