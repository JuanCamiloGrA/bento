from __future__ import annotations

import ast
from pathlib import Path


FORBIDDEN_PREFIXES = {
    "aiogram",
    "fastapi",
    "pydantic",
    "rapidocr",
    "sqlalchemy",
    "sqlite_vec",
    "uvicorn",
}
FORBIDDEN_NAMES = {"ffmpeg"}


def test_domain_imports_no_forbidden_external_dependencies() -> None:
    domain_path = Path(__file__).parents[2] / "src" / "bento" / "domain"
    violations: list[tuple[str, str]] = []

    for path in domain_path.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if _is_forbidden(alias.name):
                        violations.append((path.name, alias.name))
            elif isinstance(node, ast.ImportFrom) and node.module is not None and _is_forbidden(node.module):
                violations.append((path.name, node.module))

    assert violations == []


def _is_forbidden(module: str) -> bool:
    root = module.split(".", maxsplit=1)[0]
    return root in FORBIDDEN_PREFIXES or root in FORBIDDEN_NAMES
