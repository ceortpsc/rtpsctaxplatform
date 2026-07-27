# Page Upgrade Completion Matrix

Statuses:

- **Fully upgraded** — consumes RTPSC navy/gold token family end-to-end for that surface
- **Functionally preserved but visually upgraded** — behavior unchanged; styles remapped to new tokens
- **Partially upgraded** — shared assets or partial token use; local legacy CSS remains
- **Not upgraded (legacy)** — still on cream / alternate palette
- **API-only / N/A** — no HTML UI
- **Unimplemented** — nav placeholder only

| Surface | Route(s) | Status | Notes |
|---------|----------|--------|-------|
| Ross AI landing | `:8787/` | Functionally preserved but visually upgraded | app.css rewritten to ui-system tokens; RTPSC chip; skip link |
| Ross AI marketplace | `/marketplace` | Functionally preserved but visually upgraded | Same CSS family |
| Ross AI legal | `/legal` | Functionally preserved but visually upgraded | |
| Ross AI signup/signin | `/signup` `/signin` | Functionally preserved but visually upgraded | Secure-access language |
| Ross AI MFA / verify / password | `/mfa` `/verify-email` `/set-password` `/setup-mfa` | Functionally preserved but visually upgraded | |
| Ross AI membership / payment / billing | `/membership` `/payment` `/billing` | Functionally preserved but visually upgraded | |
| Ross AI dashboard | `/dashboard` | Functionally preserved but visually upgraded | Dark control plane, navy/gold |
| Ross AI inventory grids | `/modules` `/engines` `/systems` | Functionally preserved but visually upgraded | |
| Ross AI infrastructure | `/infrastructure` | Functionally preserved but visually upgraded | |
| Ross AI packages/deploy/runtime | `/packages` `/deploy` `/runtime` | Functionally preserved but visually upgraded | |
| Ross AI users / rbac / execute | `/users` `/rbac` `/execute` | Functionally preserved but visually upgraded | |
| Presence ROSS.CO | `presence/rossco/` | Functionally preserved but visually upgraded | Cyan glow → navy/gold |
| UI system theme/shell/components | `packages/ui-system/public/*` | Fully upgraded | Canonical tokens |
| Modules dashboard shell | `:3010` views | Partially upgraded | Shared theme path evolving; design view copy may still say Sovereign Ledger |
| Invoice UI | `:3005/` | Functionally preserved but visually upgraded | App shell + `/shared/theme.css` tokens |
| Refund UI | `:3001/` | Functionally preserved but visually upgraded | App shell + shared tokens |
| POS-CRM UI | `:3006/` | Partially upgraded | Shared serving wired; confirm full shell adoption |
| Enrollment UI | `:3004/` | Functionally preserved but visually upgraded | App shell + shared tokens |
| AI workforce UI | `:8860/` | Not upgraded (legacy) | Forest/lime local palette — outside navy/gold family |
| API gateway | `:3000` | API-only / N/A | |
| Transcript | `:3002` | API-only / N/A | |
| Analytics | `:3003` | API-only / N/A | |
| IRS gateway | `:8820` | API-only / N/A | |
| Tax Returns / E-file / Notices / etc. | nav stubs | Unimplemented | `implemented: false` |

## Target end-state

All HTML operator UIs import `/shared/theme.css` (+ shell/components) or an equivalent
token mirror, with zero cream-only or forest-green one-offs.
