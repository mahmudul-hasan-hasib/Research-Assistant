"""Application settings.

Single source of truth for environment configuration (P8: configuration is data,
not code). All environment-specific values are read here and injected via the
container — no other module reads environment variables directly.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "insight"
    app_env: str = "development"
    debug: bool = False
    log_level: str = "INFO"
    secret_key: str = "change-me"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- Database ---
    database_url: str | None = None
    database_echo: bool = False

    # --- Authentication (Part 11) ---
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_ttl_seconds: int = 900
    jwt_refresh_token_ttl_seconds: int = 2_592_000

    # --- Object storage (Part 4.2 — S3/MinIO behind a port, local for dev/tests) ---
    storage_backend: str = "local"
    storage_local_root: str = "./storage"
    s3_endpoint: str | None = None
    s3_region: str = "us-east-1"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_bucket: str = "insight"
    s3_force_path_style: bool = True
    s3_presign_ttl_seconds: int = 900

    # --- Uploads (Part 11 — server-side allow-list + magic-byte sniff) ---
    upload_max_size_bytes: int = 100 * 1024 * 1024

    # --- LLM gateway (Part 10 — provider-agnostic; only Gemini ships in this phase) ---
    active_llm_provider: str = "gemini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    # --- RAG — ingestion (Part 6) ---
    rag_splitter: str = "langchain"  # "langchain" | "llamaindex"
    rag_chunk_size: int = 800
    rag_chunk_overlap: int = 160

    # --- RAG — embeddings (Part 6.2 — sentence-transformers locally, provider-switchable) ---
    embedding_provider: str = "sentence_transformers"  # "sentence_transformers" | "memory"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimensions: int = 384

    # --- RAG — vector store (Part 6.2 — FAISS default behind a port) ---
    vector_store_backend: str = "faiss"  # "faiss" | "memory"
    vector_index_dir: str = "./vector_index"

    # --- RAG — retrieval (Part 6.2 — hybrid dense + lexical, optional rewrite) ---
    rag_top_k: int = 8
    rag_dense_oversample: int = 4
    rag_dense_weight: float = 0.7
    rag_lexical_weight: float = 0.3
    rag_enable_query_rewrite: bool = False
    rag_query_rewrite_instruction: str = (
        "Rephrase the user's question as a focused, self-contained search query "
        "for retrieving relevant passages from a research corpus. Output only the "
        "rewritten query."
    )

    # --- Agent orchestrator (Part 7 — planning; default instruction lives in the planner) ---
    agent_max_steps: int = 5
    agent_planner_instruction: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: Any) -> Any:
        """Accept either a JSON array or a comma-separated list in the env var."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _guard_jwt_secret_length(self) -> Settings:
        """Never run production with a weak HMAC key (RFC 7518 §3.2).

        Dev/test environments may use short placeholder keys; production refuses
        to boot rather than silently issue forgeable tokens.
        """
        if self.app_env.lower() == "production" and len(self.jwt_secret) < 32:
            raise ValueError(
                "JWT signing key must be at least 32 bytes in production; "
                "set JWT_SECRET_KEY (or SECRET_KEY) to a strong value"
            )
        return self

    @property
    def jwt_secret(self) -> str:
        """Signing key for tokens; falls back to ``secret_key`` when unset."""
        return self.jwt_secret_key or self.secret_key

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
