"""Runtime script runner."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path
from typing import Sequence

from ross_ai.manifest import load_manifest
from ross_ai.util import fail, info, ok


def resolve_script(root: Path, name: str) -> Path:
    man = load_manifest(root)
    scripts = man.get("scripts") or {}
    if name in scripts:
        return (root / scripts[name]).resolve()
    # allow bare path or workspace/scripts/<name>.py
    candidates = [
        root / name,
        root / "workspace" / "scripts" / name,
        root / "workspace" / "scripts" / f"{name}.py",
    ]
    for c in candidates:
        if c.is_file():
            return c.resolve()
    raise FileNotFoundError(f"Unknown script '{name}'. Known: {', '.join(sorted(scripts)) or '(none)'}")


def run(root: Path, argv: Sequence[str]) -> int:
    if len(argv) < 2 or argv[0] != "run":
        fail("Usage: python ross.py runtime run <script>")
        return 2

    script_name = argv[1]
    script_args = list(argv[2:])
    path = resolve_script(root, script_name)
    if not path.is_file():
        fail(f"Script not found: {path}")
        return 1

    info(f"Running {path.relative_to(root)}")
    # Execute in isolated argv
    old_argv = sys.argv[:]
    try:
        sys.argv = [str(path), *script_args]
        runpy.run_path(str(path), run_name="__main__")
    finally:
        sys.argv = old_argv

    ok(f"Finished {script_name}")
    return 0
