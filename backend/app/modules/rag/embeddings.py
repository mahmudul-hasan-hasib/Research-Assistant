"""Embedding service (Part 6.2 — sentence-transformers behind a port).

``SentenceTransformerEmbedder`` runs a local sentence-transformers model (private
+ free at inference; the model is loaded lazily on first use and cached so app boot
never downloads weights). ``HashingEmbedder`` is a deterministic, dependency-free
stand-in for dev/tests — it maps token overlap into cosine space so retrieval flow
is testable without a model download. Selection is config-only (P2/P8).
"""

from __future__ import annotations

import math
import re
from typing import Any, Protocol

from app.core.config import Settings
from app.core.exceptions import ConfigurationError

_MODEL_CACHE: dict[str, Any] = {}
_WORD_RE = re.compile(r"\w+")


class Embedder(Protocol):
    dims: int

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class SentenceTransformerEmbedder:
    """Local sentence-transformers embedding model (lazy-loaded, cached)."""

    def __init__(self, *, model_name: str, dims: int = 384) -> None:
        self.model_name = model_name
        self.dims = dims

    def _model(self) -> Any:
        cached = _MODEL_CACHE.get(self.model_name)
        if cached is None:
            from sentence_transformers import SentenceTransformer

            cached = SentenceTransformer(self.model_name)
            _MODEL_CACHE[self.model_name] = cached
        return cached

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._model().encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32,
        )
        result: list[list[float]] = []
        for vector in vectors:
            row = [float(value) for value in vector]
            if len(row) != self.dims:
                raise ConfigurationError(
                    f"Embedding model {self.model_name!r} produced {len(row)} "
                    f"dimensions but EMBEDDING_DIMENSIONS={self.dims}"
                )
            result.append(row)
        return result


class HashingEmbedder:
    """Deterministic pseudo-random embedding for dev/tests.

    Each token contributes a fixed seeded unit vector; summing gives vectors whose
    cosine similarity tracks lexical overlap — enough to exercise retrieval and
    citation flow deterministically and offline.
    """

    def __init__(self, *, dims: int = 384) -> None:
        self.dims = dims

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    def _embed(self, text: str) -> list[float]:
        import random

        vector = [0.0] * self.dims
        for token in _WORD_RE.findall(text.lower()):
            rng = random.Random(token)
            for i in range(self.dims):
                vector[i] += rng.uniform(-1.0, 1.0)
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]


def build_embedder(settings: Settings) -> Embedder:
    key = settings.embedding_provider.strip().lower()
    if key == "sentence_transformers":
        return SentenceTransformerEmbedder(
            model_name=settings.embedding_model,
            dims=settings.embedding_dimensions,
        )
    if key == "memory":
        return HashingEmbedder(dims=settings.embedding_dimensions)
    raise ConfigurationError(
        f"Unknown embedding provider {settings.embedding_provider!r}; "
        "expected 'sentence_transformers' or 'memory'"
    )
