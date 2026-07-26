"""Project manifest (ross.json) load/save."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ross_ai import __brand__, __product__, __version__
from ross_ai.paths import DEFAULT_HOST, DEFAULT_PORT, manifest_path
from ross_ai.util import read_json, write_json


def default_manifest(name: str = "application") -> dict[str, Any]:
    return {
        "name": name,
        "version": "0.1.0",
        "product": __product__,
        "brand": __brand__,
        "runtime": {
            "python": ">=3.11",
            "entry": "ross.py",
            "platform": {"host": DEFAULT_HOST, "port": DEFAULT_PORT},
        },
        "scripts": {
            "hello": "workspace/scripts/hello.py",
        },
        "package": {
            "artifact": "application.rpkg",
            "include": [
                "ross.py",
                "ross_ai",
                "ross.json",
                "workspace/scripts",
                "requirements.txt",
                ".env.example",
            ],
        },
        "rossVersion": __version__,
    }


def load_manifest(root: Path) -> dict[str, Any]:
    path = manifest_path(root)
    if not path.is_file():
        raise FileNotFoundError(
            f"Missing {path.name}. Run `python ross.py init` first."
        )
    return read_json(path)


def save_manifest(root: Path, data: dict[str, Any]) -> Path:
    path = manifest_path(root)
    write_json(path, data)
    return path
