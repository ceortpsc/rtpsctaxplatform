"""Shared I/O and console helpers."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def write_json(path: Path, data: Any, *, indent: int = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=indent) + "\n", encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def ok(msg: str) -> None:
    print(f"✓ {msg}")


def info(msg: str) -> None:
    print(f"· {msg}")


def fail(msg: str) -> None:
    eprint(f"✖ {msg}")
