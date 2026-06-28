"""Outbound port contracts."""

from bento.ports.blob_store import BlobStorePort
from bento.ports.jobs import JobQueuePort
from bento.ports.manifest import ManifestJournalPort
from bento.ports.media import ThumbnailPort
from bento.ports.providers import EmbeddingProviderPort, OCRProviderPort
from bento.ports.repositories import AlbumRepositoryPort, AssetRepositoryPort, ClockPort, FolderRepositoryPort
from bento.ports.search import SearchIndexPort
from bento.ports.security import EncryptionPort
from bento.ports.settings import SettingsRepositoryPort

__all__ = [
    "AlbumRepositoryPort",
    "AssetRepositoryPort",
    "BlobStorePort",
    "ClockPort",
    "EmbeddingProviderPort",
    "EncryptionPort",
    "FolderRepositoryPort",
    "JobQueuePort",
    "ManifestJournalPort",
    "OCRProviderPort",
    "SearchIndexPort",
    "SettingsRepositoryPort",
    "ThumbnailPort",
]
