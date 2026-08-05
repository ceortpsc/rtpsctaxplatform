from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
required = [
    ROOT / "app-main.patch",
    ROOT / "app-css.patch",
    ROOT / "shell.patch",
    *[ROOT / f"runtime-store.patch.part.{index:02d}" for index in range(5)],
]
missing = [str(path) for path in required if not path.exists()]
if missing:
    raise SystemExit("Missing runtime integration files:\n" + "\n".join(missing))

runtime_store_patch = "".join(
    (ROOT / f"runtime-store.patch.part.{index:02d}").read_text(encoding="utf-8")
    for index in range(5)
)
if "CREATE TABLE IF NOT EXISTS jobs" not in runtime_store_patch:
    raise SystemExit("Runtime store patch is incomplete: jobs table not found.")
if "def cleanup_runtime" not in runtime_store_patch:
    raise SystemExit("Runtime store patch is incomplete: cleanup handler not found.")
if "RuntimeSupervisor" not in (ROOT / "app-main.patch").read_text(encoding="utf-8"):
    raise SystemExit("Application patch is incomplete: RuntimeSupervisor not found.")
print("Ross Runtime integration patch bundle validated.")
