# Logging, Tracking, Tracing, and Reporting

Every HTTP response includes:

- `X-Request-ID`
- `X-Trace-ID`
- `Server-Timing`

Logs are emitted as JSON to stdout and `logs/runtime.jsonl`. The runtime exposes:

- `/health/live`
- `/health/ready`
- `/health/startup`
- `/metrics`
- `/api/v1/runtime/status`
- `/api/v1/runtime/metrics`
- `/api/v1/runtime/jobs`
- `/api/v1/runtime/incidents`
- `/api/v1/runtime/reports`

Operational reports are generated as JSON in `reports/` and indexed in SQLite.
