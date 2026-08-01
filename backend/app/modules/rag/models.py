"""RAG persistence models (Part 5.2 — ``documents``, ``document_chunks``, ``embeddings``).

Lifecycle: a completed upload becomes a ``Document``; ingestion loads bytes →
parses → chunks → embeds → persists chunk rows + embedding pointers and writes the
vectors to the vector store (FAISS). ``document_chunks`` rows carry the page/heading
metadata that feed citation generation (Part 6.2). The ``embeddings`` row is the
*pointer/version* for a chunk's vector — the vector itself lives in the vector
store, keyed by ``<document_id>:<chunk_id>``.

``workspace_id`` is intentionally omitted until the workspaces module exists
(Part 5.1 ER); uploads are the scoping root for now. Timestamps are naive UTC.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Document(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "documents"

    uploader_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(
        String(20), default=DocumentStatus.PROCESSING.value, server_default="processing"
    )
    parser: Mapped[str] = mapped_column(String(50), default="text")
    source_type: Mapped[str] = mapped_column(String(50), default="upload")
    error: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)


class DocumentChunk(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "document_chunks"
    __table_args__ = (UniqueConstraint("document_id", "index", name="uq_document_chunks_document_id_index"),)

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    page: Mapped[int | None] = mapped_column(Integer)
    heading: Mapped[str | None] = mapped_column(String(255))
    chunk_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class EmbeddingRecord(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Pointer/version row for one chunk's vector (Part 6.3 — embedding versioning)."""

    __tablename__ = "embeddings"

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("document_chunks.id", ondelete="CASCADE"), index=True
    )
    model_name: Mapped[str] = mapped_column(String(255))
    dimensions: Mapped[int] = mapped_column(Integer)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
