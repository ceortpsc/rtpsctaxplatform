# Page Inventory

Human-facing pages and SPA views in the scaffold.

## Ross AI control plane (`http://127.0.0.1:8787`)

| Route | Page | Auth |
|-------|------|------|
| `/` | Landing hero | Public |
| `/marketplace` | Membership tiers | Public |
| `/legal` | Policy / disclosures | Public |
| `/signup` | Create account (secure access) | Public |
| `/signin` | Sign in | Public |
| `/verify-email` | Email OTP | Session |
| `/set-password` | Password setup | Session |
| `/setup-mfa` / `/mfa` | MFA enrollment / challenge | Session |
| `/membership` | Tier election | Authed |
| `/payment` | Payment method on file | Authed |
| `/billing` | Billing history | Authed |
| `/dashboard` | Operator console | Authed + membership |
| `/modules` `/engines` `/systems` | Inventory grids | Authed |
| `/infrastructure` | Hardening posture | Authed |
| `/packages` `/deploy` `/runtime` | Package / deploy / runtime | Authed |
| `/users` | Member roster table | Authed |
| `/rbac` | Roles matrix | Authed |
| `/execute` | Transparent execution | Authed |

## Modules dashboard `:3010`

Views (client-side): Catalog, Insights, AI Assistant, Dependency Graph, System Status,
Design System. Read-only catalog — does not trigger workflows.

## Operator service UIs

| Port | Page | Capability (honest) |
|------|------|---------------------|
| 3001 | Refund center | Cases/events stubs + client auth |
| 3004 | Enrollment | SBTPG intent + payment gate; no live funding |
| 3005 | Invoice machine | Draft→pay + hand-rolled PDF |
| 3006 | POS + CRM + ERO | Local demo contact; no live SBTPG/IRS |
| 8860 | AI workforce | Hire/pay/run personas under governance holds |

## No HTML UI

`:3000` gateway, `:3002` transcript, `:3003` analytics, `:8820` IRS gateway — API/metadata
only.

## Presence

`presence/rossco/index.html` — ROSS.CO lifecycle marketing page.
