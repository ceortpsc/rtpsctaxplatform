#!/usr/bin/env python3
"""Deterministic PDF fill scaffold for RTPSC (no live IRS calls)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def describe(template: Path) -> dict:
    return {
        "engine": "pdf-fill-engine",
        "status": "scaffold",
        "template": str(template),
        "actions": ["load-template", "map-fields", "write-output"],
        "compliance": [
            "Do not embed taxpayer credentials in source.",
            "Use approved secret stores for signing material.",
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="RTPSC PDF fill engine scaffold")
    parser.add_argument("--template", type=Path, default=Path("forms/templates"))
    parser.add_argument("--json", action="store_true", help="Emit JSON descriptor")
    args = parser.parse_args(argv)

    payload = describe(args.template)
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"{payload['engine']}: {payload['status']} ({payload['template']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
