"""RAG persistence access (Part 4.2 — repository layer).

Transactions stay with the caller (the service); these methods flush but never
commit. ``DocumentRepository`` also exposes the user-scoped queries that power
retrieval ownership checks (Part 11 — object-level authorization).
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select

from app.modules.rag.models import (
    Document,
    DocumentChunk,
    DocumentStatus,
    EmbeddingRecord,
)
from app.shared.repository import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    model = Document

    def get_for_user(self, document_id: uuid.UUID, user_id: uuid.UUID) -> Document | None:
        stmt = select(Document).where(
            Document.id == document_id, Document.uploader_id == user_id
        )
        return self.session.scalar(stmt)

    def get_many_for_user(
        self, document_ids: Sequence[uuid.UUID], user_id: uuid.UUID
    ) -> Sequence[Document]:
        if not document_ids:
            return []
        stmt = select(Document).where(
            Document.id.in_(document_ids), Document.uploader_id == user_id
        )
        return self.session.scalars(stmt).all()

    def list_for_user(
        self, user_id: uuid.UUID, *, skip: int = 0, limit: int | None = None
    ) -> Sequence[Document]:
        stmt = (
            select(Document)
            .where(Document.uploader_id == user_id)
            .order_by(Document.created_at.desc())
            .offset(skip)
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        return self.session.scalars(stmt).all()

    def count_for_user(self, user_id: uuid.UUID) -> int:
        stmt = (
            select(func.count()).select_from(Document).where(Document.uploader_id == user_id)
        )
        return self.session.scalar(stmt) or 0

    def mark_ready(self, document: Document, *, parser: str, completed_at) -> Document:
        document.status = DocumentStatus.READY.value
        document.parser = parser
        document.error = None
        document.completed_at = completed_at
        self.flush()
        return document

    def mark_failed(self, document: Document, *, error: str, completed_at) -> Document:
        document.status = DocumentStatus.FAILED.value
        document.error = error
        document.completed_at = completed_at
        self.flush()
        return document


class DocumentChunkRepository(BaseRepository[DocumentChunk]):
    model = DocumentChunk

    def list_for_document(self, document_id: uuid.UUID) -> Sequence[DocumentChunk]:
        stmt = (
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.index)
        )
        return self.session.scalars(stmt).all()

    def get_many(self, chunk_ids: Sequence[uuid.UUID]) -> Sequence[DocumentChunk]:
        if not chunk_ids:
            return []
        stmt = select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids))
        return self.session.scalars(stmt).all()

    def count_for_document(self, document_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
        )
        return self.session.scalar(stmt) or 0

    def counts_for_documents(self, document_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not document_ids:
            return {}
        stmt = (
            select(DocumentChunk.document_id, func.count())
            .where(DocumentChunk.document_id.in_(document_ids))
            .group_by(DocumentChunk.document_id)
        )
        return {document_id: count for document_id, count in self.session.execute(stmt).all()}

    def delete_for_document(self, document_id: uuid.UUID) -> int:
        result = self.session.execute(
            DocumentChunk.__table__.delete().where(
                DocumentChunk.document_id == document_id
            )
        )
        return result.rowcount or 0


class EmbeddingRecordRepository(BaseRepository[EmbeddingRecord]):
    model = EmbeddingRecord

    def add_for_chunk(
        self,
        *,
        document_id: uuid.UUID,
        chunk_id: uuid.UUID,
        model_name: str,
        dimensions: int,
    ) -> EmbeddingRecord:
        return self.add(
            EmbeddingRecord(
                document_id=document_id,
                chunk_id=chunk_id,
                model_name=model_name,
                dimensions=dimensions,
            )
        )

    def delete_for_document(self, document_id: uuid.UUID) -> int:
        result = self.session.execute(
            EmbeddingRecord.__table__.delete().where(
                EmbeddingRecord.document_id == document_id
            )
        )
        return result.rowcount or 0
