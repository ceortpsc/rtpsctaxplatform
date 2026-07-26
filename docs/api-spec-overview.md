# API Specification Overview

## API Gateway

### `GET /health`
Returns service health, environment, and compliance posture.

### `GET /metadata`
Returns gateway descriptor, downstream routes, and transmission guardrails.

## Refund Status Service

### `GET /health`
Health endpoint for runtime verification.

### `GET /metadata`
Returns event channels, no-scraping policy, and TODO checkpoints for approved data ingestion.

## Transcript Service

### `GET /health`
Health endpoint for transcript orchestration.

### `GET /metadata`
Returns transcript pull, TDS, and masterfile responsibilities.

## Analytics Service

### `GET /health`
Health endpoint for analytics runtime.

### `GET /metadata`
Returns refund intelligence, analytics center, and TC code engine bindings.

## AOL Package Manager API

Programmatic Adaptive Optimized Linker surface (`@rtp/aol`). See
[`aol-api-and-config.md`](./aol-api-and-config.md).

```js
import { createAol } from '@rtp/aol';
const aol = await createAol();
await aol.install();
```

CLI mirrors: `aol api`, `aol codes`, `aol config`, `aol copyright`.

## AI Workforce Hub (`:8860`)

- UI: `GET /`
- `GET /v1/personas` · `GET /v1/catalog` · `GET /v1/governance`
- `POST /v1/hire` · `POST /v1/tasks/pay` · `POST /v1/tasks/run`
- `POST /v1/tasks/human-approve` · `POST /v1/tasks/hold`
- `POST /v1/live-service` — hire → pay → realtime persona step
- `GET /v1/events` — governance event stream

See [`ai-persona-workforce.md`](./ai-persona-workforce.md).

## Future contracts

- Version external and internal event schemas.
- Use idempotency keys for transmission and transcript pull requests.
- Add authenticated operator-facing endpoints only after access-control design approval.
