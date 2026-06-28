from pathlib import Path

DATA_DIRS = ("db", "cache", "uploads", "models", "journal", "config")


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    for child in DATA_DIRS:
        (root / "data" / child).mkdir(parents=True, exist_ok=True)
    print("Setup complete: data directories are present.")


if __name__ == "__main__":
    main()