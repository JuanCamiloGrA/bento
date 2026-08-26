"""add versioned editable settings metadata

Revision ID: 0003_versioned_settings
Revises: 0002_blob_encryption_metadata
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_versioned_settings"
down_revision = "0002_blob_encryption_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "settings_meta",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.execute("INSERT INTO settings_meta(id, revision, updated_at) VALUES (1, 0, CURRENT_TIMESTAMP)")
    op.create_table(
        "setting_secret_references",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("reference", sa.String(length=256), nullable=True),
        sa.Column("configured", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("setting_secret_references")
    op.drop_table("settings_meta")
