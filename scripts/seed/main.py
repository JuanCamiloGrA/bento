from __future__ import annotations

import asyncio
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "apps" / "api"
if str(API_DIR / "src") not in sys.path:
    sys.path.insert(0, str(API_DIR / "src"))

from bento.adapters.jobs import SQLiteJobQueue
from bento.adapters.manifest import SQLiteManifestJournal
from bento.adapters.media import LocalUploadMetadataExtractor, SQLiteBlobRefCatalog
from bento.adapters.repositories import SQLiteAssetRepository, SQLiteFolderRepository
from bento.adapters.search.sqlite_fts import SQLiteFTSSearchIndex
from bento.application.ingestion import AssetIngestionService, UploadedAssetFile
from bento.application.upload import UploadAssetUseCase
from bento.domain.assets import AssetMode
from bento.infrastructure.db.clock import SystemClock
from bento.infrastructure.db.engine import create_session_factory, sqlite_url
from bento.infrastructure.settings import Settings
from bento.infrastructure.storage import create_blob_store


@dataclass(frozen=True, slots=True)
class SeedFile:
    content: bytes
    filename: str
    mime_type: str
    mode: AssetMode


SEED_FILES = (
    SeedFile(
        filename="factura-demo-bento.txt",
        mime_type="text/plain",
        content=b"Factura demo Bento\nCliente: Ada Lovelace\nTotal: 42.00\n",
        mode=AssetMode.DRIVE,
    ),
    SeedFile(
        filename="foto-playa-demo.jpg",
        mime_type="image/jpeg",
        content=(
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00"
            b"\xff\xdb\x00C\x00" + (b"\x08" * 64) + b"\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"
            b"\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08"
            b"\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
            b"\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00?\x00\xbf\xff\xd9"
        ),
        mode=AssetMode.PHOTOS,
    ),
)


def main() -> None:
    _run_migrations()
    asyncio.run(_seed())


async def _seed() -> None:
    data_dir = ROOT / "data"
    seed_dir = data_dir / "cache" / "seed"
    seed_dir.mkdir(parents=True, exist_ok=True)
    clock = SystemClock()
    settings = Settings(storage_backend="local", data_dir=str(data_dir))
    session_factory = create_session_factory(sqlite_url(data_dir / "db" / "bento.sqlite3"))
    assets = SQLiteAssetRepository(session_factory)
    folders = SQLiteFolderRepository(session_factory)
    blob_refs = SQLiteBlobRefCatalog(session_factory, clock)
    manifest = SQLiteManifestJournal(session_factory, clock, data_dir / "journal")
    jobs = SQLiteJobQueue(session_factory, clock)
    upload = UploadAssetUseCase(
        assets=assets,
        folders=folders,
        blob_store=create_blob_store(settings),
        jobs=jobs,
        manifest=manifest,
        clock=clock,
    )
    ingestion = AssetIngestionService(
        upload=upload,
        blob_refs=blob_refs,
        metadata_extractor=LocalUploadMetadataExtractor(),
    )
    search_index = SQLiteFTSSearchIndex(session_factory, clock)

    seeded_ids: list[str] = []
    for seed_file in SEED_FILES:
        source_path = seed_dir / seed_file.filename
        source_path.write_bytes(seed_file.content)
        result = await ingestion.upload_file(
            UploadedAssetFile(
                source_path=source_path,
                original_filename=seed_file.filename,
                declared_mime_type=seed_file.mime_type,
                mode=seed_file.mode,
            )
        )
        await search_index.index_asset(result.asset)
        seeded_ids.append(result.asset.id)

    print(f"Seed complete: {len(seeded_ids)} demo assets available ({', '.join(seeded_ids)}).")


def _run_migrations() -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_DIR,
        check=True,
    )


if __name__ == "__main__":
    main()
