"""RAG FastAPI dependencies: access to ingestion/retrieval from the container."""

from __future__ import annotations

from fastapi import Request

from app.core.exceptions import ConfigurationError
from app.modules.rag.retrieval import RetrievalService
from app.modules.rag.services import IngestionService


def get_ingestion_service(request: Request) -> IngestionService:
    service: IngestionService | None = request.app.state.container.ingestion_service
    if service is None:
        raise ConfigurationError(
            "RAG ingestion is not configured; set DATABASE_URL to enable the RAG module"
        )
    return service


def get_retrieval_service(request: Request) -> RetrievalService:
    service: RetrievalService | None = request.app.state.container.retrieval_service
    if service is None:
        raise ConfigurationError(
            "RAG retrieval is not configured; set DATABASE_URL to enable the RAG module"
        )
    return service
