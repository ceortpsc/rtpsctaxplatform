from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.runtime_store import RuntimeStore


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--worker", default="")
    parser.add_argument("--stale-seconds", type=float, default=45)
    args = parser.parse_args()
    base = Path(__file__).resolve().parents[2]
    store = RuntimeStore(base / "data" / "ross_runtime.db")
    if not store.database_health()["ok"]:
        raise SystemExit(1)
    if args.worker and not store.worker_is_fresh(args.worker, args.stale_seconds):
        raise SystemExit(1)
    print("healthy")


if __name__ == "__main__":
    main()
