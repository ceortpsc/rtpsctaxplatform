# @rtp/rtp-datastore

Dependency-free, file-backed **document datastore** providing persistent
**"DB instances"** for the RTPSC platform without pulling in Postgres, Redis, or
an ORM. Uses Node built-ins only (`node:fs`, `node:path`, `node:crypto`).

## Why

The platform is intentionally dependency-free. Services historically kept state
in ephemeral in-memory arrays (lost on restart). This package gives services a
small persistent store so state survives restarts, while keeping the zero-runtime
-dependency philosophy.

## Concepts

- **Database instance** — a named store (e.g. `portal`) registered in a
  process-level registry. Repeated `createDatabase({ name })` calls return the
  same instance.
- **Collection** — a JSON document array persisted atomically to
  `<dir>/<database>/<collection>.json` (default dir `logs/db`).

## Usage

```js
import { createDatabase, listDatabases } from '@rtp/rtp-datastore';

const db = createDatabase({ name: 'portal' });        // persisted under logs/db/portal
const accounts = db.collection('accounts');

const account = accounts.insert({ email: 'ops@example.com', name: 'Ops' });
accounts.getById(account.id);
accounts.findOne({ email: 'ops@example.com' });
accounts.update(account.id, { name: 'Operations' });
accounts.count();

listDatabases();  // [{ name: 'portal', collections: [{ name: 'accounts', count: 1 }], ... }]
```

Pass `persist: false` for in-memory instances (used by tests).

## Collection API

`insert(doc)`, `getById(id)`, `findOne(query)`, `find(query)`, `all()`,
`count(query?)`, `update(id, patch)`, `remove(id)`, `clear()`.

`query` may be a partial-match object (`{ field: value }`) or a predicate
function `(doc) => boolean`. Every document is assigned `id`, `createdAt`, and
`updatedAt` automatically.

## Notes

- Writes are atomic (temp file + rename) to avoid partial-write corruption.
- Storage files live under `logs/db/` which is gitignored.
- This is development-grade persistence; production storage still requires the
  approved database/queue infrastructure described in the platform milestones.
