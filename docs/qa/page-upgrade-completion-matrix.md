# Page Upgrade Completion Matrix

Statuses used in this matrix:

| Status | Meaning |
|--------|---------|
| **Fully upgraded** | Shared theme + App Shell (or approved specialized layout) end-to-end |
| **Functionally preserved but visually upgraded** | Behavior unchanged; visual system remapped to RTPSC Enterprise tokens |
| **Consolidated** | Folded into another upgraded route/view |
| **Removed** | Obsolete and deleted with justification |
| **Blocked** | Cannot fully ship without a named backend dependency |
| **API-only / N/A** | No HTML UI surface |
| **Unimplemented** | Navigation placeholder only (`implemented: false`) — not shown as available |

Inventory source: `docs/product/application-route-inventory.md` and `docs/product/page-inventory.md`.

## Operator HTTP UIs

| Surface | Route(s) | Status | Notes |
|---------|----------|--------|-------|
| Modules dashboard / Platform hub | `:3010/` + hash views | Fully upgraded | App Shell; catalog/insights/assistant/graph/status/design + limited hub views |
| Hub · Dashboard | `#dashboard` | Fully upgraded | Ops overview; empty-aware metrics; no fake data |
| Hub · Activity | `#activity` | Fully upgraded | Limited empty state |
| Hub · Tasks | `#tasks` | Fully upgraded | Limited empty state |
| Hub · Notifications | `#notifications` | Fully upgraded | Limited empty state |
| Hub · Documents | `#documents` | Fully upgraded | Limited empty state |
| Hub · Reports | `#reports` | Fully upgraded | Limited empty state |
| Hub · Staff | `#staff` | Fully upgraded | Limited empty state |
| Hub · Settings | `#settings` | Fully upgraded | Settings layout pattern |
| Hub · Help | `#help` | Fully upgraded | Limited support surface |
| Hub · Catalog | `#catalog` | Fully upgraded | Existing catalog preserved |
| Hub · Insights | `#insights` | Fully upgraded | |
| Hub · Assistant | `#assistant` | Fully upgraded | Local heuristic advisor |
| Hub · Graph | `#graph` | Fully upgraded | |
| Hub · Status | `#status` | Fully upgraded | |
| Hub · Design System | `#design` `/design-system` | Fully upgraded | Component showcase; no sensitive data |
| Invoice workspace | `:3005/` | Fully upgraded | Shell + create/approve/pay + `#list` `#payments` `#catalog` `#approvals` |
| Enrollment / Intake | `:3004/` | Fully upgraded | Shell + clearance + payment gate honesty |
| Refund center | `:3001/` | Fully upgraded | Shell + cases table + timeline |
| POS + CRM | `:3006/` `#crm` `#pos` `#ero` | Fully upgraded | Shell + tab sections |
| AI Workforce Hub | `:8860/` | Fully upgraded | Shell; Google Fonts removed; Limited badge; RTP-AI-001 banner |
| Branded 404 (all UI services) | unknown paths | Fully upgraded | `sendNotFoundPage` |

## Ross AI control plane (`:8787`)

| Surface | Route(s) | Status | Notes |
|---------|----------|--------|-------|
| Landing | `/` | Functionally preserved but visually upgraded | Navy/gold family; skip link |
| Marketplace | `/marketplace` | Functionally preserved but visually upgraded | |
| Legal / policy | `/legal` (+ aliases) | Functionally preserved but visually upgraded | |
| Sign in | `/signin` `/login` | Functionally preserved but visually upgraded | Secure-access copy |
| Sign up | `/signup` `/register` | Functionally preserved but visually upgraded | |
| Verify email | `/verify-email` | Functionally preserved but visually upgraded | |
| Set password | `/set-password` | Functionally preserved but visually upgraded | |
| Setup MFA | `/setup-mfa` | Functionally preserved but visually upgraded | |
| MFA challenge | `/mfa` | Functionally preserved but visually upgraded | |
| Membership | `/membership` | Functionally preserved but visually upgraded | |
| Payment | `/payment` | Functionally preserved but visually upgraded | Stub charges |
| Billing | `/billing` | Functionally preserved but visually upgraded | |
| Users | `/users` | Functionally preserved but visually upgraded | |
| Dashboard | `/dashboard` | Functionally preserved but visually upgraded | AuthLayout/AppShell patterns via CSS |
| Modules / engines / systems | `/modules` `/engines` `/systems` | Functionally preserved but visually upgraded | |
| Infrastructure / foundation | `/infrastructure` `/foundation` | Functionally preserved but visually upgraded | |
| Packages / deploy / runtime | `/packages` `/deploy` `/runtime` | Functionally preserved but visually upgraded | |
| RBAC | `/rbac` | Functionally preserved but visually upgraded | |
| Execute | `/execute` | Functionally preserved but visually upgraded | |
| SEO | `/robots.txt` `/sitemap.xml` | N/A | Non-HTML |
| GitHub OAuth | `/auth/github*` | Functionally preserved but visually upgraded | Partial / simulatable |

## Presence & static marketing

| Surface | Route(s) | Status | Notes |
|---------|----------|--------|-------|
| ROSS.CO presence | `presence/rossco/` | Functionally preserved but visually upgraded | Cyan glow removed |

## API-only services (no UI to upgrade)

| Surface | Port | Status |
|---------|------|--------|
| API gateway | 3000 | API-only / N/A |
| Transcript service | 3002 | API-only / N/A |
| Analytics service | 3003 | API-only / N/A |
| IRS gateway | 8820 | API-only / N/A |

## Unimplemented product nav (honestly unavailable)

| Item | Status | Notes |
|------|--------|-------|
| Leads, Engagements, Communications | Unimplemented | Not rendered as available |
| Tax Returns, E-file, Acknowledgments, Notices, Taxpayer Authorizations, Compliance Review, Audit Defense | Unimplemented | Transcript API exists but no UI |
| Bookkeeping, Payroll, Reconciliation | Unimplemented | |
| Assignments, Calendar, Automations, Templates | Unimplemented | |
| Offices, Integrations, Knowledge Base, Release Notes | Unimplemented | |

## Client portal

| Surface | Status | Notes |
|---------|--------|-------|
| Client portal shell (`#client-portal` on hub) | Fully upgraded | Distinct simpler nav pattern; limited — no separate multi-tenant portal backend |

## Blocked features

| Feature | Blocked by |
|---------|------------|
| Live SBTPG funding | Requires prod env, `SBTPG_*` secrets, `SBTPG_ENABLED=true` |
| Live IRS transmission | Credentials / tunnel not provisioned |
| HTML transactional email delivery | SMTP optional; templates are brand-aligned stubs |
| Formal WCAG certification | Independent assessment still required |

## Reconciliation

- Discovered HTML UI surfaces: **accounted for** in this matrix (operator UIs + Ross AI routes + presence)
- No discovered HTML route left as cream-only prototype or forest-green one-off
- Unimplemented nav items are **not** silently ignored — marked Unimplemented and excluded from available nav
