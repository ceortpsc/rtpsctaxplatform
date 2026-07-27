# Page Layouts

`PAGE_LAYOUTS` in `@rtp/ui-system`:

| Layout | Typical use |
|--------|-------------|
| AppShell | Operator services with sidebar |
| AuthLayout | Sign-in / signup / MFA (Ross AI gate) |
| DashboardLayout | Metrics + panels |
| StandardPageLayout | Generic content |
| FormPageLayout | Constrained forms (`--form-max`) |
| DataWorkspaceLayout | Tables + filters |
| SplitViewLayout | List + detail |
| DetailPageLayout | Entity detail |
| DocumentLayout | Invoice / PDF preview |
| SettingsLayout | System settings |
| ClientPortalLayout | Restricted client nav |
| FullScreenWorkflowLayout | Enrollment / hire flows |
| PrintLayout | Printable documents |

Ross AI uses a sticky topbar + console/gate/hero compositions rather than AppShell.
