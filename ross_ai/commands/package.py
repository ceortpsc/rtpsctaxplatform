"""Package builder — creates .rpkg archives and sha256 sidecars."""

from __future__ import annotations

import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence

from ross_ai.manifest import load_manifest
from ross_ai.paths import dist_path
from ross_ai.util import ensure_dir, fail, info, ok


def _iter_files(root: Path, include: Iterable[str]) -> list[Path]:
    files: list[Path] = []
    for pattern in include:
        target = root / pattern
        if target.is_file():
            files.append(target)
        elif target.is_dir():
            for path in sorted(target.rglob("*")):
                if path.is_file() and "__pycache__" not in path.parts and not path.name.endswith(".pyc"):
                    files.append(path)
        else:
            # glob support
            for path in sorted(root.glob(pattern)):
                if path.is_file():
                    files.append(path)
    # de-dupe preserve order
    seen: set[Path] = set()
    unique: list[Path] = []
    for f in files:
        rf = f.resolve()
        if rf not in seen:
            seen.add(rf)
            unique.append(f)
    return unique


def build_rpkg(root: Path) -> tuple[Path, Path]:
    man = load_manifest(root)
    pkg = man.get("package") or {}
    artifact_name = pkg.get("artifact") or "application.rpkg"
    include = pkg.get("include") or ["ross.py", "ross_ai", "ross.json"]

    out_dir = ensure_dir(dist_path(root))
    rpkg_path = out_dir / artifact_name
    sha_path = out_dir / f"{artifact_name}.sha256"

    files = _iter_files(root, include)
    if not files:
        raise RuntimeError("No files matched package.include — nothing to build")

    meta = {
        "format": "rpkg/1",
        "name": man.get("name", "application"),
        "version": man.get("version", "0.1.0"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "files": [str(f.relative_to(root)).replace("\\", "/") for f in files],
        "scripts": man.get("scripts") or {},
        "product": man.get("product"),
    }

    with zipfile.ZipFile(rpkg_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("rpkg-manifest.json", json.dumps(meta, indent=2) + "\n")
        for f in files:
            arc = str(f.relative_to(root)).replace("\\", "/")
            zf.write(f, arcname=arc)

    digest = hashlib.sha256(rpkg_path.read_bytes()).hexdigest()
    sha_path.write_text(f"{digest}  {artifact_name}\n", encoding="utf-8")
    return rpkg_path, sha_path


def run(root: Path, argv: Sequence[str]) -> int:
    if not argv or argv[0] != "build":
        fail("Usage: python ross.py package build")
        return 2

    rpkg_path, sha_path = build_rpkg(root)
    ok(f"Built {rpkg_path.relative_to(root)}")
    ok(f"Wrote {sha_path.relative_to(root)}")
    info(f"sha256 {sha_path.read_text(encoding='utf-8').split()[0]}")
    return 0
