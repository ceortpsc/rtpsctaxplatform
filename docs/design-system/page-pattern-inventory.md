# Page Pattern Inventory

| Pattern | Used by | Layout file |
|---------|---------|-------------|
| AppShell | staff-portal, modules-dashboard | `shell.css` |
| StandardPageLayout | invoice, enrollment, refund-status | shell.css + page header |
| DataWorkspaceLayout | pos-crm (tabs) | shell.css + tabs |
| AuthLayout | web-portal signin/register | `presentations.mjs` + form-card |
| PublicMarketingLayout | web-portal home/platform/pricing | hero-plane + section-band |
| PageIntroLayout | web-portal status/docs/account/efin | `pageIntro()` |
| WorkspacePanel | authenticated portal tables/forms | `workspacePanel()` |
| DesignSystemShowcase | staff-portal `/design-system` | components.css |
| API-only | api-gateway, transcript, analytics | n/a |

All authenticated operator pages link `/rtp-design/theme.css`, `components.css`, `shell.css`.
Public portal pages render **XHTML** (`application/xhtml+xml`) through
`services/web-portal/src/layout.mjs` + `presentations.mjs`.
