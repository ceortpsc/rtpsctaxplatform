from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    "POLICY_INDEX.md",
    "GOVERNANCE.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SUPPORT.md",
    "docs/policies/POLICY_MANUAL.md",
    "config/policy-manifest.json",
    "config/retention-policy.json",
    "config/security-controls.json",
]

errors: list[str] = []

for relative in REQUIRED:
    path = ROOT / relative
    if not path.is_file() or path.stat().st_size < 40:
        errors.append(f"missing or empty: {relative}")

for relative in [
    "config/policy-manifest.json",
    "config/retention-policy.json",
    "config/security-controls.json",
]:
    try:
        json.loads((ROOT / relative).read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid JSON {relative}: {exc}")

manifest_path = ROOT / "config" / "policy-manifest.json"
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for item in manifest.get("policies", []):
        referenced = ROOT / item["path"]
        if not referenced.is_file():
            errors.append(f"manifest path missing: {item['path']}")

if errors:
    print("\n".join(f"ERROR: {item}" for item in errors))
    sys.exit(1)

print("Policy validation passed.")
