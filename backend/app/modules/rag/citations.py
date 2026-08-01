"""Citations (Part 6.2) — structured, auditable source references for RAG output.

``RetrievalHit`` is the canonical retrieved-item shape produced by the retrieval
service; ``Citation`` is its user-facing projection. Keeping both here avoids a
circular import between retrieval and citation modules.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass

SNIPPET_CHARS = 220


@dataclass(frozen=True)
class RetrievalHit:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    content: str
    score: float
    page: int | None = None
    heading: str | None = None
    bm25_score: float = 0.0
    fused_score: float = 0.0


@dataclass(frozen=True)
class Citation:
    index: int
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    page: int | None = None
    heading: str | None = None
    snippet: str = ""
    score: float = 0.0


class CitationGenerator:
    """Maps ordered retrieval hits to [1..n] citations with inline snippets."""

    def build(self, hits: Sequence[RetrievalHit]) -> list[Citation]:
        return [
            Citation(
                index=position + 1,
                chunk_id=hit.chunk_id,
                document_id=hit.document_id,
                document_name=hit.document_name,
                page=hit.page,
                heading=hit.heading,
                snippet=_snippet(hit.content),
                score=hit.fused_score,
            )
            for position, hit in enumerate(hits)
        ]


def _snippet(content: str) -> str:
    compact = " ".join(content.split())
    return compact[:SNIPPET_CHARS].strip()
