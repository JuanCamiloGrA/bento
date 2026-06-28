from __future__ import annotations

import asyncio
import hashlib

from bento.adapters.media.metadata import LocalUploadMetadataExtractor
from bento.application.ingestion.metadata import sanitize_filename


def test_sanitize_filename_removes_paths_controls_and_reserved_names() -> None:
    assert sanitize_filename("../camera/photo.jpg") == "photo.jpg"
    assert sanitize_filename("bad\x00name.pdf") == "badname.pdf"
    assert sanitize_filename("CON.txt") == "_CON.txt"
    assert sanitize_filename("...") == "upload"


def test_extract_upload_metadata_sniffs_pdf_and_computes_sha(tmp_path) -> None:
    async def scenario() -> None:
        content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"
        source = tmp_path / "upload.tmp"
        source.write_bytes(content)

        metadata = await LocalUploadMetadataExtractor().extract(
            source,
            original_filename="../scan.bin",
            declared_mime_type="application/octet-stream",
        )

        assert metadata.filename == "scan.bin"
        assert metadata.mime_type == "application/pdf"
        assert metadata.size_bytes == len(content)
        assert metadata.sha256 == hashlib.sha256(content).hexdigest()
        assert metadata.exif is None

    asyncio.run(scenario())
