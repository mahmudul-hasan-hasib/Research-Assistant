"""Uploads module: ``uploads`` table (Part 5.2 — presigned-upload lifecycle).

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-01

Tracks presign → PUT → complete: ``pending`` when the presigned URL is issued,
``ready`` once bytes are validated and stored (``processing``/``failed`` are
driven by the ingestion worker in a later phase). Storage bytes stay in the
object store; only metadata (Part 5.2 row) lives in PostgreSQL. Timestamps are
naive UTC (see ``app/modules/auth/models.py``).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "uploads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_uploads"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_uploads_user_id_users",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_uploads_user_id", "uploads", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_uploads_user_id", table_name="uploads")
    op.drop_table("uploads")
