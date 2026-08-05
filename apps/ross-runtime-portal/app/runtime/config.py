from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RuntimeConfig:
    base_dir: Path
    log_dir: Path
    report_dir: Path
    in_process_workers: bool
    worker_poll_seconds: float
    heartbeat_seconds: float
    stale_worker_seconds: float
    scheduler_enabled: bool
    scheduler_tick_seconds: float
    log_level: str

    @classmethod
    def from_env(cls, base_dir: Path) -> "RuntimeConfig":
        return cls(
            base_dir=base_dir,
            log_dir=Path(os.getenv("ROSS_RUNTIME_LOG_DIR", str(base_dir / "logs"))),
            report_dir=Path(os.getenv("ROSS_RUNTIME_REPORT_DIR", str(base_dir / "reports"))),
            in_process_workers=os.getenv("ROSS_RUNTIME_IN_PROCESS_WORKERS", "true").lower() == "true",
            worker_poll_seconds=float(os.getenv("ROSS_RUNTIME_WORKER_POLL_SECONDS", "0.75")),
            heartbeat_seconds=float(os.getenv("ROSS_RUNTIME_HEARTBEAT_SECONDS", "5")),
            stale_worker_seconds=float(os.getenv("ROSS_RUNTIME_STALE_WORKER_SECONDS", "25")),
            scheduler_enabled=os.getenv("ROSS_RUNTIME_SCHEDULER_ENABLED", "true").lower() == "true",
            scheduler_tick_seconds=float(os.getenv("ROSS_RUNTIME_SCHEDULER_TICK_SECONDS", "5")),
            log_level=os.getenv("ROSS_RUNTIME_LOG_LEVEL", "INFO").upper(),
        )
