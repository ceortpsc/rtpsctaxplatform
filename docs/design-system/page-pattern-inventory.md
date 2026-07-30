# Page Pattern Inventory

| Pattern | Used by | Layout file |
|---------|---------|-------------|
| AppShell | staff-portal, modules-dashboard | `shell.css` |
| StandardPageLayout | invoice, enrollment, refund-status | shell.css + page header |
| DataWorkspaceLayout | pos-crm (tabs) | shell.css + tabs |
| AuthLayout | web-portal signin/register | web-portal layout |
| PublicMarketingLayout | web-portal home/pricing | web-portal layout |
| DesignSystemShowcase | staff-portal `/design-system` | components.css |
| API-only | api-gateway, transcript, analytics | n/a |

All authenticated operator pages link `/rtp-design/theme.css`, `components.css`, `shell.css`.
