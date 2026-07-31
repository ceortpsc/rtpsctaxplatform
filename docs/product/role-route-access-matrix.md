# Role–Route Access Matrix

| Route | platform_admin | org_owner | ero | office_manager | tax_preparer | billing_specialist | client | auditor |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| staff-portal `/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| invoice `/` | ✓ | ✓ | — | ✓ | — | ✓ | — | ✓ |
| enrollment `/` | ✓ | ✓ | — | ✓ | — | ✓ | — | — |
| pos-crm `/` | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | ✓ |
| refund-status `/` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| modules-dashboard | ✓ | ✓ | — | ✓ | — | — | — | ✓ |
| ai-workforce | ✓ | ✓ | — | — | — | — | — | — |
| web-portal public | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| web-portal `/account` | — | — | — | — | — | — | ✓ | — |
| irs-gateway `/irs/token` | ✓ | ✓ | ✓ | — | — | — | — | — |
| e-file transmission | ✓ | ✓ | ✓ | — | — | — | — | — |

Enforcement: UI navigation filtered via `@rtp/ui-design-system` roles module. API routes enforce client credentials or clearance tokens where implemented. Full RBAC/ABAC backend is scaffold-only for unimplemented modules.
