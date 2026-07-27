# Cursor Terminal Agent — Assignments, Workflows & Triggers

Owner: Ross Tax Pro Software Co.

This document describes how the RTPSC deployment-assist **development team** agents are
**assigned** to required tasks, how those assignments execute through **workflows**, and how
**task triggers** (manual / event / schedule) dispatch them from the terminal.

## Quick start

```bash
./rtpsc agents list
./rtpsc agents run required
./rtpsc agents run validate-platform
./rtpsc agents assign validate-platform testing-agent
./rtpsc agents trigger event '{"assignmentId":"validate-platform"}'
./rtpsc agents workflow list
./rtpsc agents workflow run agent-assignment-dispatch '{"assignmentId":"plan-delivery"}'
./rtpsc agents workflow emit agent.task.requested '{"assignmentId":"assess-environment"}'
```

## Concepts

| Concept | Module | Role |
|---------|--------|------|
| Agent | `agents/*` + `packages/agent-core` | Analyzer that returns a structured report |
| Assignment | `packages/agent-core/src/assignments.mjs` | Required task bound to an agent + trigger |
| Board | `createPlatformAssignmentBoard()` | In-memory roster of assignments + run history |
| Workflow | `workflows/agent-assignment-workflow` | Workflow-engine bridge (resolve → execute → summarize) |
| Trigger | manual / event / schedule | How an assignment or workflow starts |

## Required assignments

Every development-team agent is pre-assigned at least one required task:

| Assignment ID | Agent | Default trigger |
|---------------|-------|-----------------|
| `plan-delivery` | planning-agent | manual |
| `scope-inventory` | scoping-agent | manual |
| `validate-platform` | testing-agent | event:`agent.task.requested` |
| `map-dependencies` | mapping-agent | manual |
| `stage-rollout` | staging-agent | manual |
| `assess-environment` | assessment-agent | event:`agent.task.requested` |
| `seo-ownership-prevalidate` | seo-ownership-agent | manual |
| `generate-docs` | markdown-agent | manual |
| `agent-cycle-health` | testing-agent | schedule:120s |

## Workflows

Registered in the platform workflow-runner alongside refund/transcript/transmission flows:

1. **`agent-assignment-dispatch`** (manual) — run required or targeted assignments
2. **`agent-task-requested`** (event `agent.task.requested`) — event-driven agent tasks
3. **`agent-assignment-cycle`** (schedule 120s) — periodic health/validation cycle

Background sample inputs intentionally target `validate-platform` so the 15s runner cycle stays light.

## Terminal agent policy

- Agents are **dev/deploy tooling**, not a product runtime subsystem.
- No external LLM or API key is required.
- Do not commit client secrets or IRS credentials.
- Prefer `./rtpsc agents` for assignment/trigger work; use `./rtpsc workflow` for domain workflows.
