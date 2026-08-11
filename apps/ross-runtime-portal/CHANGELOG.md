# Changelog

## 3.1.0 — Full Runtime Build

- Embedded the background runtime into the application build.
- Added a durable SQLite job queue with WAL mode and transactional job claiming.
- Added default, reporting, and maintenance workers.
- Added worker heartbeat tracking and self-healing restart supervision.
- Added incident, dead-letter, metrics, reports, and runtime state tables.
- Added periodic health, report, cleanup, and release-check scheduling.
- Added structured JSON logging, request IDs, trace IDs, and server timing.
- Added liveness, readiness, startup, worker, report, incident, and metrics APIs.
- Added a Runtime Operations dashboard with wired actions.
- Added branded unhandled-error recovery pages and incident IDs.
- Added a Windows process watchdog and controlled dependency-update script.
- Added Docker web and worker services with health checks and restart policies.
- Added systemd service templates.
- Added GitHub Actions CI, dependency auditing, container validation, release artifacts, and Dependabot.
- Added automated route, runtime, queue, and report tests.

## 3.0.0 — Ross Runtime Portal

- Rebranded runtime and publisher metadata for Ross Tax Pro Software Co.
- Added original classic-portal-inspired channels interface.
- Added persistent SQLite messages, announcements, search, and runtime events.
- Added favicon ICO, SVG mark, PNG touch icon, and social card.
- Added current request-first Starlette/Jinja rendering compatibility.
- Added Python IDLE and PowerShell launchers.
