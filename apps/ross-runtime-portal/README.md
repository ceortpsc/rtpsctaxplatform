# Ross Runtime Portal 3.1.0

**Application:** Ross Runtime Portal  
**Sub-name:** Portal, Vision & Workflow Command Center  
**Publisher:** Ross Tax Pro Software Co.

Ross Runtime Portal is a complete multipage application with its operational runtime built directly into the codebase. It combines portal channels, dashboards, scan-quality science, workflow automation, durable background jobs, connector governance, internal search, announcements, messages, API contracts, SEO delivery, tracing, structured logging, operational reporting, and explainable operator guidance.

## Runtime included in the build

- Durable SQLite job queue using WAL mode and transactional job claiming
- Default, reporting, and maintenance worker lanes
- Worker heartbeat registry
- Self-healing worker supervisor with bounded restart backoff
- Periodic scheduler for health snapshots, reports, cleanup, and release checks
- Incident and dead-letter recording
- JSON logs to stdout and `logs/runtime.jsonl`
- Request IDs, trace IDs, and server timing headers
- Prometheus-format metrics
- Liveness, readiness, and startup probes
- Runtime Operations dashboard
- Docker web and worker services
- Windows whole-process watchdog
- GitHub Actions tests, dependency audit, container build, and release packaging
- Dependabot upgrade pull requests

## Fastest Windows rollout

```powershell
Set-Location "$HOME\Downloads"
Expand-Archive -LiteralPath ".\ross_runtime_portal_full_build.zip" -DestinationPath ".\RossRuntimePortal" -Force
Set-Location ".\RossRuntimePortal\ross_runtime_portal_full_build"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup_windows.ps1
.\scripts\start_windows.ps1
```

Open `http://127.0.0.1:8000`. The local fallback access code is `ross-demo`.

### Supervised Windows execution

```powershell
.\scripts\run_supervised.ps1
```

That script restarts the entire server process after an unexpected exit. Application workers are independently supervised inside the runtime.

## Python IDLE rollout

Complete dependency setup once, then run:

```powershell
.\scripts\open_in_idle.ps1
```

Press **F5** in IDLE on `launch_idle.py`.

## Docker rollout

```powershell
docker compose up --build -d
```

The Compose build runs two services:

- `web`: FastAPI server
- `workers`: durable background worker and scheduler process

Both services use health checks and `restart: always`.

## Runtime routes

```text
/runtime-operations
/health
/health/live
/health/ready
/health/startup
/metrics
/api/v1/runtime/status
/api/v1/runtime/metrics
/api/v1/runtime/jobs
/api/v1/runtime/incidents
/api/v1/runtime/reports
```

## Validation

```powershell
.\.venv\Scripts\python.exe diagnose.py
.\.venv\Scripts\python.exe -m pytest -q
```

## Documentation

- `docs/SELF_HEALING_RUNTIME.md`
- `docs/OBSERVABILITY.md`
- `docs/PYTHON_IDLE_GUIDE.md`
- `docs/POWERSHELL_DEPLOYMENT.md`
- `docs/PRODUCTION_ROLLOUT.md`
- `docs/MODULE_REFERENCE.md`
- `docs/API_CONTRACTS.md`
- `docs/MATHEMATICS_AND_SCIENCE.md`
- `docs/SEO_RUNTIME.md`
- `docs/SECURITY_AND_PRIVACY.md`
- `docs/TROUBLESHOOTING.md`
- `docs/BRAND_AND_IP.md`
- `docs/ARCHITECTURE.md`

## Safety boundary

The scanner module measures capture quality, compares authorized parsed values, performs redaction, and supports human review. It does not regenerate, alter, imitate, or certify government identification documents or security features.

## Production requirements

Replace the local access code with OIDC or SAML SSO and MFA. Use managed PostgreSQL and a managed queue when horizontally scaling beyond a single shared runtime volume. Keep connector credentials in a secrets manager. Place the application behind HTTPS, WAF, rate limiting, malware scanning, and formal retention controls.
