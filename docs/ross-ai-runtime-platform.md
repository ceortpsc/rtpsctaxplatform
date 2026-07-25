# Ross AI Runtime Platform

Command package toolkit for **Ross Tax Software** — init, doctor, local runtime,
`.rpkg` packaging, and multi-target deploy plans. Extracted from the Ross command
package development workflow and implemented with **Python 3 stdlib only** (no
required pip dependencies).

## Quickstart (no Docker)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt   # optional — stdlib is enough
python ross.py init
python ross.py doctor
python ross.py dev
```

Open: http://127.0.0.1:8787

## Example commands

```bash
python ross.py init
python ross.py doctor
python ross.py dev
```

## Build a Ross package

```bash
python ross.py package build
```

Creates:

```text
workspace/dist/application.rpkg
workspace/dist/application.rpkg.sha256
```

## Run a project script

```bash
python ross.py runtime run hello
```

## Generate deployment plans

```bash
python ross.py deploy plan local
python ross.py deploy plan docker
python ross.py deploy plan kubernetes
python ross.py deploy plan aws-lambda
python ross.py deploy plan aws-ecs
python ross.py deploy plan azure-functions
python ross.py deploy plan gcp-cloud-run
python ross.py deploy plan edge-worker
```

Plans are written to `workspace/plans/<target>.json`.

## Start the platform (Docker)

```bash
cp .env.example .env
docker compose -f docker-compose.ross.yml up --build
```

Open: http://127.0.0.1:8787

## Layout

```text
ross.py                 CLI entry
ross                    shell wrapper → ross.py
ross_ai/                library (cli, package, deploy, HTTP server)
Dockerfile.ross         container image
docker-compose.ross.yml platform compose file
workspace/scripts/      runtime scripts (hello)
workspace/dist/         .rpkg artifacts
workspace/plans/        deploy plan JSON
ross.json               project manifest (after init)
```

## HTTP surface

| Path | Description |
|------|-------------|
| `/` | Operator dashboard |
| `/health` | Liveness JSON |
| `/metadata` | Product / script / artifact metadata |

## Monorepo integration

Use alongside AOL for the Node tax platform scaffold:

```bash
./scripts/aol install
./scripts/aol run lint
python ross.py init && python ross.py doctor
```

Root scripts: `ross:init`, `ross:doctor`, `ross:dev`, `ross:package`, `ross:hello`.
