"""RAG API contracts (Part 4.1 — strict Pydantic schemas at every boundary)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.rag.citations import SNIPPET_CHARS

DocumentStatusType = Literal["processing", "ready", "failed"]


class IngestDocumentRequest(BaseModel):
    upload_id: uuid.UUID


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    mime: str
    size_bytes: int
    status: DocumentStatusType
    parser: str
    source_type: str
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    chunk_count: int = 0


class IngestDocumentResponse(BaseModel):
    document: DocumentOut
    chunk_count: int


class DocumentListResponse(BaseModel):
    items: list[DocumentOut]
    total: int
    skip: int
    limit: int


class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    top_k: int | None = Field(default=None, ge=1, le=50)


class CitationOut(BaseModel):
    index: int
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    page: int | None = None
    heading: str | None = None
    snippet: str = Field(max_length=SNIPPET_CHARS)
    score: float


class RetrievalHitOut(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    content: str
    score: float
    page: int | None = None
    heading: str | None = None


class RetrieveResponse(BaseModel):
    query: str
    rewritten_query: str | None = None
    hits: list[RetrievalHitOut]
    citations: list[CitationOut]
