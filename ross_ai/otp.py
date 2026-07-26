"""Six-digit OTP and TOTP (RFC 6238) helpers — stdlib only."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import struct
import time
from typing import Any
from urllib.parse import quote

from ross_ai.store import JsonStore

OTP_TTL_SEC = 10 * 60
OTP_DIGITS = 6
MAX_ATTEMPTS = 5
TOTP_STEP = 30
TOTP_WINDOW = 1


def generate_code(digits: int = OTP_DIGITS) -> str:
    upper = 10**digits
    return f"{secrets.randbelow(upper):0{digits}d}"


def hash_code(code: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()


def new_totp_secret(nbytes: int = 20) -> str:
    return base64.b32encode(os.urandom(nbytes)).decode("ascii").rstrip("=")


def _normalize_secret(secret: str) -> bytes:
    pad = "=" * ((8 - len(secret) % 8) % 8)
    return base64.b32decode(secret.upper() + pad, casefold=True)


def totp_at(secret: str, for_time: float | None = None, step: int = TOTP_STEP) -> str:
    counter = int((for_time if for_time is not None else time.time()) // step)
    key = _normalize_secret(secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{code_int % (10 ** OTP_DIGITS):0{OTP_DIGITS}d}"


def verify_totp(secret: str, code: str, window: int = TOTP_WINDOW) -> bool:
    code = (code or "").strip()
    if not code.isdigit() or len(code) != OTP_DIGITS:
        return False
    now = time.time()
    for w in range(-window, window + 1):
        if hmac.compare_digest(totp_at(secret, now + w * TOTP_STEP), code):
            return True
    return False


def otpauth_uri(secret: str, email: str, issuer: str = "RunTime AI Assist") -> str:
    label = quote(f"{issuer}:{email}")
    iss = quote(issuer)
    # Re-pad secret for URI consumers
    pad = "=" * ((8 - len(secret) % 8) % 8)
    return f"otpauth://totp/{label}?secret={secret}{pad}&issuer={iss}&digits={OTP_DIGITS}&period={TOTP_STEP}"


class OtpService:
    def __init__(self, store: JsonStore) -> None:
        self.store = store

    def issue(self, email: str, purpose: str) -> tuple[str, dict[str, Any]]:
        email = email.strip().lower()
        code = generate_code()
        salt = secrets.token_hex(8)
        record = {
            "purpose": purpose,
            "salt": salt,
            "hash": hash_code(code, salt),
            "expiresAt": time.time() + OTP_TTL_SEC,
            "attempts": 0,
            "createdAt": time.time(),
        }

        def mutate(data: dict[str, Any]) -> None:
            otps = data.setdefault("otps", {})
            otps[f"{email}:{purpose}"] = record
            inbox = data.setdefault("devInbox", [])
            inbox.append(
                {
                    "at": time.time(),
                    "email": email,
                    "purpose": purpose,
                    "code": code,
                    "channel": "email",
                }
            )
            # keep last 40
            data["devInbox"] = inbox[-40:]
            data.setdefault("audit", []).append(
                {"at": time.time(), "action": f"otp.issue.{purpose}", "email": email}
            )

        self.store.update(mutate)
        meta = {"email": email, "purpose": purpose, "expiresInSec": OTP_TTL_SEC}
        return code, meta

    def verify(self, email: str, purpose: str, code: str) -> tuple[bool, str]:
        email = email.strip().lower()
        code = (code or "").strip()
        if not code.isdigit() or len(code) != OTP_DIGITS:
            return False, "Enter the 6-digit code."

        result = {"ok": False, "msg": "Invalid or expired code."}

        def mutate(data: dict[str, Any]) -> None:
            key = f"{email}:{purpose}"
            otps = data.setdefault("otps", {})
            rec = otps.get(key)
            if not rec:
                result["msg"] = "No active code. Request a new one."
                return
            if time.time() > float(rec.get("expiresAt", 0)):
                otps.pop(key, None)
                result["msg"] = "Code expired. Request a new one."
                return
            attempts = int(rec.get("attempts", 0))
            if attempts >= MAX_ATTEMPTS:
                otps.pop(key, None)
                result["msg"] = "Too many attempts. Request a new code."
                return
            rec["attempts"] = attempts + 1
            expected = rec.get("hash", "")
            actual = hash_code(code, rec.get("salt", ""))
            if not hmac.compare_digest(expected, actual):
                result["msg"] = "Incorrect code."
                return
            otps.pop(key, None)
            result["ok"] = True
            result["msg"] = "Verified."
            data.setdefault("audit", []).append(
                {"at": time.time(), "action": f"otp.verify.{purpose}", "email": email}
            )

        self.store.update(mutate)
        return bool(result["ok"]), str(result["msg"])

    def latest_dev_code(self, email: str, purpose: str) -> str | None:
        email = email.strip().lower()
        inbox = self.store.get().get("devInbox") or []
        for item in reversed(inbox):
            if item.get("email") == email and item.get("purpose") == purpose:
                return item.get("code")
        return None
