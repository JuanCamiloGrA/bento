from __future__ import annotations

import subprocess
import sys
from pathlib import Path

DATA_DIRS = ("db", "cache", "uploads", "models", "journal", "config")


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    for child in DATA_DIRS:
        (root / "data" / child).mkdir(parents=True, exist_ok=True)
    _run_migrations(root)
    print("Setup complete: data directories are present and SQLite migrations are current.")


def _run_migrations(root: Path) -> None:
    api_dir = root / "apps" / "api"
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=api_dir,
        check=True,
    )


if __name__ == "__main__":
    main()
