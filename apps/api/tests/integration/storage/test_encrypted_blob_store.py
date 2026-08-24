from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

import pytest
from sqlalchemy import select

from bento.adapters.media import SQLiteBlobRefCatalog
from bento.adapters.security import LocalAesGcmEncryptionAdapter
from bento.adapters.storage.encrypted_blob_store import EncryptedBlobStoreAdapter
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.domain.assets import AssetMetadata
from bento.domain.errors import ValidationFailedError
from bento.domain.security import EncryptionMode
from bento.domain.storage import BlobKind
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import BlobRefModel

from tests.integration.db.support import FixedClock, migrated_session_factory


def test_encrypted_store_round_trip_persistence_and_tamper_detection(tmp_path: Path) -> None:
    async def scenario() -> None:
        content = b"confidential document contents"
        source = tmp_path / "document.txt"
        source.write_bytes(content)
        delegate = LocalBlobStoreAdapter(tmp_path / "uploads")
        encryption = LocalAesGcmEncryptionAdapter(
            key=b"k" * 32,
            key_id="primary",
            temp_dir=tmp_path / "crypto",
        )
        store = EncryptedBlobStoreAdapter(delegate=delegate, encryption=encryption)
        metadata = AssetMetadata(
            original_filename="document.txt",
            mime_type="text/plain",
            size_bytes=len(content),
            sha256=hashlib.sha256(content).hexdigest(),
        )

        blob_ref = await store.store(
            str(source),
            asset_id=None,
            kind=BlobKind.ORIGINAL,
            metadata=metadata,
        )
        remote_path = tmp_path / "uploads" / blob_ref.object_key
        assert content not in remote_path.read_bytes()
        assert metadata.sha256 not in blob_ref.object_key
        assert blob_ref.sha256 == metadata.sha256
        assert blob_ref.encryption.mode == EncryptionMode.AES_GCM

        session_factory = migrated_session_factory(tmp_path)
        catalog = SQLiteBlobRefCatalog(session_factory, FixedClock())
        await catalog.add(blob_ref)
        with session_scope(session_factory) as session:
            model = session.scalar(select(BlobRefModel).where(BlobRefModel.id == blob_ref.id))
            assert model is not None
            assert model.encryption_mode == "aes_gcm"
            assert model.encryption_key_id == "primary"
            assert model.encryption_nonce == blob_ref.encryption.nonce
            assert model.encryption_tag == blob_ref.encryption.tag

        destination = await store.download(blob_ref, tmp_path / "download.txt")
        assert destination.read_bytes() == content

        payload = bytearray(remote_path.read_bytes())
        payload[len(payload) // 2] ^= 1
        remote_path.write_bytes(payload)
        with pytest.raises(ValidationFailedError, match="authentication failed"):
            await store.download(blob_ref, tmp_path / "tampered.txt")

    asyncio.run(scenario())
