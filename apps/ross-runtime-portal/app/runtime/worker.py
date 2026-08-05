from __future__ import annotations

import argparse
import asyncio
import signal
from pathlib import Path

from app.runtime.config import RuntimeConfig
from app.runtime.logging_config import configure_logging
from app.runtime.supervisor import DEFAULT_SPECS
from app.runtime.workers import WorkerRunner
from app.runtime_store import RuntimeStore


async def main_async(worker_names: list[str], scheduler: bool) -> None:
    base_dir = Path(__file__).resolve().parents[2]
    config = RuntimeConfig.from_env(base_dir)
    configure_logging(config.log_dir, config.log_level)
    store = RuntimeStore(base_dir / "data" / "ross_runtime.db")
    runner = WorkerRunner(store, config.report_dir, config.worker_poll_seconds)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signame in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signame, stop.set)
        except NotImplementedError:
            pass

    selected = [spec for spec in DEFAULT_SPECS if spec.name in worker_names or "all" in worker_names]
    if not selected:
        raise SystemExit(f"No workers selected. Valid names: {[s.name for s in DEFAULT_SPECS]}")

    async def scheduler_loop() -> None:
        while not stop.is_set():
            store.enqueue_job("health.snapshot", "default", {}, dedupe_key="external:health.snapshot")
            store.enqueue_job("report.operational", "reports", {}, dedupe_key="external:report.operational")
            try:
                await asyncio.wait_for(stop.wait(), timeout=30)
            except asyncio.TimeoutError:
                pass

    tasks = [asyncio.create_task(runner.run_forever(spec, stop), name=spec.name) for spec in selected]
    if scheduler:
        tasks.append(asyncio.create_task(scheduler_loop(), name="external-scheduler"))
    await stop.wait()
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ross Runtime Portal background worker service")
    parser.add_argument("--workers", default="all", help="Comma-separated worker names or all")
    parser.add_argument("--scheduler", action="store_true")
    args = parser.parse_args()
    asyncio.run(main_async([item.strip() for item in args.workers.split(",") if item.strip()], args.scheduler))


if __name__ == "__main__":
    main()
