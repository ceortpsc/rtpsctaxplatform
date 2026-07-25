"""Minimal WebSocket framing (RFC 6455) — stdlib only."""

from __future__ import annotations

import base64
import hashlib
import json
import struct
import threading
from typing import Any, Callable

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def accept_key(sec_key: str) -> str:
    digest = hashlib.sha1((sec_key + GUID).encode("utf-8")).digest()
    return base64.b64encode(digest).decode("ascii")


def encode_text(message: str) -> bytes:
    data = message.encode("utf-8")
    length = len(data)
    if length < 126:
        header = bytes([0x81, length])
    elif length < 65536:
        header = bytes([0x81, 126]) + struct.pack("!H", length)
    else:
        header = bytes([0x81, 127]) + struct.pack("!Q", length)
    return header + data


def encode_json(payload: dict[str, Any]) -> bytes:
    return encode_text(json.dumps(payload, separators=(",", ":")))


def decode_frames(buffer: bytearray) -> tuple[list[str], bytearray]:
    """Decode complete text frames; return messages and remaining buffer."""
    messages: list[str] = []
    while True:
        if len(buffer) < 2:
            break
        b1, b2 = buffer[0], buffer[1]
        opcode = b1 & 0x0F
        masked = (b2 & 0x80) != 0
        length = b2 & 0x7F
        idx = 2
        if length == 126:
            if len(buffer) < 4:
                break
            length = struct.unpack("!H", buffer[2:4])[0]
            idx = 4
        elif length == 127:
            if len(buffer) < 10:
                break
            length = struct.unpack("!Q", buffer[2:10])[0]
            idx = 10
        mask_len = 4 if masked else 0
        if len(buffer) < idx + mask_len + length:
            break
        mask = buffer[idx : idx + mask_len] if masked else b""
        idx += mask_len
        payload = bytearray(buffer[idx : idx + length])
        del buffer[: idx + length]
        if masked:
            for i in range(len(payload)):
                payload[i] ^= mask[i % 4]
        if opcode == 0x8:  # close
            messages.append("")
            break
        if opcode == 0x9:  # ping — ignore / app may pong
            continue
        if opcode in (0x1, 0x2, 0x0):
            messages.append(bytes(payload).decode("utf-8", errors="replace"))
    return messages, buffer


class WebSocketHub:
    def __init__(self) -> None:
        self._clients: list[Callable[[bytes], None]] = []
        self._lock = threading.Lock()

    def add(self, send: Callable[[bytes], None]) -> Callable[[], None]:
        with self._lock:
            self._clients.append(send)

        def remove() -> None:
            with self._lock:
                if send in self._clients:
                    self._clients.remove(send)

        return remove

    def broadcast(self, payload: dict[str, Any]) -> None:
        frame = encode_json(payload)
        with self._lock:
            clients = list(self._clients)
        dead: list[Callable[[bytes], None]] = []
        for send in clients:
            try:
                send(frame)
            except Exception:  # noqa: BLE001
                dead.append(send)
        if dead:
            with self._lock:
                for d in dead:
                    if d in self._clients:
                        self._clients.remove(d)

    @property
    def connections(self) -> int:
        with self._lock:
            return len(self._clients)
