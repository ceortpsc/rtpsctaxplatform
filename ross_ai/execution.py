"""Transparent code execution — audited, RBAC-gated, policy-checked."""

from __future__ import annotations

import ast
import io
import runpy
import sys
import time
import traceback
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any

# Disciplined deny-list for import names (AST policy).
FORBIDDEN_IMPORTS = frozenset(
    {
        "subprocess",
        "socket",
        "ctypes",
        "multiprocessing",
        "signal",
        "pty",
        "fcntl",
        "http.server",
    }
)
FORBIDDEN_ATTR_CALLS = frozenset(
    {
        "system",
        "popen",
        "exec",
        "eval",
        "execfile",
        "__import__",
    }
)


class PolicyViolation(Exception):
    pass


def _policy_check(source: str) -> list[str]:
    issues: list[str] = []
    try:
        tree = ast.parse(source)
    except SyntaxError as err:
        return [f"syntax: {err}"]
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root in FORBIDDEN_IMPORTS or alias.name in FORBIDDEN_IMPORTS:
                    issues.append(f"forbidden import: {alias.name}")
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            root = mod.split(".")[0]
            if root in FORBIDDEN_IMPORTS or mod in FORBIDDEN_IMPORTS:
                issues.append(f"forbidden import: {mod}")
        elif isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name) and func.id in FORBIDDEN_ATTR_CALLS:
                issues.append(f"forbidden call: {func.id}()")
            if isinstance(func, ast.Attribute) and func.attr in FORBIDDEN_ATTR_CALLS:
                issues.append(f"forbidden call: .{func.attr}()")
    return issues


class ExecutionService:
    def __init__(self, store, root: Path) -> None:
        self.store = store
        self.root = root

    def user_scripts_dir(self, email: str) -> Path:
        safe = email.replace("@", "_at_").replace("/", "_")
        path = self.root / "workspace" / "user-scripts" / safe
        path.mkdir(parents=True, exist_ok=True)
        return path

    def list_runnable(self, email: str) -> list[dict[str, Any]]:
        items = []
        shared = self.root / "workspace" / "scripts"
        if shared.is_dir():
            for p in sorted(shared.glob("*.py")):
                items.append({"id": f"shared:{p.name}", "name": p.name, "scope": "shared", "path": str(p.relative_to(self.root))})
        for p in sorted(self.user_scripts_dir(email).glob("*.py")):
            items.append({"id": f"personal:{p.name}", "name": p.name, "scope": "personal", "path": str(p.relative_to(self.root))})
        return items

    def save_personal_script(self, email: str, name: str, source: str) -> tuple[bool, str, Path | None]:
        name = Path(name).name
        if not name.endswith(".py"):
            name += ".py"
        if not name.replace("_", "").replace("-", "").removesuffix(".py").isalnum():
            return False, "Script name must be alphanumeric (plus - _).", None
        issues = _policy_check(source)
        if issues:
            return False, "Policy blocked save: " + "; ".join(issues), None
        path = self.user_scripts_dir(email) / name
        path.write_text(source, encoding="utf-8")
        return True, f"Saved {path.relative_to(self.root)}", path

    def resolve(self, email: str, script_id: str) -> Path | None:
        if script_id.startswith("shared:"):
            name = Path(script_id.split(":", 1)[1]).name
            path = self.root / "workspace" / "scripts" / name
            return path if path.is_file() else None
        if script_id.startswith("personal:"):
            name = Path(script_id.split(":", 1)[1]).name
            path = self.user_scripts_dir(email) / name
            return path if path.is_file() else None
        # bare name → shared then personal
        shared = self.root / "workspace" / "scripts" / Path(script_id).name
        if shared.is_file():
            return shared
        personal = self.user_scripts_dir(email) / Path(script_id).name
        return personal if personal.is_file() else None

    def execute(self, email: str, script_id: str, *, argv: list[str] | None = None) -> dict[str, Any]:
        path = self.resolve(email, script_id)
        started = time.time()
        record: dict[str, Any] = {
            "at": started,
            "email": email,
            "scriptId": script_id,
            "path": str(path.relative_to(self.root)) if path else None,
            "ok": False,
            "stdout": "",
            "stderr": "",
            "durationMs": 0,
            "policy": [],
            "transparent": True,
        }
        if not path:
            record["stderr"] = "Script not found."
            self._audit(record)
            return record

        source = path.read_text(encoding="utf-8")
        issues = _policy_check(source)
        record["policy"] = issues
        if issues:
            record["stderr"] = "Execution denied by transparent policy: " + "; ".join(issues)
            self._audit(record)
            return record

        out = io.StringIO()
        err = io.StringIO()
        old_argv = sys.argv[:]
        try:
            sys.argv = [str(path), *(argv or [])]
            with redirect_stdout(out), redirect_stderr(err):
                runpy.run_path(str(path), run_name="__main__")
            record["ok"] = True
        except SystemExit as exc:
            code = exc.code if isinstance(exc.code, int) else 0
            record["ok"] = code == 0
            if code not in (0, None):
                err.write(f"SystemExit: {code}\n")
        except Exception:  # noqa: BLE001
            err.write(traceback.format_exc())
            record["ok"] = False
        finally:
            sys.argv = old_argv
            record["stdout"] = out.getvalue()[-20000:]
            record["stderr"] = err.getvalue()[-20000:]
            record["durationMs"] = int((time.time() - started) * 1000)
            self._audit(record)
        return record

    def _audit(self, record: dict[str, Any]) -> None:
        def mutate(data: dict[str, Any]) -> None:
            data.setdefault("executions", []).append(record)
            data["executions"] = data["executions"][-200:]
            data.setdefault("audit", []).append(
                {
                    "at": record["at"],
                    "action": "code.execute",
                    "email": record.get("email"),
                    "ok": record.get("ok"),
                    "scriptId": record.get("scriptId"),
                    "transparent": True,
                }
            )

        self.store.update(mutate)

    def recent(self, email: str | None = None, limit: int = 40) -> list[dict[str, Any]]:
        items = list(self.store.get().get("executions") or [])
        if email:
            items = [e for e in items if e.get("email") == email]
        return items[-limit:]
