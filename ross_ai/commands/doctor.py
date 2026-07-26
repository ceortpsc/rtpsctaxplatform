"""Doctor — platform health diagnostics."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path
from typing import Sequence

from ross_ai import __version__
from ross_ai.manifest import load_manifest
from ross_ai.paths import (
    DIST_DIR,
    ENV_EXAMPLE,
    ENV_FILE,
    SCRIPTS_DIR,
    WORKSPACE_DIR,
    manifest_path,
)
from ross_ai.util import fail, info, ok


def run(root: Path, argv: Sequence[str]) -> int:
    as_json = "--json" in argv or "-j" in argv
    checks: list[dict[str, object]] = []

    def push(cid: str, passed: bool, detail: str) -> None:
        checks.append({"id": cid, "ok": passed, "detail": detail})

    push("python.version", sys.version_info >= (3, 11), f"{sys.version.split()[0]}")
    push("ross.entrypoint", (root / "ross.py").is_file(), "ross.py")
    push("ross.package", (root / "ross_ai").is_dir(), "ross_ai/")

    man_ok = manifest_path(root).is_file()
    push("ross.manifest", man_ok, "ross.json")
    if man_ok:
        try:
            man = load_manifest(root)
            push(
                "ross.manifest.valid",
                bool(man.get("name") and man.get("scripts")),
                f"name={man.get('name')} version={man.get('version')}",
            )
        except json.JSONDecodeError as err:
            push("ross.manifest.valid", False, str(err))

    push("workspace.dir", (root / WORKSPACE_DIR).is_dir(), WORKSPACE_DIR)
    push("workspace.scripts", (root / SCRIPTS_DIR).is_dir(), SCRIPTS_DIR)
    hello = root / SCRIPTS_DIR / "hello.py"
    push("script.hello", hello.is_file(), str(hello.relative_to(root)) if hello.is_file() else "missing")
    push("env.example", (root / ENV_EXAMPLE).is_file(), ENV_EXAMPLE)
    # Optional checks — reported but do not fail the doctor gate
    optional: list[dict[str, object]] = []
    optional.append(
        {
            "id": "env.file",
            "ok": (root / ENV_FILE).is_file(),
            "detail": (
                f"{ENV_FILE} present"
                if (root / ENV_FILE).is_file()
                else f"{ENV_FILE} optional — copy from {ENV_EXAMPLE}"
            ),
            "optional": True,
        }
    )
    optional.append(
        {
            "id": "docker.available",
            "ok": shutil.which("docker") is not None,
            "detail": "docker on PATH"
            if shutil.which("docker")
            else "docker not on PATH (optional for compose up)",
            "optional": True,
        }
    )
    push("dist.dir", True, DIST_DIR if (root / DIST_DIR).is_dir() else f"{DIST_DIR} (created on package build)")
    push("docker.compose.ross", (root / "docker-compose.ross.yml").is_file(), "docker-compose.ross.yml")

    failed = sum(1 for c in checks if not c["ok"])
    report = {
        "ok": failed == 0,
        "failed": failed,
        "rossVersion": __version__,
        "root": str(root),
        "checks": checks,
        "optional": optional,
    }

    if as_json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Ross doctor — {'signal clear' if failed == 0 else f'{failed} issue(s)'}")
        for c in checks:
            mark = "✓" if c["ok"] else "✖"
            print(f"  {mark} {c['id']} — {c['detail']}")
        for c in optional:
            mark = "✓" if c["ok"] else "·"
            print(f"  {mark} {c['id']} — {c['detail']}")
        if failed:
            fail("Doctor found issues. Run `python ross.py init` if the workspace is missing.")
        else:
            ok("All checks passed")
            info("Ready: python ross.py dev")

    return 0 if failed == 0 else 1
