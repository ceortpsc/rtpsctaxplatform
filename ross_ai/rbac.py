"""Strict RBAC — roles, permissions, and disciplined enforcement."""

from __future__ import annotations

from typing import Any, Iterable

# Permission catalog — explicit, auditable strings only.
PERMISSIONS: dict[str, str] = {
    "console.view": "View operator console and live stream",
    "inventory.read": "Read module/system inventory",
    "hardening.read": "Read hardening posture",
    "billing.read": "View own membership and payment-on-file",
    "billing.write": "Update payment method / autopay",
    "membership.elect": "Elect or change membership tier",
    "users.read": "View membership roster",
    "users.write": "Invite or modify user accounts",
    "roles.read": "View roles and permission matrix",
    "roles.assign": "Assign roles to users (strict)",
    "packages.read": "View package artifacts",
    "packages.build": "Build .rpkg packages",
    "deploy.read": "View deploy plans",
    "deploy.plan": "Generate deploy plans",
    "runtime.read": "View runtime scripts",
    "code.execute": "Execute approved workspace / personal scripts",
    "code.audit.read": "Read transparent execution audit trail",
    "code.scripts.write": "Create/update personal scripts for own purposes",
    "legal.read": "Read rules, regs, policy, disclosures",
    "github.link": "Link or use GitHub for account access",
    "security.mfa.manage": "Manage own MFA factors",
    "admin.audit.read": "Read full security/billing audit log",
}

# Role → frozenset of permissions. Higher roles expand deliberately.
_ROLE_PERMS: dict[str, frozenset[str]] = {
    "viewer": frozenset(
        {
            "console.view",
            "inventory.read",
            "hardening.read",
            "packages.read",
            "deploy.read",
            "runtime.read",
            "legal.read",
            "code.audit.read",
        }
    ),
    "operator": frozenset(),  # filled below
    "billing": frozenset(),
    "engineer": frozenset(),
    "admin": frozenset(),
    "owner": frozenset(PERMISSIONS.keys()),
}

_ROLE_PERMS["operator"] = _ROLE_PERMS["viewer"] | frozenset(
    {
        "billing.read",
        "membership.elect",
        "billing.write",
        "code.execute",
        "code.scripts.write",
        "github.link",
        "security.mfa.manage",
        "packages.build",
        "deploy.plan",
        "roles.read",
        "users.read",
    }
)
_ROLE_PERMS["billing"] = _ROLE_PERMS["operator"] | frozenset({"users.read"})
_ROLE_PERMS["engineer"] = _ROLE_PERMS["operator"] | frozenset(
    {
        "users.read",
        "roles.read",
        "admin.audit.read",
    }
)
_ROLE_PERMS["admin"] = _ROLE_PERMS["engineer"] | frozenset(
    {
        "users.write",
        "roles.assign",
        "roles.read",
        "admin.audit.read",
    }
)

ROLE_ORDER = ("viewer", "operator", "billing", "engineer", "admin", "owner")
DEFAULT_ROLE = "operator"

ROLE_DESCRIPTIONS: dict[str, str] = {
    "viewer": "Read-only console, inventory, packages, and execution audit.",
    "operator": "Default member — membership, billing self-serve, script execution for own purposes.",
    "billing": "Operator plus roster visibility for billing coordination.",
    "engineer": "Operator plus roles matrix visibility and admin audit read.",
    "admin": "User administration and role assignment (disciplined).",
    "owner": "Full permission set — platform stewardship.",
}


def normalize_role(role: str | None) -> str:
    r = (role or DEFAULT_ROLE).strip().lower()
    return r if r in _ROLE_PERMS else DEFAULT_ROLE


def permissions_for(role: str | None) -> frozenset[str]:
    return _ROLE_PERMS[normalize_role(role)]


def has_permission(role: str | None, permission: str) -> bool:
    return permission in permissions_for(role)


def require_permissions(role: str | None, needed: Iterable[str]) -> tuple[bool, list[str]]:
    have = permissions_for(role)
    missing = [p for p in needed if p not in have]
    return (len(missing) == 0, missing)


def rbac_matrix() -> dict[str, Any]:
    return {
        "roles": [
            {
                "id": rid,
                "description": ROLE_DESCRIPTIONS[rid],
                "permissions": sorted(_ROLE_PERMS[rid]),
                "permissionCount": len(_ROLE_PERMS[rid]),
            }
            for rid in ROLE_ORDER
        ],
        "permissions": [{"id": pid, "description": desc} for pid, desc in sorted(PERMISSIONS.items())],
        "defaultRole": DEFAULT_ROLE,
        "discipline": [
            "Deny by default — missing permission blocks the action.",
            "Role assignment requires roles.assign; owners/admins only.",
            "Execution requires code.execute; audit is always written.",
            "Permission checks are logged for transparency.",
        ],
    }


class RbacService:
    def __init__(self, store) -> None:
        self.store = store

    def role_of(self, email: str) -> str:
        user = (self.store.get().get("users") or {}).get(email) or {}
        return normalize_role(user.get("role"))

    def can(self, email: str, permission: str) -> bool:
        return has_permission(self.role_of(email), permission)

    def assign_role(self, actor_email: str, target_email: str, new_role: str) -> tuple[bool, str]:
        if not self.can(actor_email, "roles.assign"):
            return False, "Missing permission: roles.assign"
        new_role = normalize_role(new_role)
        if new_role == "owner" and self.role_of(actor_email) != "owner":
            return False, "Only an owner may assign the owner role."

        def mutate(data: dict[str, Any]) -> None:
            users = data.setdefault("users", {})
            target = users.get(target_email)
            if not target:
                raise KeyError(target_email)
            prev = target.get("role")
            target["role"] = new_role
            data.setdefault("audit", []).append(
                {
                    "at": __import__("time").time(),
                    "action": "rbac.assign",
                    "actor": actor_email,
                    "email": target_email,
                    "from": prev,
                    "to": new_role,
                }
            )
            data.setdefault("rbacDecisions", []).append(
                {
                    "at": __import__("time").time(),
                    "actor": actor_email,
                    "permission": "roles.assign",
                    "allowed": True,
                    "detail": f"{target_email} → {new_role}",
                }
            )

        try:
            self.store.update(mutate)
        except KeyError:
            return False, "Target user not found."
        return True, f"Role updated to {new_role}."

    def record_decision(
        self, email: str, permission: str, allowed: bool, detail: str = ""
    ) -> None:
        def mutate(data: dict[str, Any]) -> None:
            data.setdefault("rbacDecisions", []).append(
                {
                    "at": __import__("time").time(),
                    "email": email,
                    "permission": permission,
                    "allowed": allowed,
                    "detail": detail,
                    "role": self.role_of(email) if email else None,
                }
            )
            data["rbacDecisions"] = data["rbacDecisions"][-200:]

        self.store.update(mutate)

    def recent_decisions(self, limit: int = 50) -> list[dict[str, Any]]:
        return list(self.store.get().get("rbacDecisions") or [])[-limit:]
