"""Retrieval service (Part 6.2) — hybrid dense + lexical, with optional rewrite.

Pipeline: optional LLM query rewrite → dense vector search (oversampled) → BM25
lexical scoring of the candidates → weighted score fusion → top-k → citations.
Chunk results are strictly scoped to the requesting user's documents. The rerank
stage from Part 6.2 is a port (``Reranker``) wired to nothing in this phase.
"""

from __future__ import annotations

import math
import re
import uuid
from dataclasses import dataclass
from typing import Protocol

from app.modules.llm.base import LLMMessage, LLMProvider
from app.modules.rag.citations import Citation, CitationGenerator, RetrievalHit
from app.modules.rag.embeddings import Embedder
from app.modules.rag.repositories import DocumentChunkRepository, DocumentRepository
from app.modules.rag.vectorstore import VectorStore
from app.shared.database import SessionFactory

_TOKEN_RE = re.compile(r"[a-z0-9_]+")


@dataclass
class RetrievalResult:
    query: str
    rewritten_query: str | None
    hits: list[RetrievalHit]
    citations: list[Citation]


class QueryRewriter(Protocol):
    def rewrite(self, query: str) -> str: ...


class PassthroughQueryRewriter:
    def rewrite(self, query: str) -> str:
        return query


class LLMQueryRewriter:
    """LLM query rewrite (Part 6.2). Fails open to the original query on any
    provider error — retrieval must never hard-fail because rewriting did."""

    def __init__(self, *, provider: LLMProvider, instruction: str) -> None:
        self._provider = provider
        self._instruction = instruction

    def rewrite(self, query: str) -> str:
        try:
            response = self._provider.complete(
                [
                    LLMMessage(role="system", content=self._instruction),
                    LLMMessage(role="user", content=query),
                ],
                max_tokens=120,
                temperature=0.0,
            )
        except Exception:  # noqa: BLE001
            return query
        rewritten = response.content.strip()
        return rewritten or query


class Reranker(Protocol):
    def rerank(
        self, query: str, hits: list[RetrievalHit], *, top_k: int
    ) -> list[RetrievalHit]: ...


class BM25:
    """Small, dependency-free Okapi BM25 scorer used for lexical scoring."""

    def __init__(self, *, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self._docs: list[list[str]] = []
        self._idf: dict[str, float] = {}
        self._avgdl = 0.0

    def fit(self, documents: list[str]) -> None:
        self._docs = [_TOKEN_RE.findall(text.lower()) for text in documents]
        total = sum(len(terms) for terms in self._docs)
        self._avgdl = total / len(self._docs) if self._docs else 1.0
        df: dict[str, int] = {}
        for terms in self._docs:
            for term in set(terms):
                df[term] = df.get(term, 0) + 1
        n = len(self._docs)
        self._idf = {
            term: math.log((n - count + 0.5) / (count + 0.5) + 1.0)
            for term, count in df.items()
        }

    def score(self, query: str) -> list[float]:
        terms = _TOKEN_RE.findall(query.lower())
        if not terms or not self._docs:
            return [0.0] * len(self._docs)
        results: list[float] = []
        for doc_terms in self._docs:
            doc_len = len(doc_terms)
            norm = self.k1 * (1.0 - self.b + self.b * (doc_len / self._avgdl))
            total = 0.0
            for term in terms:
                freq = sum(1 for candidate in doc_terms if candidate == term)
                idf = self._idf.get(term, 0.0)
                if idf:
                    total += idf * (freq * (self.k1 + 1.0)) / (freq + norm)
            results.append(total)
        maximum = max(results) or 1.0
        return [value / maximum for value in results]


def _normalize(scores: list[float]) -> list[float]:
    if not scores:
        return []
    low, high = min(scores), max(scores)
    if high <= low:
        return [0.0] * len(scores)
    return [(value - low) / (high - low) for value in scores]


class RetrievalService:
    def __init__(
        self,
        *,
        session_factory: SessionFactory,
        embedder: Embedder,
        vector_store: VectorStore,
        top_k: int,
        dense_oversample: int,
        dense_weight: float,
        lexical_weight: float,
        query_rewriter: QueryRewriter | None = None,
        citation_generator: CitationGenerator | None = None,
        reranker: Reranker | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._embedder = embedder
        self._vector_store = vector_store
        self._top_k = top_k
        self._dense_oversample = dense_oversample
        self._dense_weight = dense_weight
        self._lexical_weight = lexical_weight
        self._query_rewriter = query_rewriter or PassthroughQueryRewriter()
        self._citation_generator = citation_generator or CitationGenerator()
        self._reranker = reranker

    def retrieve(self, *, user_id: uuid.UUID, query: str, top_k: int | None = None) -> RetrievalResult:
        rewritten = self._query_rewriter.rewrite(query)
        vector = self._embedder.embed([rewritten])[0]
        candidate_limit = (top_k or self._top_k) * self._dense_oversample
        dense_hits = self._vector_store.search(vector, top_k=candidate_limit)

        chunk_ids = [
            _parse_chunk_id(hit.id) for hit in dense_hits if _parse_chunk_id(hit.id) is not None
        ]

        with self._session_factory() as session:
            chunk_repo = DocumentChunkRepository(session)
            doc_repo = DocumentRepository(session)
            chunks = chunk_repo.get_many(chunk_ids)
            documents = doc_repo.get_many_for_user(
                {chunk.document_id for chunk in chunks}, user_id
            )
            doc_names = {document.id: document.name for document in documents}

        by_chunk: dict[uuid.UUID, RetrievalHit] = {}
        scores_by_chunk: dict[uuid.UUID, float] = {}
        for dense_hit, chunk_id in zip(dense_hits, chunk_ids):
            scores_by_chunk[chunk_id] = dense_hit.score
        for chunk in chunks:
            if chunk.id not in scores_by_chunk:
                continue
            name = doc_names.get(chunk.document_id)
            if name is None:
                continue
            by_chunk[chunk.id] = RetrievalHit(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_name=name,
                content=chunk.content,
                score=scores_by_chunk[chunk.id],
                page=chunk.page,
                heading=chunk.heading,
            )

        ordered = [by_chunk[chunk_id] for chunk_id in chunk_ids if chunk_id in by_chunk]
        if not ordered:
            return RetrievalResult(query=query, rewritten_query=rewritten, hits=[], citations=[])

        dense_norm = _normalize([hit.score for hit in ordered])
        bm25 = BM25()
        bm25.fit([hit.content for hit in ordered])
        lexical_norm = bm25.score(query)
        fused_hits: list[RetrievalHit] = []
        for hit, d_score, l_score in zip(ordered, dense_norm, lexical_norm):
            fused_hits.append(
                RetrievalHit(
                    chunk_id=hit.chunk_id,
                    document_id=hit.document_id,
                    document_name=hit.document_name,
                    content=hit.content,
                    score=hit.score,
                    page=hit.page,
                    heading=hit.heading,
                    bm25_score=l_score,
                    fused_score=self._dense_weight * d_score + self._lexical_weight * l_score,
                )
            )

        ranked = sorted(fused_hits, key=lambda hit: hit.fused_score, reverse=True)
        if self._reranker is not None:
            ranked = self._reranker.rerank(query, ranked, top_k=top_k or self._top_k)
        ranked = ranked[: top_k or self._top_k]

        citations = self._citation_generator.build(ranked)
        return RetrievalResult(
            query=query,
            rewritten_query=rewritten,
            hits=ranked,
            citations=citations,
        )


def _parse_chunk_id(vector_id: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(vector_id.split(":", 1)[1])
    except (IndexError, ValueError):
        return None
