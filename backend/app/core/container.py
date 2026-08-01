"""Lightweight dependency-injection container (Part 4.4).

No framework magic: a plain composition root builds the container in ``main.py``
and wires Settings → clients → repositories → services. The container owns the
engine/session factory so tests can inject a different database URL.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import Engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.exceptions import ConfigurationError
from app.core.health import HealthRegistry, HealthStatus
from app.modules.agent.executor import Executor
from app.modules.agent.orchestrator import AgentService
from app.modules.agent.planner import Planner
from app.modules.agent.tools.registry import build_default_registry
from app.modules.auth.services import AuthService
from app.modules.rag.chunking import ChunkManager
from app.modules.rag.embeddings import Embedder, build_embedder
from app.modules.rag.retrieval import (
    LLMQueryRewriter,
    PassthroughQueryRewriter,
    RetrievalService,
)
from app.modules.rag.services import IngestionService
from app.modules.rag.splitters import build_splitter
from app.modules.rag.vectorstore import VectorStore, build_vector_store
from app.modules.uploads.services import UploadService
from app.shared.database import build_engine, build_session_factory
from app.shared.storage import LocalObjectStorage, ObjectStorage, S3ObjectStorage


@dataclass
class Container:
    settings: Settings
    health: HealthRegistry = field(default_factory=HealthRegistry)
    engine: Engine | None = field(default=None, init=False)
    session_factory: sessionmaker[Session] | None = field(default=None, init=False)
    auth_service: AuthService | None = field(default=None, init=False)
    storage: ObjectStorage | None = field(default=None, init=False)
    upload_service: UploadService | None = field(default=None, init=False)
    embedder: Embedder | None = field(default=None, init=False)
    vector_store: VectorStore | None = field(default=None, init=False)
    ingestion_service: IngestionService | None = field(default=None, init=False)
    retrieval_service: RetrievalService | None = field(default=None, init=False)
    agent_service: AgentService | None = field(default=None, init=False)

    # Phase 4+: redis client, more repositories/services.
    # Example:
    #   self.repositories.user = UserRepository(self.session_factory)

    @classmethod
    def build(cls, settings: Settings) -> Container:
        container = cls(settings=settings)
        container._wire_database()
        container._wire_modules()
        return container

    def _wire_database(self) -> None:
        if not self.settings.database_url:
            self.health.register("database", lambda: HealthStatus(ok=True, detail="not configured"))
            return
        self.engine = build_engine(
            self.settings.database_url, echo=self.settings.database_echo
        )
        self.session_factory = build_session_factory(self.engine)
        self.health.register("database", self._database_check)

    def _wire_modules(self) -> None:
        """Wire DB-backed services once a session factory is available."""
        if self.session_factory is None:
            return
        self.storage = self._build_storage()
        self.auth_service = AuthService(
            session_factory=self.session_factory, settings=self.settings
        )
        self.upload_service = UploadService(
            session_factory=self.session_factory,
            storage=self.storage,
            settings=self.settings,
        )
        self.embedder = build_embedder(self.settings)
        self.vector_store = build_vector_store(self.settings)
        self.ingestion_service = IngestionService(
            session_factory=self.session_factory,
            storage=self.storage,
            chunk_manager=ChunkManager(
                splitter=build_splitter(self.settings),
                chunk_size=self.settings.rag_chunk_size,
                chunk_overlap=self.settings.rag_chunk_overlap,
            ),
            embedder=self.embedder,
            vector_store=self.vector_store,
            model_name=self.settings.embedding_model,
            dimensions=self.settings.embedding_dimensions,
        )
        self.retrieval_service = RetrievalService(
            session_factory=self.session_factory,
            embedder=self.embedder,
            vector_store=self.vector_store,
            top_k=self.settings.rag_top_k,
            dense_oversample=self.settings.rag_dense_oversample,
            dense_weight=self.settings.rag_dense_weight,
            lexical_weight=self.settings.rag_lexical_weight,
            query_rewriter=self._build_query_rewriter(),
        )
        self.agent_service = self._build_agent_service()

    def _build_agent_service(self) -> AgentService | None:
        if self.retrieval_service is None:
            return None
        registry = build_default_registry(self.retrieval_service)
        return AgentService(
            planner=Planner(
                provider=self._build_llm_provider(),
                registry=registry,
                max_steps=self.settings.agent_max_steps,
                instruction=self.settings.agent_planner_instruction,
            ),
            executor=Executor(registry=registry),
            registry=registry,
        )

    def _build_llm_provider(self):
        """Build the LLM provider for planning, or ``None`` when unconfigured.

        Planning degrades gracefully (fallback plan) when no provider is
        available, so the app boots without an API key.
        """
        from app.modules.llm.factory import build_llm_provider

        try:
            return build_llm_provider(self.settings)
        except ConfigurationError:
            return None

    def _build_query_rewriter(self):
        from app.modules.llm.factory import build_llm_provider

        if not self.settings.rag_enable_query_rewrite:
            return PassthroughQueryRewriter()
        return LLMQueryRewriter(
            provider=build_llm_provider(self.settings),
            instruction=self.settings.rag_query_rewrite_instruction,
        )

    def _build_storage(self) -> ObjectStorage:
        if self.settings.storage_backend == "s3":
            return S3ObjectStorage(
                bucket=self.settings.s3_bucket,
                endpoint_url=self.settings.s3_endpoint,
                region=self.settings.s3_region,
                access_key=self.settings.s3_access_key,
                secret_key=self.settings.s3_secret_key,
                force_path_style=self.settings.s3_force_path_style,
            )
        return LocalObjectStorage(self.settings.storage_local_root)

    def _database_check(self) -> HealthStatus:
        if self.engine is None:
            return HealthStatus(ok=True, detail="not configured")
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return HealthStatus(ok=True, detail="reachable")
        except Exception as exc:  # noqa: BLE001
            return HealthStatus(ok=False, detail=f"{type(exc).__name__}: {exc}")
