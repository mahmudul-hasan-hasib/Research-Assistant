"""Ingestion service (Part 6.2 — upload bytes → chunks → embeddings → vector store).

Orchestrates the RAG pipeline: a completed upload becomes a ``Document``, the
storage object is parsed by the type-appropriate loader, split into chunks that
carry page/heading metadata for citations, embedded, and written to both the
vector store (dense search) and the ``document_chunks`` / ``embeddings`` tables
(hybrid retrieval + versioning). Every operation is user-scoped; failures mark
the document ``failed`` and leave no orphan vectors.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.auth.tokens import now_utc
from app.modules.rag.chunking import ChunkManager, TextChunk
from app.modules.rag.embeddings import Embedder
from app.modules.rag.loaders import DocumentLoader, build_loader
from app.modules.rag.models import Document, DocumentChunk, DocumentStatus
from app.modules.rag.repositories import (
    DocumentChunkRepository,
    DocumentRepository,
    EmbeddingRecordRepository,
)
from app.modules.rag.vectorstore import VectorStore
from app.modules.uploads.models import Upload, UploadStatus
from app.modules.uploads.repositories import UploadRepository
from app.shared.database import SessionFactory
from app.shared.storage import ObjectStorage

LoaderBuilder = Callable[[str], DocumentLoader]


@dataclass
class IngestionResult:
    document: Document
    chunk_count: int


class IngestionService:
    def __init__(
        self,
        *,
        session_factory: SessionFactory,
        storage: ObjectStorage,
        chunk_manager: ChunkManager,
        embedder: Embedder,
        vector_store: VectorStore,
        model_name: str,
        dimensions: int,
        loader_builder: LoaderBuilder = build_loader,
    ) -> None:
        self._session_factory = session_factory
        self._storage = storage
        self._chunk_manager = chunk_manager
        self._embedder = embedder
        self._vector_store = vector_store
        self._model_name = model_name
        self._dimensions = dimensions
        self._loader_builder = loader_builder

    # --- use-cases ---------------------------------------------------------

    def ingest(self, *, user_id: uuid.UUID, upload_id: uuid.UUID) -> IngestionResult:
        with self._session_factory() as session:
            upload = UploadRepository(session).get_for_user(upload_id, user_id)
            if upload is None:
                raise NotFoundError(detail="Upload not found")
            if upload.status != UploadStatus.READY.value:
                raise ConflictError(
                    detail="Upload is not ready; complete the upload before ingesting it"
                )

            document = DocumentRepository(session).add(
                Document(
                    uploader_id=user_id,
                    name=upload.original_name,
                    mime=upload.content_type,
                    size_bytes=upload.size_bytes,
                    storage_key=upload.storage_key,
                    status=DocumentStatus.PROCESSING.value,
                    source_type="upload",
                )
            )
            session.commit()
            session.refresh(document)

        try:
            document, chunks = self._pipeline(document, upload)
        except Exception as exc:
            self._mark_failed(document, exc)
            raise

        self._vector_store.save()
        return IngestionResult(document=document, chunk_count=len(chunks))

    def _pipeline(self, document: Document, upload: Upload) -> tuple[Document, list[TextChunk]]:
        data = self._storage.get_bytes(upload.storage_key)
        loader = self._loader_builder(upload.content_type)
        loaded = loader.load(data)
        chunks = self._chunk_manager.chunk_document(loaded)

        contents = [chunk.content for chunk in chunks]
        vectors = self._embedder.embed(contents) if contents else []

        with self._session_factory() as session:
            doc_repo = DocumentRepository(session)
            current = doc_repo.get(document.id)
            chunk_repo = DocumentChunkRepository(session)
            embedding_repo = EmbeddingRecordRepository(session)
            vector_ids: list[str] = []
            for chunk, vector in zip(chunks, vectors):
                row = chunk_repo.add(
                    DocumentChunk(
                        document_id=current.id,
                        index=chunk.index,
                        content=chunk.content,
                        token_count=chunk.token_count,
                        page=chunk.page,
                        heading=chunk.heading,
                        chunk_metadata=chunk.metadata,
                    )
                )
                embedding_repo.add_for_chunk(
                    document_id=current.id,
                    chunk_id=row.id,
                    model_name=self._model_name,
                    dimensions=self._dimensions,
                )
                vector_ids.append(f"{current.id}:{row.id}")
            if vectors:
                self._vector_store.add(vectors, vector_ids)
            doc_repo.mark_ready(current, parser=loader.parser, completed_at=now_utc())
            session.commit()
            session.refresh(current)
        return current, chunks

    def _mark_failed(self, document: Document, exc: Exception) -> None:
        self._vector_store.delete_by_prefix(f"{document.id}:")
        self._vector_store.save()
        with self._session_factory() as session:
            current = DocumentRepository(session).get(document.id)
            if current is not None:
                DocumentRepository(session).mark_failed(
                    current, error=str(exc), completed_at=now_utc()
                )
                session.commit()

    def get(self, *, user_id: uuid.UUID, document_id: uuid.UUID) -> Document:
        with self._session_factory() as session:
            document = DocumentRepository(session).get_for_user(document_id, user_id)
            if document is None:
                raise NotFoundError(detail="Document not found")
            session.refresh(document)
            return document

    def list(
        self,
        *,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Document], int, dict[uuid.UUID, int]]:
        with self._session_factory() as session:
            repo = DocumentRepository(session)
            documents = list(repo.list_for_user(user_id, skip=skip, limit=limit))
            counts = DocumentChunkRepository(session).counts_for_documents(
                [document.id for document in documents]
            )
            total = repo.count_for_user(user_id)
            return documents, total, counts

    def chunk_count(self, *, user_id: uuid.UUID, document_id: uuid.UUID) -> int:
        with self._session_factory() as session:
            document = DocumentRepository(session).get_for_user(document_id, user_id)
            if document is None:
                raise NotFoundError(detail="Document not found")
            return DocumentChunkRepository(session).count_for_document(document_id)

    def delete(self, *, user_id: uuid.UUID, document_id: uuid.UUID) -> None:
        with self._session_factory() as session:
            repo = DocumentRepository(session)
            document = repo.get_for_user(document_id, user_id)
            if document is None:
                raise NotFoundError(detail="Document not found")
            self._vector_store.delete_by_prefix(f"{document_id}:")
            self._vector_store.save()
            DocumentChunkRepository(session).delete_for_document(document_id)
            EmbeddingRecordRepository(session).delete_for_document(document_id)
            repo.delete(document)
            session.commit()
