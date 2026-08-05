from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

import psutil

from app.runtime_store import RuntimeStore

logger = logging.getLogger("ross.runtime.worker")
JobHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class WorkerSpec:
    name: str
    queues: tuple[str, ...]


class WorkerRunner:
    def __init__(self, store: RuntimeStore, report_dir: Path, poll_seconds: float = 0.75) -> None:
        self.store = store
        self.report_dir = report_dir
        self.poll_seconds = poll_seconds
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.handlers: dict[str, JobHandler] = {
            "audit.write": self.audit_write,
            "health.snapshot": self.health_snapshot,
            "report.operational": self.operational_report,
            "maintenance.cleanup": self.maintenance_cleanup,
            "release.check": self.release_check,
            "notification.dispatch": self.notification_dispatch,
        }

    async def run_forever(self, spec: WorkerSpec, stop_event: asyncio.Event) -> None:
        worker_id = f"{socket.gethostname()}:{os.getpid()}:{spec.name}"
        logger.info("worker.started", extra={"worker": spec.name, "queues": spec.queues, "worker_id": worker_id})
        while not stop_event.is_set():
            self.store.upsert_worker_heartbeat(spec.name, "idle", None, {"worker_id": worker_id, "queues": spec.queues})
            job = self.store.claim_job(spec.name, spec.queues)
            if job is None:
                try:
                    await asyncio.wait_for(stop_event.wait(), timeout=self.poll_seconds)
                except asyncio.TimeoutError:
                    pass
                continue

            job_id = job["id"]
            self.store.upsert_worker_heartbeat(spec.name, "running", job_id, {"worker_id": worker_id, "queues": spec.queues})
            try:
                handler = self.handlers.get(job["type"])
                if handler is None:
                    raise ValueError(f"No handler registered for {job['type']}")
                result = await handler(job)
                self.store.complete_job(job_id, result)
                logger.info("job.completed", extra={"worker": spec.name, "job_id": job_id, "job_type": job["type"]})
            except asyncio.CancelledError:
                self.store.fail_job(job_id, "worker cancelled", retry_delay_seconds=2)
                raise
            except Exception as exc:
                delay = min(60, 2 ** max(1, int(job.get("attempts", 1))))
                state = self.store.fail_job(job_id, repr(exc), retry_delay_seconds=delay)
                logger.exception(
                    "job.failed",
                    extra={"worker": spec.name, "job_id": job_id, "job_type": job["type"], "job_state": state},
                )
        self.store.upsert_worker_heartbeat(spec.name, "stopped", None, {"worker_id": worker_id, "queues": spec.queues})
        logger.info("worker.stopped", extra={"worker": spec.name})

    async def audit_write(self, job: dict[str, Any]) -> dict[str, Any]:
        payload = job["payload"]
        self.store.write_event(payload.get("event_type", "runtime.audit"), json.dumps(payload.get("detail", {}), default=str))
        return {"written": True}

    async def health_snapshot(self, job: dict[str, Any]) -> dict[str, Any]:
        snapshot = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage(str(self.report_dir.resolve().anchor or "/")).percent,
            "process_count": len(psutil.pids()),
            "database_ok": self.store.database_health()["ok"],
        }
        self.store.set_metric("system.health", snapshot)
        return snapshot

    async def operational_report(self, job: dict[str, Any]) -> dict[str, Any]:
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "job_counts": self.store.job_counts(),
            "workers": self.store.list_workers(),
            "incidents": self.store.list_incidents(limit=50),
            "metrics": self.store.metrics_snapshot(),
            "database": self.store.database_health(),
        }
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        path = self.report_dir / f"operational-{stamp}.json"
        path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        report_id = self.store.create_report("operational", str(path), report)
        return {"report_id": report_id, "path": str(path)}

    async def maintenance_cleanup(self, job: dict[str, Any]) -> dict[str, Any]:
        return self.store.cleanup_runtime(retention_days=int(job["payload"].get("retention_days", 30)))

    async def release_check(self, job: dict[str, Any]) -> dict[str, Any]:
        manifest_path = Path(job["payload"].get("manifest_path", "RELEASE_MANIFEST.json"))
        if not manifest_path.is_absolute():
            manifest_path = Path.cwd() / manifest_path
        if not manifest_path.exists():
            return {"checked": False, "reason": "manifest not found", "path": str(manifest_path)}
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        result = {"checked": True, "version": data.get("version") or data.get("release") or "unknown", "path": str(manifest_path)}
        self.store.set_metric("release.last_check", result)
        return result

    async def notification_dispatch(self, job: dict[str, Any]) -> dict[str, Any]:
        payload = job["payload"]
        self.store.write_event("notification.dispatched", json.dumps(payload, default=str))
        return {"accepted": True, "channel": payload.get("channel", "runtime-log")}
