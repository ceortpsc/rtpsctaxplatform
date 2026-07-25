"""Filesystem layout helpers for the Ross Tax Pro Software Co | RunTime AI Assist."""

from __future__ import annotations

from pathlib import Path

MANIFEST_NAME = "ross.json"
WORKSPACE_DIR = "workspace"
DIST_DIR = "workspace/dist"
SCRIPTS_DIR = "workspace/scripts"
PLANS_DIR = "workspace/plans"
ENV_EXAMPLE = ".env.example"
ENV_FILE = ".env"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787


def find_root(start: Path | None = None) -> Path:
    """Walk upward for ross.json or fall back to CWD / package parent."""
    cur = (start or Path.cwd()).resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / MANIFEST_NAME).is_file() or (candidate / "ross.py").is_file():
            return candidate
    return cur


def workspace_path(root: Path) -> Path:
    return root / WORKSPACE_DIR


def dist_path(root: Path) -> Path:
    return root / DIST_DIR


def scripts_path(root: Path) -> Path:
    return root / SCRIPTS_DIR


def plans_path(root: Path) -> Path:
    return root / PLANS_DIR


def manifest_path(root: Path) -> Path:
    return root / MANIFEST_NAME
