# Self-Healing Runtime

The runtime is part of the application build, not an external placeholder.

## Components

- Durable SQLite job queue with WAL mode and transactional job claiming.
- Three worker lanes: `default`, `reports`, and `maintenance`.
- Worker heartbeat registry.
- Supervisor task that restarts crashed workers with bounded exponential backoff.
- Incident recording for crashes and operator restarts.
- Periodic scheduler for health snapshots, operational reports, cleanup, and release checks.
- Readiness, liveness, startup, worker, metric, and Prometheus endpoints.
- JSON structured logs with request IDs and trace IDs.
- Docker restart policies and process health checks.
- Windows PowerShell watchdog for whole-server restart after process failure.

## Self-healing boundary

The supervisor safely restarts application workers. It does not silently replace application code. Dependency and release upgrades are performed through reviewed GitHub workflows or the controlled update script, followed by diagnostics and rollback-ready deployment.
