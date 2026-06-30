from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    return subprocess.run(["uv", "run", "pytest"], cwd=repo_root / "apps" / "api", check=False).returncode


if __name__ == "__main__":
    sys.exit(main())
