import os
from pathlib import Path

REQUIRED_DATA_DIRS = ("db", "cache", "uploads", "models", "journal", "config")


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    missing = [name for name in REQUIRED_DATA_DIRS if not (root / "data" / name).is_dir()]
    storage_backend = os.getenv("STORAGE_BACKEND", "local")

    if missing:
        raise SystemExit(f"Missing data directories: {', '.join(missing)}. Run `make setup`.")
    if storage_backend == "telegram" and not os.getenv("TELEGRAM_BOT_TOKEN"):
        raise SystemExit("TELEGRAM_BOT_TOKEN is required only when STORAGE_BACKEND=telegram.")

    print(f"Doctor passed: STORAGE_BACKEND={storage_backend}.")


if __name__ == "__main__":
    main()