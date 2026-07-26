"""Persistent JSON store for Ross control-plane state."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

_lock = threading.RLock()


class JsonStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.is_file():
            self._write({"users": {}, "sessions": {}, "audit": [], "settings": {}})

    def _read(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    def _write(self, data: dict[str, Any]) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self.path)

    def get(self) -> dict[str, Any]:
        with _lock:
            return self._read()

    def update(self, mutator) -> dict[str, Any]:
        with _lock:
            data = self._read()
            mutator(data)
            self._write(data)
            return data
