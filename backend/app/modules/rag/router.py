"""RAG HTTP endpoints (Part 6.2 — ingestion + retrieval).

Mounted at ``settings.api_v1_prefix`` + ``/rag``. Ingestion consumes an already-
completed upload (presign → PUT → complete, Milestone 5), so bytes never cross
the API layer here either. Retrieval is user-scoped: only chunks from the
requester's documents are ever returned.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.rag.dependencies import (
    get_ingestion_service,
    get_retrieval_service,
)
from app.modules.rag.retrieval import RetrievalService
from app.modules.rag.schemas import (
    CitationOut,
    DocumentListResponse,
    DocumentOut,
    IngestDocumentRequest,
    IngestDocumentResponse,
    RetrievalHitOut,
    RetrieveRequest,
    RetrieveResponse,
)
from app.modules.rag.services import IngestionService

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post(
    "/documents",
    response_model=IngestDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a completed upload into the RAG index",
)
def ingest_document(
    payload: IngestDocumentRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[IngestionService, Depends(get_ingestion_service)],
) -> IngestDocumentResponse:
    result = service.ingest(user_id=current_user.id, upload_id=payload.upload_id)
    return IngestDocumentResponse(
        document=_document_out(service, current_user.id, result.document.id, result.chunk_count),
        chunk_count=result.chunk_count,
    )


@router.get(
    "/documents/{document_id}",
    response_model=DocumentOut,
    summary="Return a single ingested document",
)
def get_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[IngestionService, Depends(get_ingestion_service)],
) -> DocumentOut:
    chunk_count = service.chunk_count(user_id=current_user.id, document_id=document_id)
    return _document_out(service, current_user.id, document_id, chunk_count)


@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List the current user's ingested documents",
)
def list_documents(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[IngestionService, Depends(get_ingestion_service)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> DocumentListResponse:
    documents, total, counts = service.list(user_id=current_user.id, skip=skip, limit=limit)
    return DocumentListResponse(
        items=[
            DocumentOut.model_validate(document).model_copy(
                update={"chunk_count": counts.get(document.id, 0)}
            )
            for document in documents
        ],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document and its index entries",
)
def delete_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[IngestionService, Depends(get_ingestion_service)],
) -> None:
    service.delete(user_id=current_user.id, document_id=document_id)


@router.post(
    "/retrieve",
    response_model=RetrieveResponse,
    summary="Hybrid retrieval over the user's ingested documents",
)
def retrieve(
    payload: RetrieveRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[RetrievalService, Depends(get_retrieval_service)],
) -> RetrieveResponse:
    result = service.retrieve(user_id=current_user.id, query=payload.query, top_k=payload.top_k)
    return RetrieveResponse(
        query=result.query,
        rewritten_query=result.rewritten_query,
        hits=[
            RetrievalHitOut(
                chunk_id=hit.chunk_id,
                document_id=hit.document_id,
                document_name=hit.document_name,
                content=hit.content,
                score=hit.score,
                page=hit.page,
                heading=hit.heading,
            )
            for hit in result.hits
        ],
        citations=[
            CitationOut(
                index=citation.index,
                chunk_id=citation.chunk_id,
                document_id=citation.document_id,
                document_name=citation.document_name,
                page=citation.page,
                heading=citation.heading,
                snippet=citation.snippet,
                score=citation.score,
            )
            for citation in result.citations
        ],
    )


def _document_out(
    service: IngestionService, user_id: uuid.UUID, document_id: uuid.UUID, chunk_count: int
) -> DocumentOut:
    document = service.get(user_id=user_id, document_id=document_id)
    return DocumentOut.model_validate(document).model_copy(update={"chunk_count": chunk_count})
