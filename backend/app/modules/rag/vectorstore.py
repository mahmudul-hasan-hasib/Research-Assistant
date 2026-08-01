"""Vector store (Part 6.2 — FAISS default behind a port, Pinecone is the scale path).

Vectors are written with string ids of the form ``<document_id>:<chunk_id>`` so a
document's vectors can be purged by prefix. The FAISS backend stores an
``IndexFlatIP`` (inner product = cosine on normalized vectors) plus a parallel id
registry persisted as a sidecar JSON file (FAISS's ``IndexIDMap`` does not
serialize its id mapping, so the string↔position mapping is kept explicitly). The
in-memory backend is a numpy stand-in for dev/tests.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.core.config import Settings
from app.core.exceptions import ConfigurationError


@dataclass(frozen=True)
class VectorHit:
    id: str
    score: float


class VectorStore(Protocol):
    dims: int

    def add(self, vectors: list[list[float]], ids: list[str]) -> None: ...

    def search(self, vector: list[float], *, top_k: int) -> list[VectorHit]: ...

    def delete(self, ids: list[str]) -> None: ...

    def delete_by_prefix(self, prefix: str) -> None: ...

    def save(self) -> None: ...


class FAISSVectorStore:
    """faiss-cpu ``IndexFlatIP`` + a persisted string-id registry.

    Positions in the flat index double as sequence ids; ``self._ids`` maps each
    position back to its ``<document_id>:<chunk_id>`` string. Deletes rebuild the
    index from the surviving vectors (rare, per-document purge).
    """

    def __init__(self, *, dims: int, index_path: str | Path | None = None) -> None:
        import faiss

        self._faiss = faiss
        self.dims = dims
        self._index_path = Path(index_path) if index_path else None
        self._ids: list[str] = []
        self._vectors: list[list[float]] = []
        self._load()

    def _load(self) -> None:
        if self._index_path is None or not self._index_path.exists():
            self._index = self._faiss.IndexFlatIP(self.dims)
            return
        self._index = self._faiss.read_index(str(self._index_path))
        sidecar = Path(f"{self._index_path}.ids.json")
        if sidecar.exists():
            with sidecar.open("r", encoding="utf-8") as handle:
                self._ids = list(json.load(handle).get("ids", []))
        if len(self._ids) < self._index.ntotal:
            self._ids.extend(
                f"unknown:{position}" for position in range(len(self._ids), self._index.ntotal)
            )
        self._vectors = [
            self._index.reconstruct(position).tolist() for position in range(self._index.ntotal)
        ]

    def add(self, vectors: list[list[float]], ids: list[str]) -> None:
        if not vectors:
            return
        import numpy as np

        array = np.asarray(vectors, dtype="float32")
        if array.ndim != 2 or array.shape[1] != self.dims:
            raise ValueError(f"vectors must be (n, {self.dims})")
        self._index.add(array)
        self._vectors.extend(vectors)
        self._ids.extend(ids)

    def search(self, vector: list[float], *, top_k: int) -> list[VectorHit]:
        import numpy as np

        if self._index.ntotal == 0:
            return []
        query = np.asarray([vector], dtype="float32")
        scores, positions = self._index.search(query, top_k)
        hits: list[VectorHit] = []
        for score, position in zip(scores[0], positions[0]):
            position_int = int(position)
            if position_int < 0 or position_int >= len(self._ids):
                continue
            hits.append(VectorHit(id=self._ids[position_int], score=float(score)))
        return hits

    def delete(self, ids: list[str]) -> None:
        if not ids:
            return
        remove = set(ids)
        keep_ids = [vector_id for vector_id in self._ids if vector_id not in remove]
        keep_vectors = [
            vector for vector_id, vector in zip(self._ids, self._vectors) if vector_id not in remove
        ]
        self._ids = keep_ids
        self._vectors = keep_vectors
        import numpy as np

        if keep_vectors:
            rebuilt = self._faiss.IndexFlatIP(self.dims)
            rebuilt.add(np.asarray(keep_vectors, dtype="float32"))
            self._index = rebuilt
        else:
            self._index = self._faiss.IndexFlatIP(self.dims)

    def delete_by_prefix(self, prefix: str) -> None:
        self.delete([vector_id for vector_id in self._ids if vector_id.startswith(prefix)])

    def save(self) -> None:
        if self._index_path is None:
            return
        self._index_path.parent.mkdir(parents=True, exist_ok=True)
        self._faiss.write_index(self._index, str(self._index_path))
        with Path(f"{self._index_path}.ids.json").open("w", encoding="utf-8") as handle:
            json.dump({"ids": self._ids}, handle)


class InMemoryVectorStore:
    """NumPy cosine store for dev/tests — same contract, no FAISS dependency."""

    def __init__(self, *, dims: int) -> None:
        self.dims = dims
        self._vectors: list[list[float]] = []
        self._ids: list[str] = []

    def add(self, vectors: list[list[float]], ids: list[str]) -> None:
        self._vectors.extend(vectors)
        self._ids.extend(ids)

    def search(self, vector: list[float], *, top_k: int) -> list[VectorHit]:
        import math

        scored: list[VectorHit] = []
        norm_q = math.sqrt(sum(value * value for value in vector)) or 1.0
        for vector_id, other in zip(self._ids, self._vectors):
            dot = sum(a * b for a, b in zip(vector, other))
            norm_o = math.sqrt(sum(value * value for value in other)) or 1.0
            scored.append(VectorHit(id=vector_id, score=dot / (norm_q * norm_o)))
        scored.sort(key=lambda hit: hit.score, reverse=True)
        return scored[:top_k]

    def delete(self, ids: list[str]) -> None:
        remove = set(ids)
        kept = [(i, v) for i, v in zip(self._ids, self._vectors) if i not in remove]
        self._ids = [i for i, _ in kept]
        self._vectors = [v for _, v in kept]

    def delete_by_prefix(self, prefix: str) -> None:
        self.delete([vector_id for vector_id in self._ids if vector_id.startswith(prefix)])

    def save(self) -> None:
        return


def build_vector_store(settings: Settings) -> VectorStore:
    key = settings.vector_store_backend.strip().lower()
    if key == "faiss":
        return FAISSVectorStore(
            dims=settings.embedding_dimensions,
            index_path=Path(settings.vector_index_dir) / "index.faiss",
        )
    if key == "memory":
        return InMemoryVectorStore(dims=settings.embedding_dimensions)
    raise ConfigurationError(
        f"Unknown vector store backend {settings.vector_store_backend!r}; "
        "expected 'faiss' or 'memory'"
    )
