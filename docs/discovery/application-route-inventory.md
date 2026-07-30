# Application Route Inventory

Generated during platform unification (Sovereign Ledger design system). Every discovered HTTP route and page surface is listed below.

## Summary

| Category | Count |
|----------|------:|
| HTTP services | 12 |
| Server-rendered pages (web-portal) | 9 |
| SPA operator UIs | 7 |
| Ross AI pages (Python) | 20+ |
| API-only stubs | 4 |

## Services and Routes

### api-gateway `:3000`
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/health` | GET | public | ready |
| `/metadata` | GET | public | ready |
| `/api/clients` | GET | staff | ready |
| `/api/auth/token` | POST | client | ready |
| `/api/refund/*` | * | client | ready (proxy) |

### refund-status-service `:3001`
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/` | GET | staff | upgraded |
| `/api/cases` | GET | client | ready |
| `/api/events` | POST | client | ready |

### transcript-service `:3002`
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/health`, `/metadata` | GET | public | stub |

### analytics-service `:3003`
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/health`, `/metadata` | GET | public | stub |

### enrollment-service `:3004`
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/` | GET | staff | upgraded |
| `/api/enrollments` | * | staff | ready |

### invoice-service `:3005`
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/` | GET | staff | upgraded |
| `/api/invoices` | * | staff | ready |

### pos-crm-service `:3006`
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/` | GET | staff | upgraded |
| `/api/contacts` | * | staff | ready |
| `/api/pos/*` | * | staff | ready |

### modules-dashboard `:3010`
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/` | GET | staff | upgraded |
| `/api/modules` | GET | staff | ready |

### staff-portal `:3012` (new)
| Path | Method | Role | Status |
|------|--------|------|--------|
| `/` | GET | staff | upgraded |
| `/design-system` | GET | staff | upgraded |
| `/api/navigation` | GET | staff | ready |
| `/api/dashboard` | GET | staff | limited |

### web-portal `:3011`
| Path | Role | Status |
|------|------|--------|
| `/` | public | upgraded |
| `/platform` | public | upgraded |
| `/pricing` | public | upgraded |
| `/status` | public | upgraded |
| `/docs` | public | upgraded |
| `/register` | public | upgraded |
| `/signin` | public | upgraded |
| `/account` | client | upgraded |
| `/efin` | staff | upgraded |

### irs-gateway `:8820`
| Path | Status |
|------|--------|
| `/irs/token` | blocked_credentials |

### ai-workforce-hub `:8860`
| Path | Status |
|------|--------|
| `/` | upgraded |
| `/v1/*` | ready |

### Ross AI `:8787`
Landing, auth, dashboard, modules, execute, RBAC — distinct Python UI; tokens partially aligned.

## Shared Design System

All upgraded services mount `@rtp/ui-design-system` at `/rtp-design/*`.
