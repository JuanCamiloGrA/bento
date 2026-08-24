"""persist authenticated blob encryption metadata

Revision ID: 0002_blob_encryption_metadata
Revises: 0001_initial_sqlite_schema
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_blob_encryption_metadata"
down_revision = "0001_initial_sqlite_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("blob_refs") as batch:
        batch.add_column(sa.Column("encryption_mode", sa.String(length=32), nullable=False, server_default="none"))
        batch.add_column(sa.Column("encryption_key_id", sa.String(length=128), nullable=True))
        batch.add_column(sa.Column("encryption_nonce", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("encryption_tag", sa.String(length=64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("blob_refs") as batch:
        batch.drop_column("encryption_tag")
        batch.drop_column("encryption_nonce")
        batch.drop_column("encryption_key_id")
        batch.drop_column("encryption_mode")
