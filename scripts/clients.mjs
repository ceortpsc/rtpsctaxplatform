#!/usr/bin/env node
// Issue / list / revoke full API and TDS client identities.
// Usage:
//   node scripts/clients.mjs status
//   node scripts/clients.mjs issue api|tds [--name "…"]
//   node scripts/clients.mjs export-env   # print export lines for latest active clients (needs secrets from issue)

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createClientRegistry } from '../packages/client-identity/src/index.mjs';

const registry = createClientRegistry();
await registry.loadPersisted();
registry.seedFromEnv();

const [command = 'status', kindArg, ...rest] = process.argv.slice(2);

function argValue(flag) {
  const idx = rest.indexOf(flag);
  return idx >= 0 ? rest[idx + 1] : null;
}

if (command === 'status' || command === 'list') {
  console.log(JSON.stringify(registry.status(), null, 2));
  process.exit(0);
}

if (command === 'issue') {
  const kind = kindArg === 'tds' ? 'tds' : 'api';
  const name = argValue('--name') ?? `Issued ${kind.toUpperCase()} client`;
  const issued = await registry.issueClient({ kind, name, source: 'cli' });
  // Save one-time secrets sidecar (gitignored logs/) for local wiring
  const secretsPath = path.resolve(process.cwd(), 'logs', 'issued-client-secrets.json');
  await mkdir(path.dirname(secretsPath), { recursive: true });
  let existing = [];
  try {
    existing = JSON.parse(await readFile(secretsPath, 'utf8'));
  } catch {
    existing = [];
  }
  existing.push({
    at: new Date().toISOString(),
    kind: issued.credentials.kind,
    clientId: issued.credentials.clientId,
    clientSecret: issued.credentials.clientSecret
  });
  await writeFile(secretsPath, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(JSON.stringify(issued, null, 2));
  console.log(`\nSecret also appended to ${secretsPath} (gitignored).`);
  process.exit(0);
}

if (command === 'ensure') {
  const issued = await registry.ensureLocalClients();
  console.log(JSON.stringify({ issued: issued.map((i) => i.credentials), status: registry.status() }, null, 2));
  process.exit(0);
}

if (command === 'export-env') {
  const secretsPath = path.resolve(process.cwd(), 'logs', 'issued-client-secrets.json');
  let rows = [];
  try {
    rows = JSON.parse(await readFile(secretsPath, 'utf8'));
  } catch {
    console.error('No issued-client-secrets.json yet. Run: ./rtpsc clients issue api && ./rtpsc clients issue tds');
    process.exit(1);
  }
  const latestApi = [...rows].reverse().find((r) => r.kind === 'api');
  const latestTds = [...rows].reverse().find((r) => r.kind === 'tds');
  if (latestApi) {
    console.log(`export API_CLIENT_ID='${latestApi.clientId}'`);
    console.log(`export API_CLIENT_SECRET='${latestApi.clientSecret}'`);
  }
  if (latestTds) {
    console.log(`export TDS_CLIENT_ID='${latestTds.clientId}'`);
    console.log(`export TDS_CLIENT_SECRET='${latestTds.clientSecret}'`);
  }
  process.exit(0);
}

console.error(`Unknown command: ${command}
Usage:
  node scripts/clients.mjs status
  node scripts/clients.mjs issue api|tds [--name "Label"]
  node scripts/clients.mjs ensure
  node scripts/clients.mjs export-env`);
process.exit(1);
