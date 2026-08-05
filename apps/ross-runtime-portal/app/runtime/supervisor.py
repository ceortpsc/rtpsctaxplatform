from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Any

from app.runtime.config import RuntimeConfig
from app.runtime.workers import WorkerRunner, WorkerSpec
from app.runtime_store import RuntimeStore

logger = logging.getLogger("ross.runtime.supervisor")


DEFAULT_SPECS = (
    WorkerSpec("default-1", ("default",)),
    WorkerSpec("reports-1", ("reports",)),
    WorkerSpec("maintenance-1", ("maintenance",)),
)


class RuntimeSupervisor:
    def __init__(self, store: RuntimeStore, config: RuntimeConfig) -> None:
        self.store = store
        self.config = config
        self.stop_event = asyncio.Event()
        self.runner = WorkerRunner(store, config.report_dir, config.worker_poll_seconds)
        self.tasks: dict[str, asyncio.Task[Any]] = {}
        self.monitor_task: asyncio.Task[Any] | None = None
        self.scheduler_task: asyncio.Task[Any] | None = None
        self.started_at: float | None = None
        self.restarts: dict[str, int] = {spec.name: 0 for spec in DEFAULT_SPECS}

    async def start(self) -> None:
        if self.started_at is not None:
            return
        self.started_at = time.time()
        self.stop_event.clear()
        if self.config.in_process_workers:
            for spec in DEFAULT_SPECS:
                self.store.upsert_worker_heartbeat(
                    spec.name,
                    "starting",
                    None,
                    {"queues": spec.queues, "source": "supervisor"},
                )
                self._spawn(spec)
            self.monitor_task = asyncio.create_task(self._monitor(), name="runtime-monitor")
            if self.config.scheduler_enabled:
                self.scheduler_task = asyncio.create_task(self._scheduler(), name="runtime-scheduler")
        self.store.write_event("runtime.started", f"pid={os.getpid()} in_process_workers={self.config.in_process_workers}")
        logger.info("runtime.started", extra={"in_process_workers": self.config.in_process_workers})

    async def stop(self) -> None:
        self.stop_event.set()
        all_tasks = list(self.tasks.values())
        if self.monitor_task:
            all_tasks.append(self.monitor_task)
        if self.scheduler_task:
            all_tasks.append(self.scheduler_task)
        for task in all_tasks:
            task.cancel()
        if all_tasks:
            await asyncio.gather(*all_tasks, return_exceptions=True)
        self.tasks.clear()
        self.started_at = None
        self.store.write_event("runtime.stopped", f"pid={os.getpid()}")
        logger.info("runtime.stopped")

    def _spawn(self, spec: WorkerSpec) -> None:
        task = asyncio.create_task(self.runner.run_forever(spec, self.stop_event), name=f"worker:{spec.name}")
        self.tasks[spec.name] = task

    async def restart_worker(self, worker_name: str, reason: str = "operator request") -> bool:
        spec = next((item for item in DEFAULT_SPECS if item.name == worker_name), None)
        if spec is None:
            return False
        task = self.tasks.get(worker_name)
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        self.restarts[worker_name] = self.restarts.get(worker_name, 0) + 1
        self.store.record_worker_restart(worker_name)
        self.store.create_incident("warning", "worker.restart", f"Worker {worker_name} restarted", {"reason": reason})
        self._spawn(spec)
        return True

    async def _monitor(self) -> None:
        while not self.stop_event.is_set():
            await asyncio.sleep(max(2.0, self.config.heartbeat_seconds))
            for spec in DEFAULT_SPECS:
                task = self.tasks.get(spec.name)
                if task is None or task.done():
                    error = None
                    if task and not task.cancelled():
                        try:
                            error = repr(task.exception())
                        except Exception:
                            error = "unknown worker failure"
                    self.restarts[spec.name] = self.restarts.get(spec.name, 0) + 1
                    self.store.record_worker_restart(spec.name)
                    self.store.create_incident(
                        "critical",
                        "worker.crash",
                        f"Worker {spec.name} stopped unexpectedly",
                        {"error": error, "restart_count": self.restarts[spec.name]},
                    )
                    await asyncio.sleep(min(30, 2 ** min(self.restarts[spec.name], 5)))
                    self._spawn(spec)
                    logger.error("worker.self_healed", extra={"worker": spec.name, "error": error})

    async def _scheduler(self) -> None:
        last: dict[str, float] = {}
        schedules = {
            "health.snapshot": ("default", 30.0, {}),
            "report.operational": ("reports", 300.0, {}),
            "maintenance.cleanup": ("maintenance", 3600.0, {"retention_days": 30}),
            "release.check": ("maintenance", 600.0, {"manifest_path": "RELEASE_MANIFEST.json"}),
        }
        while not self.stop_event.is_set():
            now = time.time()
            for job_type, (queue, every, payload) in schedules.items():
                if now - last.get(job_type, 0) >= every:
                    self.store.enqueue_job(
                        job_type,
                        queue,
                        payload,
                        max_attempts=3,
                        dedupe_key=f"scheduled:{job_type}",
                    )
                    last[job_type] = now
            try:
                await asyncio.wait_for(self.stop_event.wait(), timeout=self.config.scheduler_tick_seconds)
            except asyncio.TimeoutError:
                pass

    def status(self) -> dict[str, Any]:
        task_status = {
            name: {
                "running": not task.done(),
                "cancelled": task.cancelled(),
                "restart_count": self.restarts.get(name, 0),
            }
            for name, task in self.tasks.items()
        }
        return {
            "mode": "in-process" if self.config.in_process_workers else "external-workers",
            "started": self.started_at is not None,
            "uptime_seconds": round(time.time() - self.started_at, 3) if self.started_at else 0,
            "tasks": task_status,
            "database_workers": self.store.list_workers(),
            "job_counts": self.store.job_counts(),
            "incidents_open": self.store.count_open_incidents(),
        }
