from __future__ import annotations

import logging
import secrets
import threading
import time
from collections import defaultdict
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("ross.runtime.http")


class MetricsRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.requests_total = 0
        self.errors_total = 0
        self.latency_sum_seconds = 0.0
        self.routes: dict[tuple[str, str, int], int] = defaultdict(int)

    def observe(self, method: str, path: str, status: int, elapsed: float) -> None:
        route = path if len(path) <= 120 else path[:117] + "..."
        with self._lock:
            self.requests_total += 1
            self.latency_sum_seconds += elapsed
            if status >= 500:
                self.errors_total += 1
            self.routes[(method, route, status)] += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            average = self.latency_sum_seconds / self.requests_total if self.requests_total else 0.0
            return {
                "requests_total": self.requests_total,
                "errors_total": self.errors_total,
                "latency_sum_seconds": round(self.latency_sum_seconds, 6),
                "latency_average_seconds": round(average, 6),
                "routes": [
                    {"method": m, "path": p, "status": s, "count": c}
                    for (m, p, s), c in self.routes.items()
                ],
            }

    def prometheus(self) -> str:
        snap = self.snapshot()
        lines = [
            "# HELP ross_runtime_http_requests_total Total HTTP requests.",
            "# TYPE ross_runtime_http_requests_total counter",
            f"ross_runtime_http_requests_total {snap['requests_total']}",
            "# HELP ross_runtime_http_errors_total Total HTTP 5xx responses.",
            "# TYPE ross_runtime_http_errors_total counter",
            f"ross_runtime_http_errors_total {snap['errors_total']}",
            "# HELP ross_runtime_http_request_duration_seconds_sum Sum of request durations.",
            "# TYPE ross_runtime_http_request_duration_seconds_sum counter",
            f"ross_runtime_http_request_duration_seconds_sum {snap['latency_sum_seconds']}",
        ]
        for route in snap["routes"]:
            path = route["path"].replace('"', '\"')
            lines.append(
                f'ross_runtime_http_route_requests_total{{method="{route["method"]}",path="{path}",status="{route["status"]}"}} {route["count"]}'
            )
        return "\n".join(lines) + "\n"


metrics = MetricsRegistry()


def _trace_id(request: Request) -> str:
    traceparent = request.headers.get("traceparent", "")
    parts = traceparent.split("-")
    if len(parts) >= 4 and len(parts[1]) == 32:
        return parts[1]
    incoming = request.headers.get("x-trace-id")
    if incoming and 8 <= len(incoming) <= 64:
        return incoming
    return secrets.token_hex(16)


class RuntimeTelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        request_id = request.headers.get("x-request-id") or secrets.token_hex(10)
        trace_id = _trace_id(request)
        request.state.request_id = request_id
        request.state.trace_id = trace_id
        status = 500
        try:
            response: Response = await call_next(request)
            status = response.status_code
            return response
        finally:
            elapsed = time.perf_counter() - started
            metrics.observe(request.method, request.url.path, status, elapsed)
            logger.info(
                "request.completed",
                extra={
                    "request_id": request_id,
                    "trace_id": trace_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": status,
                    "duration_ms": round(elapsed * 1000, 3),
                    "client": request.client.host if request.client else None,
                },
            )
            response_obj = locals().get("response")
            if response_obj is not None:
                response_obj.headers["X-Request-ID"] = request_id
                response_obj.headers["X-Trace-ID"] = trace_id
                response_obj.headers["Server-Timing"] = f"app;dur={elapsed * 1000:.2f}"
