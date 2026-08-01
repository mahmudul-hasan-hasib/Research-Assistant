"""Chunk manager (Part 6.1 — Loader → Chunker → Embedding).

Turns the loader's per-page/per-section units into ``TextChunk`` records carrying
the metadata retrieval needs: page number, heading, and a monotonically increasing
chunk index within the document. Each loaded unit is split independently so page/
heading metadata stays truthful (a chunk never spans two pages).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.modules.rag.loaders import LoadedDocument
from app.modules.rag.splitters import TextSplitter, estimate_tokens


@dataclass
class TextChunk:
    content: str
    index: int
    token_count: int
    page: int | None = None
    heading: str | None = None
    metadata: dict = field(default_factory=dict)


class ChunkManager:
    def __init__(
        self,
        *,
        splitter: TextSplitter,
        chunk_size: int,
        chunk_overlap: int,
    ) -> None:
        self._splitter = splitter
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap

    def chunk_document(self, loaded: list[LoadedDocument]) -> list[TextChunk]:
        chunks: list[TextChunk] = []
        index = 0
        for document in loaded:
            pieces = self._splitter.split(
                document.page_content,
                chunk_size=self._chunk_size,
                chunk_overlap=self._chunk_overlap,
            )
            for piece in pieces:
                content = piece.strip()
                if not content:
                    continue
                chunks.append(
                    TextChunk(
                        content=content,
                        index=index,
                        token_count=estimate_tokens(content),
                        page=document.page,
                        heading=document.heading,
                        metadata={
                            "source": document.source,
                            **document.metadata,
                        },
                    )
                )
                index += 1
        return chunks
