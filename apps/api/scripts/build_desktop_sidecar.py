from __future__ import annotations

import argparse
from pathlib import Path

import PyInstaller.__main__


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    api_root = Path(__file__).resolve().parents[1]
    output = arguments.output.resolve()
    PyInstaller.__main__.run(
        [
            str(api_root / "packaging" / "bento-sidecar.spec"),
            "--noconfirm",
            "--clean",
            "--distpath",
            str(output),
            "--workpath",
            str(output / ".pyinstaller-work"),
        ]
    )


if __name__ == "__main__":
    main()
