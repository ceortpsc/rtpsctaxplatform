"""Deployment plan generators for multiple targets."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from ross_ai.manifest import load_manifest
from ross_ai.paths import plans_path
from ross_ai.util import ensure_dir, eprint, fail

TARGETS = (
    "local",
    "docker",
    "kubernetes",
    "aws-lambda",
    "aws-ecs",
    "azure-functions",
    "gcp-cloud-run",
    "edge-worker",
)


def _base(man: dict[str, Any], target: str) -> dict[str, Any]:
    platform = (man.get("runtime") or {}).get("platform") or {}
    return {
        "format": "ross-deploy-plan/1",
        "target": target,
        "name": man.get("name", "application"),
        "version": man.get("version", "0.1.0"),
        "product": man.get("product"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "artifact": (man.get("package") or {}).get("artifact", "application.rpkg"),
        "platform": {
            "host": platform.get("host", "127.0.0.1"),
            "port": platform.get("port", 8787),
        },
    }


def plan_for(man: dict[str, Any], target: str) -> dict[str, Any]:
    plan = _base(man, target)
    if target == "local":
        plan["steps"] = [
            "python -m venv .venv",
            "source .venv/bin/activate  # Windows: .venv\\Scripts\\activate",
            "pip install -r requirements.txt",
            "python ross.py init",
            "python ross.py doctor",
            "python ross.py dev",
        ]
        plan["endpoint"] = f"http://{plan['platform']['host']}:{plan['platform']['port']}"
    elif target == "docker":
        plan["steps"] = [
            "cp .env.example .env",
            "docker compose -f docker-compose.ross.yml up --build",
        ]
        plan["endpoint"] = "http://127.0.0.1:8787"
        plan["composeFile"] = "docker-compose.ross.yml"
    elif target == "kubernetes":
        plan["steps"] = [
            "python ross.py package build",
            "kubectl apply -f workspace/plans/kubernetes-manifests/ (generate next)",
            "kubectl rollout status deploy/ross-ai-runtime",
        ]
        plan["resources"] = {
            "kind": "Deployment",
            "replicas": 2,
            "containerPort": 8787,
            "image": "ross-ai-runtime-platform:0.1.0",
            "service": {"type": "ClusterIP", "port": 80, "targetPort": 8787},
        }
    elif target == "aws-lambda":
        plan["steps"] = [
            "python ross.py package build",
            "Upload application.rpkg contents as Lambda deployment package",
            "Handler: ross_ai.platform_lambda.handler",
            "Configure Function URL or API Gateway → portless HTTP",
        ]
        plan["resources"] = {
            "runtime": "python3.12",
            "memoryMb": 512,
            "timeoutSec": 30,
            "architecture": "arm64",
        }
    elif target == "aws-ecs":
        plan["steps"] = [
            "Build image from Dockerfile.ross",
            "Push to ECR",
            "Register ECS task definition (port 8787)",
            "Create/update ECS service behind ALB",
        ]
        plan["resources"] = {
            "cpu": "256",
            "memory": "512",
            "containerPort": 8787,
            "desiredCount": 2,
        }
    elif target == "azure-functions":
        plan["steps"] = [
            "python ross.py package build",
            "Map HTTP trigger to ross_ai.platform_lambda.handler",
            "func azure functionapp publish <app-name>",
        ]
        plan["resources"] = {"plan": "consumption", "runtime": "python", "version": "3.12"}
    elif target == "gcp-cloud-run":
        plan["steps"] = [
            "Build image from Dockerfile.ross",
            "gcloud run deploy ross-ai-runtime --port 8787 --allow-unauthenticated",
        ]
        plan["resources"] = {"port": 8787, "cpu": "1", "memory": "512Mi", "concurrency": 80}
    elif target == "edge-worker":
        plan["steps"] = [
            "Extract lightweight /health and /metadata handlers",
            "Bundle as edge worker (Cloudflare/Fastly style)",
            "Keep heavy package build offline; edge serves control plane only",
        ]
        plan["resources"] = {"routes": ["/health", "/metadata", "/"], "compat": "http-json"}
    else:
        raise ValueError(f"Unknown target: {target}")
    return plan


def run(root: Path, argv: Sequence[str]) -> int:
    if len(argv) < 2 or argv[0] != "plan":
        fail("Usage: python ross.py deploy plan <target>")
        fail(f"Targets: {', '.join(TARGETS)}")
        return 2

    target = argv[1]
    if target not in TARGETS:
        fail(f"Unknown target '{target}'. Choose: {', '.join(TARGETS)}")
        return 2

    man = load_manifest(root)
    plan = plan_for(man, target)
    out_dir = ensure_dir(plans_path(root))
    out = out_dir / f"{target}.json"
    out.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    eprint(f"✓ Wrote {out.relative_to(root)}")
    print(json.dumps(plan, indent=2))
    return 0
