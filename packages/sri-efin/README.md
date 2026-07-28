# @rtp/sri-efin

**SRI (Secure Registration & Identity) — EFIN provider scaffolding.**

Dependency-free scaffold for the IRS **Authorized e-file Provider** identity used
to transmit returns. Models the provider's **EFIN** (Electronic Filing
Identification Number), optional **ETIN** (Electronic Transmitter Identification
Number), provider roles, responsible official, and a suitability lifecycle.

> Scaffold only. This module performs **no** real IRS e-Services / suitability
> calls. EFIN activation and provider suitability must be verified through the
> approved IRS channels before any production transmission. Persistence uses
> `@rtp/rtp-datastore` (local, development-grade).

## Concepts

- **EFIN** — 6 digits (validated; masked in API/UI output as `12••90`).
- **ETIN** — 5 digits, optional.
- **Provider types** — `ero`, `transmitter`, `software-developer`,
  `reporting-agent`, `intermediate-service-provider`.
- **Status lifecycle** — `draft → submitted → suitability-pending → active`
  with `inactive` / `suspended` / `rejected` branches. Transitions are fail-safe:
  unknown transitions are rejected.

## Usage

```js
import { createDatabase } from '@rtp/rtp-datastore';
import { createEfinRegistry } from '@rtp/sri-efin';

const db = createDatabase({ name: 'portal' });
const efin = createEfinRegistry({ db });

const created = efin.register({
  efin: '123456',
  firmName: 'Ross Tax Pro',
  providerTypes: ['ero', 'transmitter'],
  responsibleOfficial: { name: 'Jordan Ellis', title: 'Owner', email: 'jordan@example.com' }
});
// created.provider.status === 'draft', efinMasked === '12••56'

efin.transition(created.provider.id, 'submitted');
efin.transition(created.provider.id, 'suitability-pending');
efin.transition(created.provider.id, 'active');
```

## API

Pure helpers: `validateEfin`, `validateEtin`, `createEfinRecord`, `canTransition`,
`transitionEfinStatus`, `publicEfinRecord`, plus `PROVIDER_TYPES` and
`EFIN_STATUSES`.

Persistent registry: `createEfinRegistry({ db })` →
`register`, `get`, `byEfin`, `list`, `transition`, `count`.

The raw EFIN is stored in the datastore but never returned by the registry API —
responses use the masked projection (`publicEfinRecord`).
