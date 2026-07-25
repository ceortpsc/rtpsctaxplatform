"""Operator authentication — signup / sign-in / sessions / CSRF (stdlib)."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass
from typing import Any

from ross_ai.store import JsonStore

PBKDF2_ITERATIONS = 210_000
SESSION_TTL_SEC = 60 * 60 * 12  # 12h
MIN_PASSWORD_LEN = 10


@dataclass
class Session:
    token: str
    email: str
    csrf: str
    expires_at: float

    @property
    def expired(self) -> bool:
        return time.time() >= self.expires_at


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def _verify_password(password: str, encoded: str) -> bool:
    try:
        algo, iters_s, salt_hex, hash_hex = encoded.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iters = int(iters_s)
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters)
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


class AuthService:
    def __init__(self, store: JsonStore) -> None:
        self.store = store

    def signup(self, email: str, password: str, name: str = "") -> tuple[bool, str, Session | None]:
        email = email.strip().lower()
        name = (name or "").strip() or email.split("@")[0]
        if "@" not in email or "." not in email.split("@")[-1]:
            return False, "Enter a valid email address.", None
        if len(password) < MIN_PASSWORD_LEN:
            return False, f"Password must be at least {MIN_PASSWORD_LEN} characters.", None
        if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
            return False, "Password must include letters and numbers.", None

        created: dict[str, Any] = {}

        def mutate(data: dict[str, Any]) -> None:
            users = data.setdefault("users", {})
            if email in users:
                created["err"] = "An account with that email already exists."
                return
            users[email] = {
                "email": email,
                "name": name,
                "password": _hash_password(password),
                "role": "operator",
                "createdAt": time.time(),
            }
            data.setdefault("audit", []).append(
                {"at": time.time(), "action": "signup", "email": email}
            )

        self.store.update(mutate)
        if created.get("err"):
            return False, str(created["err"]), None
        session = self._create_session(email)
        return True, "Account created.", session

    def login(self, email: str, password: str) -> tuple[bool, str, Session | None]:
        email = email.strip().lower()
        data = self.store.get()
        user = (data.get("users") or {}).get(email)
        if not user or not _verify_password(password, user.get("password", "")):
            return False, "Invalid email or password.", None
        session = self._create_session(email)

        def mutate(d: dict[str, Any]) -> None:
            d.setdefault("audit", []).append({"at": time.time(), "action": "login", "email": email})

        self.store.update(mutate)
        return True, "Signed in.", session

    def logout(self, token: str | None) -> None:
        if not token:
            return

        def mutate(data: dict[str, Any]) -> None:
            sessions = data.setdefault("sessions", {})
            sess = sessions.pop(token, None)
            if sess:
                data.setdefault("audit", []).append(
                    {"at": time.time(), "action": "logout", "email": sess.get("email")}
                )

        self.store.update(mutate)

    def get_session(self, token: str | None) -> Session | None:
        if not token:
            return None
        data = self.store.get()
        raw = (data.get("sessions") or {}).get(token)
        if not raw:
            return None
        sess = Session(
            token=token,
            email=raw["email"],
            csrf=raw["csrf"],
            expires_at=float(raw["expires_at"]),
        )
        if sess.expired:
            self.logout(token)
            return None
        return sess

    def user_profile(self, email: str) -> dict[str, Any] | None:
        user = (self.store.get().get("users") or {}).get(email)
        if not user:
            return None
        return {
            "email": user["email"],
            "name": user.get("name") or email,
            "role": user.get("role", "operator"),
        }

    def validate_csrf(self, session: Session | None, token: str | None) -> bool:
        if not session or not token:
            return False
        return hmac.compare_digest(session.csrf, token)

    def _create_session(self, email: str) -> Session:
        token = secrets.token_urlsafe(32)
        csrf = secrets.token_urlsafe(24)
        expires = time.time() + SESSION_TTL_SEC
        session = Session(token=token, email=email, csrf=csrf, expires_at=expires)

        def mutate(data: dict[str, Any]) -> None:
            sessions = data.setdefault("sessions", {})
            # prune expired
            now = time.time()
            for k, v in list(sessions.items()):
                if float(v.get("expires_at", 0)) < now:
                    sessions.pop(k, None)
            sessions[token] = {
                "email": email,
                "csrf": csrf,
                "expires_at": expires,
            }

        self.store.update(mutate)
        return session
