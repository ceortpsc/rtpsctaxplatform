"""Initialize a Ross workspace."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

from ross_ai.manifest import default_manifest, save_manifest
from ross_ai.paths import (
    DIST_DIR,
    ENV_EXAMPLE,
    PLANS_DIR,
    SCRIPTS_DIR,
    WORKSPACE_DIR,
    manifest_path,
)
from ross_ai.util import ensure_dir, info, ok, write_json

HELLO_SCRIPT = '''#!/usr/bin/env python3
"""Sample Ross runtime script."""

def main() -> None:
    print("hello from Ross AI Runtime Platform")
    print({"ok": True, "script": "hello", "product": "Ross AI Runtime Platform"})


if __name__ == "__main__":
    main()
'''

ENV_EXAMPLE_BODY = """# Ross AI Runtime Platform
ROSS_HOST=127.0.0.1
ROSS_PORT=8787
ROSS_ENV=local
ROSS_LOG_LEVEL=info
# Optional placeholders — never commit real secrets
ROSS_API_TOKEN=unset
"""


def run(root: Path, argv: Sequence[str]) -> int:
    force = "--force" in argv or "-f" in argv
    name = "application"
    for i, arg in enumerate(argv):
        if arg == "--name" and i + 1 < len(argv):
            name = argv[i + 1]

    man_path = manifest_path(root)
    if man_path.is_file() and not force:
        info(f"Already initialized ({man_path.name}). Use --force to rewrite.")
    else:
        save_manifest(root, default_manifest(name))
        ok(f"Wrote {man_path.relative_to(root)}")

    for rel in (WORKSPACE_DIR, SCRIPTS_DIR, DIST_DIR, PLANS_DIR):
        ensure_dir(root / rel)
        gitkeep = root / rel / ".gitkeep"
        if not gitkeep.exists():
            gitkeep.write_text("", encoding="utf-8")

    hello = root / SCRIPTS_DIR / "hello.py"
    if not hello.is_file() or force:
        hello.write_text(HELLO_SCRIPT, encoding="utf-8")
        hello.chmod(hello.stat().st_mode | 0o111)
        ok(f"Wrote {hello.relative_to(root)}")

    env_example = root / ENV_EXAMPLE
    if not env_example.is_file() or force:
        env_example.write_text(ENV_EXAMPLE_BODY, encoding="utf-8")
        ok(f"Wrote {env_example.name}")

    meta = root / WORKSPACE_DIR / "project.json"
    write_json(
        meta,
        {
            "name": name,
            "scripts": ["hello"],
            "initialized": True,
        },
    )
    ok(f"Wrote {meta.relative_to(root)}")

    info("Next: python ross.py doctor")
    info("Then:  python ross.py dev")
    return 0
