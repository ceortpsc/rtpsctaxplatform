"""Monorepo inventory — services, workers, pipelines, engines, packages, tools."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


STATIC_INVENTORY: list[dict[str, Any]] = [
    {
        "id": "pkg-platform-core",
        "sector": "packages",
        "name": "@rtp/platform-core",
        "path": "packages/platform-core",
        "purpose": "Shared runtime config, descriptors, HTTP stubs, worker runner.",
        "status": "foundation",
    },
    {
        "id": "pkg-client-config",
        "sector": "packages",
        "name": "@rtp/client-config",
        "path": "packages/client-config",
        "purpose": "API/TDS/tunnel credential placeholders and governance notes.",
        "status": "foundation",
    },
    {
        "id": "pkg-secure-tunnel",
        "sector": "packages",
        "name": "@rtp/secure-tunnel",
        "path": "packages/secure-tunnel",
        "purpose": "Approved secure-tunnel adapter contract with compliance gates.",
        "status": "foundation",
    },
    {
        "id": "svc-api-gateway",
        "sector": "services",
        "name": "@rtp/api-gateway",
        "path": "services/api-gateway",
        "port": 3000,
        "purpose": "Ingress control plane for transmission and metadata.",
        "status": "online-stub",
    },
    {
        "id": "svc-refund-status",
        "sector": "services",
        "name": "@rtp/refund-status-service",
        "path": "services/refund-status-service",
        "port": 3001,
        "purpose": "Event-driven refund status surface.",
        "status": "online-stub",
    },
    {
        "id": "svc-transcript",
        "sector": "services",
        "name": "@rtp/transcript-service",
        "path": "services/transcript-service",
        "path_note": "services/transcript-service",
        "port": 3002,
        "purpose": "Transcript intake and TDS orchestration surface.",
        "status": "online-stub",
    },
    {
        "id": "svc-analytics",
        "sector": "services",
        "name": "@rtp/analytics-service",
        "path": "services/analytics-service",
        "port": 3003,
        "purpose": "Analytics and refund intelligence API surface.",
        "status": "online-stub",
    },
    {
        "id": "wrk-tds",
        "sector": "workers",
        "name": "@rtp/tds-worker",
        "path": "workers/tds-worker",
        "purpose": "TDS orchestration worker (one-shot / heartbeat).",
        "status": "worker",
    },
    {
        "id": "wrk-transcript-pull",
        "sector": "workers",
        "name": "@rtp/transcript-pull-worker",
        "path": "workers/transcript-pull-worker",
        "purpose": "Account transcript pull worker scaffold.",
        "status": "worker",
    },
    {
        "id": "wrk-live-source",
        "sector": "workers",
        "name": "@rtp/live-source-fetcher",
        "path": "workers/live-source-fetcher",
        "purpose": "Approved-source fetch coordinator (no scraping).",
        "status": "worker",
    },
    {
        "id": "pipe-transmission",
        "sector": "pipelines",
        "name": "@rtp/transmission-pipeline",
        "path": "pipelines/transmission-pipeline",
        "purpose": "prepare → validate → queue → tunnel → acknowledge.",
        "status": "pipeline",
    },
    {
        "id": "pipe-masterfile",
        "sector": "pipelines",
        "name": "@rtp/masterfile-pipeline",
        "path": "pipelines/masterfile-pipeline",
        "purpose": "Masterfile ingest, normalize, enrich, publish.",
        "status": "pipeline",
    },
    {
        "id": "pipe-refund-status",
        "sector": "pipelines",
        "name": "@rtp/refund-status-pipeline",
        "path": "pipelines/refund-status-pipeline",
        "purpose": "Refund event ingest, dedupe, timeline, escalation.",
        "status": "pipeline",
    },
    {
        "id": "eng-analytics-center",
        "sector": "engines",
        "name": "@rtp/analytics-center",
        "path": "engines/analytics-center",
        "purpose": "Metric aggregation and dashboard feeds.",
        "status": "engine",
    },
    {
        "id": "eng-refund-intel",
        "sector": "engines",
        "name": "@rtp/refund-intelligence-engine",
        "path": "engines/refund-intelligence-engine",
        "purpose": "Refund signal correlation and risk flags.",
        "status": "engine",
    },
    {
        "id": "eng-tc-code",
        "sector": "engines",
        "name": "@rtp/tc-code-engine",
        "path": "engines/tc-code-engine",
        "purpose": "TC code catalog and masterfile enrichment.",
        "status": "engine",
    },
    {
        "id": "tool-aol",
        "sector": "tools",
        "name": "@rtp/aol",
        "path": "tools/aol",
        "purpose": "Adaptive Optimized Linker — workspace velocity.",
        "status": "tool",
    },
    {
        "id": "tool-ross",
        "sector": "tools",
        "name": "ross-ai-runtime-platform",
        "path": "ross_ai",
        "purpose": "Ross command packages, runtime, deploy plans, operator console.",
        "status": "control-plane",
    },
]


def build_inventory(root: Path) -> dict[str, Any]:
    items = []
    for entry in STATIC_INVENTORY:
        item = dict(entry)
        rel = item.get("path", "")
        exists = (root / rel).exists() if rel else False
        pkg = root / rel / "package.json"
        version = None
        if pkg.is_file():
            try:
                version = json.loads(pkg.read_text(encoding="utf-8")).get("version")
            except json.JSONDecodeError:
                version = None
        item["exists"] = exists
        item["version"] = version
        items.append(item)

    sectors: dict[str, list] = {}
    for item in items:
        sectors.setdefault(item["sector"], []).append(item)

    return {
        "total": len(items),
        "present": sum(1 for i in items if i["exists"]),
        "sectors": {k: len(v) for k, v in sectors.items()},
        "items": items,
        "bySector": sectors,
    }
