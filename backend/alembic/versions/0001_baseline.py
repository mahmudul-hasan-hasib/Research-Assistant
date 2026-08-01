"""Baseline — empty migration establishing the Alembic head.

Revision ID: 0001
Revises:
Create Date: 2026-08-01

This is the initial (empty) revision that anchors the migration chain. Business
model tables are introduced by subsequent migrations generated with
``alembic revision --autogenerate``.
"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
