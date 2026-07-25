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
from ross_ai.rbac import DEFAULT_ROLE

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
                "role": DEFAULT_ROLE,
                "createdAt": time.time(),
                "emailVerified": False,
                "mfaEnabled": False,
                "mfaSecret": None,
                "authProviders": ["password"],
            }
            data.setdefault("audit", []).append(
                {"at": time.time(), "action": "signup", "email": email}
            )

        self.store.update(mutate)
        if created.get("err"):
            return False, str(created["err"]), None
        session = self._create_session(email)
        return True, "Account created.", session

    def login(self, email: str, password: str) -> tuple[bool, str, Session | None, dict[str, Any] | None]:
        """Returns (ok, message, session_or_none, mfa_challenge_or_none)."""
        email = email.strip().lower()
        data = self.store.get()
        user = (data.get("users") or {}).get(email)
        if not user or not user.get("password") or not _verify_password(password, user.get("password", "")):
            return False, "Invalid email or password.", None, None

        if user.get("mfaEnabled") and user.get("mfaSecret"):
            challenge = self._create_mfa_challenge(email)

            def mutate(d: dict[str, Any]) -> None:
                d.setdefault("audit", []).append(
                    {"at": time.time(), "action": "login.mfa_required", "email": email}
                )

            self.store.update(mutate)
            return True, "MFA required.", None, challenge

        session = self._create_session(email)

        def mutate(d: dict[str, Any]) -> None:
            d.setdefault("audit", []).append({"at": time.time(), "action": "login", "email": email})

        self.store.update(mutate)
        return True, "Signed in.", session, None

    def complete_mfa_login(self, challenge_token: str) -> tuple[bool, str, Session | None]:
        data = self.store.get()
        challenges = data.get("mfaChallenges") or {}
        raw = challenges.get(challenge_token)
        if not raw:
            return False, "MFA challenge expired. Sign in again.", None
        if time.time() > float(raw.get("expires_at", 0)):
            self.clear_mfa_challenge(challenge_token)
            return False, "MFA challenge expired. Sign in again.", None
        email = raw["email"]
        self.clear_mfa_challenge(challenge_token)
        session = self._create_session(email)

        def mutate(d: dict[str, Any]) -> None:
            d.setdefault("audit", []).append(
                {"at": time.time(), "action": "login.mfa_ok", "email": email}
            )

        self.store.update(mutate)
        return True, "Signed in.", session

    def get_mfa_challenge(self, token: str | None) -> dict[str, Any] | None:
        if not token:
            return None
        raw = (self.store.get().get("mfaChallenges") or {}).get(token)
        if not raw:
            return None
        if time.time() > float(raw.get("expires_at", 0)):
            self.clear_mfa_challenge(token)
            return None
        return raw

    def clear_mfa_challenge(self, token: str | None) -> None:
        if not token:
            return

        def mutate(data: dict[str, Any]) -> None:
            (data.setdefault("mfaChallenges", {})).pop(token, None)

        self.store.update(mutate)

    def mark_email_verified(self, email: str) -> None:
        def mutate(data: dict[str, Any]) -> None:
            user = data.setdefault("users", {}).get(email)
            if user:
                user["emailVerified"] = True
                data.setdefault("audit", []).append(
                    {"at": time.time(), "action": "email.verified", "email": email}
                )

        self.store.update(mutate)

    def begin_mfa_enrollment(self, email: str) -> str:
        secret = __import__("ross_ai.otp", fromlist=["new_totp_secret"]).new_totp_secret()

        def mutate(data: dict[str, Any]) -> None:
            user = data.setdefault("users", {}).get(email)
            if not user:
                raise KeyError(email)
            user["mfaSecretPending"] = secret

        self.store.update(mutate)
        return secret

    def confirm_mfa_enrollment(self, email: str, code: str) -> tuple[bool, str]:
        from ross_ai.otp import verify_totp

        user = (self.store.get().get("users") or {}).get(email) or {}
        secret = user.get("mfaSecretPending") or user.get("mfaSecret")
        if not secret:
            return False, "Start MFA setup again."
        if not verify_totp(secret, code):
            return False, "Invalid authenticator code."

        def mutate(data: dict[str, Any]) -> None:
            u = data.setdefault("users", {}).get(email)
            if not u:
                return
            u["mfaSecret"] = secret
            u["mfaEnabled"] = True
            u.pop("mfaSecretPending", None)
            data.setdefault("audit", []).append(
                {"at": time.time(), "action": "mfa.enabled", "email": email}
            )

        self.store.update(mutate)
        return True, "MFA enabled."

    def mfa_secret_for(self, email: str) -> str | None:
        user = (self.store.get().get("users") or {}).get(email) or {}
        return user.get("mfaSecret") or user.get("mfaSecretPending")

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
        mem = user.get("membership") or {}
        return {
            "email": user["email"],
            "name": user.get("name") or email,
            "role": user.get("role", DEFAULT_ROLE),
            "membership": mem or None,
            "membershipActive": bool(mem.get("status") == "active"),
            "tierId": mem.get("tierId"),
            "tierName": mem.get("tierName"),
            "emailVerified": bool(user.get("emailVerified")),
            "mfaEnabled": bool(user.get("mfaEnabled")),
            "github": user.get("github"),
            "authProviders": list(user.get("authProviders") or ["password"]),
        }

    def upsert_github_user(self, profile: dict[str, Any]) -> tuple[Session, bool]:
        """Create or link a GitHub-authenticated user. Returns (session, created)."""
        email = (profile.get("email") or "").strip().lower()
        if not email:
            raise ValueError("GitHub profile missing email")
        created = {"flag": False}

        def mutate(data: dict[str, Any]) -> None:
            users = data.setdefault("users", {})
            user = users.get(email)
            gh = {
                "id": str(profile.get("id")),
                "login": profile.get("login"),
                "avatarUrl": profile.get("avatarUrl"),
                "htmlUrl": profile.get("htmlUrl"),
            }
            if not user:
                created["flag"] = True
                users[email] = {
                    "email": email,
                    "name": profile.get("name") or profile.get("login") or email,
                    "password": None,
                    "role": DEFAULT_ROLE,
                    "createdAt": time.time(),
                    "emailVerified": True,  # GitHub verified email path
                    "mfaEnabled": False,
                    "mfaSecret": None,
                    "github": gh,
                    "authProviders": ["github"],
                }
                action = "signup.github"
            else:
                user["github"] = gh
                providers = set(user.get("authProviders") or [])
                providers.add("github")
                # GitHub verified emails count as verified
                if not user.get("emailVerified"):
                    user["emailVerified"] = True
                user["authProviders"] = sorted(providers)
                if not user.get("name"):
                    user["name"] = profile.get("name") or profile.get("login")
                action = "login.github"
            data.setdefault("audit", []).append(
                {"at": time.time(), "action": action, "email": email, "github": gh.get("login")}
            )

        self.store.update(mutate)
        return self._create_session(email), bool(created["flag"])

    def validate_csrf(self, session: Session | None, token: str | None) -> bool:
        if not session or not token:
            return False
        return hmac.compare_digest(session.csrf, token)

    def _create_mfa_challenge(self, email: str) -> dict[str, Any]:
        token = secrets.token_urlsafe(24)
        expires = time.time() + 10 * 60
        challenge = {"token": token, "email": email, "expires_at": expires}

        def mutate(data: dict[str, Any]) -> None:
            challenges = data.setdefault("mfaChallenges", {})
            now = time.time()
            for k, v in list(challenges.items()):
                if float(v.get("expires_at", 0)) < now:
                    challenges.pop(k, None)
            challenges[token] = {"email": email, "expires_at": expires}

        self.store.update(mutate)
        return challenge

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
