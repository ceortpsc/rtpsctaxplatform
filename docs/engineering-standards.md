# Engineering Standards

## Language and Runtime

- Node.js 22+ with workspace-based package layout.
- Native `node:test` for focused baseline coverage.
- Prefer standard library implementations unless a new dependency is justified and reviewed.

## Coding Conventions

- Keep modules small and single-purpose.
- Treat all IRS and taxpayer-facing integrations as approved adapters with explicit TODO gates.
- Favor immutable metadata objects for service, worker, pipeline, and engine descriptors.
- Do not embed credentials, certificates, or production endpoints in source.

## Workflow

1. Copy an environment example into a secure local `.env` file.
2. Run `./scripts/aol run lint`, `./scripts/aol run test`, and `./scripts/aol run build` before publishing changes.
3. Add or update documentation whenever architecture or operational responsibilities change.
4. Record approval checkpoints for any change touching sensitive data flows.

## Review Expectations

- Confirm compliance boundaries are still explicit.
- Confirm no scraping or unauthorized integrations were added.
- Confirm new modules expose health or metadata surfaces where applicable.
- Confirm secrets remain environment-based.
