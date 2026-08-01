"""RAG module: ``documents``, ``document_chunks``, ``embeddings`` tables (Part 6).

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-02

Ingestion pipeline persistence (Part 5.2): a completed upload becomes a
``documents`` row; ``document_chunks`` holds the split text with the page/heading
metadata that feed citation generation (Part 6.2); ``embeddings`` is the
pointer/version row for each chunk's vector — the vector itself lives in the
vector store keyed by ``<document_id>:<chunk_id>`` (Part 6.3). Chunks carry a
unique ``(document_id, index)`` constraint so re-ingestion of a document can never
produce duplicate chunk rows.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("uploader_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("mime", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'processing'"),
            nullable=False,
        ),
        sa.Column("parser", sa.String(length=50), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_documents"),
        sa.ForeignKeyConstraint(
            ["uploader_id"],
            ["users.id"],
            name="fk_documents_uploader_id_users",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_documents_uploader_id", "documents", ["uploader_id"], unique=False)

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=True),
        sa.Column("heading", sa.String(length=255), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_document_chunks"),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name="fk_document_chunks_document_id_documents",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "document_id", "index", name="uq_document_chunks_document_id_index"
        ),
    )
    op.create_index(
        "ix_document_chunks_document_id", "document_chunks", ["document_id"], unique=False
    )

    op.create_table(
        "embeddings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("chunk_id", sa.Uuid(), nullable=False),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("dimensions", sa.Integer(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_embeddings"),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name="fk_embeddings_document_id_documents",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["chunk_id"],
            ["document_chunks.id"],
            name="fk_embeddings_chunk_id_document_chunks",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_embeddings_document_id", "embeddings", ["document_id"], unique=False)
    op.create_index("ix_embeddings_chunk_id", "embeddings", ["chunk_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_embeddings_chunk_id", table_name="embeddings")
    op.drop_index("ix_embeddings_document_id", table_name="embeddings")
    op.drop_table("embeddings")
    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_index("ix_documents_uploader_id", table_name="documents")
    op.drop_table("documents")
