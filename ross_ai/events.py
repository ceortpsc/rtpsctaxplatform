"""In-process event bus for live WebSocket fan-out."""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any, Callable


class EventBus:
    def __init__(self, history: int = 100) -> None:
        self._subs: list[Callable[[dict[str, Any]], None]] = []
        self._lock = threading.Lock()
        self._history: deque[dict[str, Any]] = deque(maxlen=history)

    def publish(self, kind: str, **payload: Any) -> dict[str, Any]:
        event = {"type": kind, "at": time.time(), **payload}
        with self._lock:
            self._history.append(event)
            subs = list(self._subs)
        for fn in subs:
            try:
                fn(event)
            except Exception:  # noqa: BLE001
                pass
        return event

    def subscribe(self, fn: Callable[[dict[str, Any]], None]) -> Callable[[], None]:
        with self._lock:
            self._subs.append(fn)

        def unsubscribe() -> None:
            with self._lock:
                if fn in self._subs:
                    self._subs.remove(fn)

        return unsubscribe

    def recent(self, limit: int = 40) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._history)[-limit:]
