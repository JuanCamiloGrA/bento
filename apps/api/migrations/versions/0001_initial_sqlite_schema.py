"""create initial sqlite schema

Revision ID: 0001_initial_sqlite_schema
Revises:
Create Date: 2026-06-28 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_sqlite_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("parent_id", sa.String(length=64), sa.ForeignKey("folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_folders_parent_id", "folders", ["parent_id"])
    op.create_index("ix_folders_deleted_at", "folders", ["deleted_at"])

    op.create_table(
        "assets",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("folder_id", sa.String(length=64), sa.ForeignKey("folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=512), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("exif", sa.JSON(), nullable=True),
        sa.Column("processing_state", sa.String(length=64), nullable=False),
        sa.Column("favorite", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_assets_folder_id", "assets", ["folder_id"])
    op.create_index("ix_assets_sha256", "assets", ["sha256"])
    op.create_index("ix_assets_mode_deleted", "assets", ["mode", "deleted_at"])
    op.create_index("ix_assets_taken_at", "assets", ["taken_at"])

    op.create_table(
        "albums",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_albums_deleted_at", "albums", ["deleted_at"])

    op.create_table(
        "album_assets",
        sa.Column("album_id", sa.String(length=64), sa.ForeignKey("albums.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("asset_id", sa.String(length=64), sa.ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_album_assets_asset_id", "album_assets", ["asset_id"])

    op.create_table(
        "blob_refs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("asset_id", sa.String(length=64), sa.ForeignKey("assets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("backend", sa.String(length=32), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("object_key", sa.String(length=1024), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("chat_id", sa.String(length=128), nullable=True),
        sa.Column("message_id", sa.String(length=128), nullable=True),
        sa.Column("file_id", sa.String(length=512), nullable=True),
        sa.Column("file_unique_id", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_blob_refs_asset_id", "blob_refs", ["asset_id"])

    op.create_table(
        "thumbnails",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("asset_id", sa.String(length=64), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("blob_ref_id", sa.String(length=64), sa.ForeignKey("blob_refs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_thumbnails_asset_id", "thumbnails", ["asset_id"])

    op.create_table(
        "asset_text",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("asset_id", sa.String(length=64), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("language", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_asset_text_asset_id", "asset_text", ["asset_id"])
    op.create_index("ix_asset_text_source", "asset_text", ["source"])

    op.create_table(
        "asset_embeddings",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("asset_id", sa.String(length=64), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=128), nullable=False),
        sa.Column("vector_ref", sa.String(length=256), nullable=False),
        sa.Column("dimensions", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_asset_embeddings_asset_id", "asset_embeddings", ["asset_id"])
    op.create_index("ix_asset_embeddings_provider", "asset_embeddings", ["provider"])

    op.create_table(
        "pdf_pages",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("asset_id", sa.String(length=64), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pdf_pages_asset_id", "pdf_pages", ["asset_id"])

    op.create_table(
        "ocr_blocks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("asset_id", sa.String(length=64), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ocr_blocks_asset_id", "ocr_blocks", ["asset_id"])

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("asset_id", sa.String(length=64), sa.ForeignKey("assets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("locked_by", sa.String(length=128), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("run_after", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_jobs_claim", "jobs", ["status", "run_after", "priority", "created_at"])
    op.create_index("ix_jobs_asset_id", "jobs", ["asset_id"])

    op.create_table(
        "manifest_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=128), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_manifest_events_entity", "manifest_events", ["entity_type", "entity_id"])
    op.create_index("ix_manifest_events_created_at", "manifest_events", ["created_at"])

    op.create_table(
        "settings",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("value", sa.String(length=2048), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.execute(
        """
        CREATE VIRTUAL TABLE asset_fts USING fts5(
            asset_id UNINDEXED,
            title,
            text,
            metadata,
            tokenize = 'unicode61'
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS asset_fts")
    op.drop_table("settings")
    op.drop_index("ix_manifest_events_created_at", table_name="manifest_events")
    op.drop_index("ix_manifest_events_entity", table_name="manifest_events")
    op.drop_table("manifest_events")
    op.drop_index("ix_jobs_asset_id", table_name="jobs")
    op.drop_index("ix_jobs_claim", table_name="jobs")
    op.drop_table("jobs")
    op.drop_index("ix_ocr_blocks_asset_id", table_name="ocr_blocks")
    op.drop_table("ocr_blocks")
    op.drop_index("ix_pdf_pages_asset_id", table_name="pdf_pages")
    op.drop_table("pdf_pages")
    op.drop_index("ix_asset_embeddings_provider", table_name="asset_embeddings")
    op.drop_index("ix_asset_embeddings_asset_id", table_name="asset_embeddings")
    op.drop_table("asset_embeddings")
    op.drop_index("ix_asset_text_source", table_name="asset_text")
    op.drop_index("ix_asset_text_asset_id", table_name="asset_text")
    op.drop_table("asset_text")
    op.drop_index("ix_thumbnails_asset_id", table_name="thumbnails")
    op.drop_table("thumbnails")
    op.drop_index("ix_blob_refs_asset_id", table_name="blob_refs")
    op.drop_table("blob_refs")
    op.drop_index("ix_album_assets_asset_id", table_name="album_assets")
    op.drop_table("album_assets")
    op.drop_index("ix_albums_deleted_at", table_name="albums")
    op.drop_table("albums")
    op.drop_index("ix_assets_taken_at", table_name="assets")
    op.drop_index("ix_assets_mode_deleted", table_name="assets")
    op.drop_index("ix_assets_sha256", table_name="assets")
    op.drop_index("ix_assets_folder_id", table_name="assets")
    op.drop_table("assets")
    op.drop_index("ix_folders_deleted_at", table_name="folders")
    op.drop_index("ix_folders_parent_id", table_name="folders")
    op.drop_table("folders")
