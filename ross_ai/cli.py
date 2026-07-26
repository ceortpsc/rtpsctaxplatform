"""ross.py CLI dispatcher."""

from __future__ import annotations

from typing import Sequence

from ross_ai import __product__, __version__
from ross_ai.commands import deploy, doctor, init, package, platform, runtime
from ross_ai.paths import find_root
from ross_ai.util import eprint, fail

HELP = f"""{__product__} v{__version__}

Usage:
  python ross.py <command> [args]

Commands:
  init                         Initialize workspace + ross.json
  doctor                       Health diagnostics
  dev                          Start local platform (http://127.0.0.1:8787)
  package build                Build application.rpkg (+ sha256)
  runtime run <script>         Run a workspace script (e.g. hello)
  deploy plan <target>         Generate a deployment plan
  start                        Alias for dev (start the platform)
  version                      Print version
  help                         Show this help

Deploy targets:
  local, docker, kubernetes, aws-lambda, aws-ecs,
  azure-functions, gcp-cloud-run, edge-worker

Examples:
  python ross.py init
  python ross.py doctor
  python ross.py dev
  python ross.py package build
  python ross.py runtime run hello
  python ross.py deploy plan docker
"""


def main(argv: Sequence[str] | None = None) -> int:
    args = list(argv if argv is not None else [])
    if not args or args[0] in {"help", "-h", "--help"}:
        print(HELP)
        return 0

    command = args[0]
    rest = args[1:]
    root = find_root()

    try:
        if command == "version":
            print(f"ross/{__version__}")
            return 0
        if command == "init":
            return init.run(root, rest)
        if command == "doctor":
            return doctor.run(root, rest)
        if command in {"dev", "start"}:
            return platform.run_dev(root, rest)
        if command == "package":
            return package.run(root, rest)
        if command == "runtime":
            return runtime.run(root, rest)
        if command == "deploy":
            return deploy.run(root, rest)
        fail(f"Unknown command: {command}")
        eprint("Run `python ross.py help` for usage.")
        return 2
    except FileNotFoundError as err:
        fail(str(err))
        return 1
    except KeyboardInterrupt:
        eprint("\nInterrupted.")
        return 130
    except Exception as err:  # noqa: BLE001 — top-level CLI boundary
        fail(f"{type(err).__name__}: {err}")
        return 1
