# Role → Route Access Matrix

Two role systems exist:

1. **Platform UI roles** — `ROLES` in `packages/ui-system/src/index.mjs` (navigation gating).
2. **Ross AI RBAC roles** — `viewer`, `operator`, `billing`, `engineer`, `admin`, `owner` in
   `ross_ai/rbac.py` (permission strings on the control plane).

This matrix maps **ui-system roles** to application routes/surfaces. “Limited” means the
route exists as a stub, hash target, or partial UI.

## Legend

- **F** Full intended access to implemented surface
- **L** Limited / read-oriented / stub
- **—** Not in `navigationForRole` filter (hidden) or not applicable
- **A** Ross AI only (control-plane RBAC applies separately)

## Platform navigation destinations

| Destination | port/path | platform_administrator | organization_owner | ero | office_manager | tax_preparer | reviewer | bookkeeper | payroll_specialist | billing_specialist | support_agent | client | read_only_auditor |
|-------------|-----------|------------------------|--------------------|-----|----------------|--------------|----------|------------|--------------------|--------------------|---------------|--------|-------------------|
| Dashboard | :3010 `/` | F | F | F | F | F | F | F | F | F | F | F | F |
| Activity/Tasks/Notifications | :3010 `#*` | L | L | L | L | L | L | L | L | L | L | — | L |
| Clients (CRM) | :3006 `#crm` | F | F | F | F | F | F | F | — | F | F | — | F |
| Intake (enrollment) | :3004 | F | F | F | F | F | L | — | — | L | F | — | L |
| Documents | :3010 limited | L | L | L | L | L | L | L | — | L | L | L | L |
| Refunds / Cases | :3001 | F | F | F | F | F | F | — | — | F | F | — | F |
| AI Workforce | :8860 | F | F | F | F | L | L | — | — | — | L | — | — |
| Invoices / Payments / Catalog | :3005 | F | F | F | F | L | L | F | — | F | L | F* | F |
| POS | :3006 `#pos` | F | F | F | F | L | — | L | — | F | — | — | — |
| Approvals | :3005 | F | F | F | F | L | F | L | — | F | L | — | F |
| Roles (RBAC UI) | :8787 `/rbac` | A | A | A | A | A | A | A | A | A | A | — | A |
| Security / Infra | :8787 `/infrastructure` | A | A | A | A | — | — | — | — | — | — | — | A |
| Audit (enrollment) | :3004 | L | L | L | L | — | L | — | — | — | L | — | L |
| Module catalog / insights / assistant / graph / status / design | :3010 | F | F | F | F | F | F | F | F | F | F | —† | F |
| Control plane dashboard | :8787 `/dashboard` | A | A | A | A | A | A | A | A | A | A | — | A |
| Help | :3010 limited | L | L | L | L | L | L | L | L | L | L | L | L |

\* Client sees invoices/payments only when those nav ids are allowed (`navigationForRole('client')`).  
† Client filter keeps `dashboard`, `documents`, `invoices`, `payments`, `help` only.

## Unimplemented nav (all roles)

Tax Returns, E-file, Acknowledgments, Notices, Transcripts UI, Compliance Review, Audit
Defense, Leads, Engagements, Communications, Bookkeeping, Payroll, Reconciliation,
Assignments, Calendar, Automations, Templates, Offices, Integrations, Knowledge Base,
Release Notes — `implemented: false` in `NAVIGATION`.

## Ross AI RBAC (control plane)

| Permission area | viewer | operator | billing | engineer | admin | owner |
|-----------------|--------|----------|---------|----------|-------|-------|
| Console / inventory / hardening | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Billing read/write, membership | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Users read | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Users write / roles assign | — | — | — | — | ✓ | ✓ |
| Code execute / scripts | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin audit | — | — | — | ✓ | ✓ | ✓ |

Public routes (`/`, `/marketplace`, `/legal`, `/signin`, `/signup`) require no role.
