#!/usr/bin/env python3
"""Ross Tax Pro Software Co | RunTime AI Assist — command entrypoint.

Usage examples:
  python ross.py init
  python ross.py doctor
  python ross.py dev
  python ross.py package build
  python ross.py runtime run hello
  python ross.py deploy plan local
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ross_ai.cli import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
