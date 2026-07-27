#!/usr/bin/env node
// Issue / list Client ID # (CL-######) and Customer ID # (CU-######).
// Usage:
//   node scripts/ids.mjs status
//   node scripts/ids.mjs issue client|customer|pair [--name "…"] [--taxpayer-ref TP-…]
//   node scripts/ids.mjs lookup CL-000001
//   node scripts/ids.mjs list [client|customer]

import {
  createPartyIdentityIssuer,
  describePartyIdentity
} from '../packages/party-identity/src/index.mjs';

const issuer = createPartyIdentityIssuer();
await issuer.loadPersisted();

const [command = 'status', kindArg, ...rest] = process.argv.slice(2);

function argValue(flag) {
  const idx = rest.indexOf(flag);
  return idx >= 0 ? rest[idx + 1] : null;
}

if (command === 'help' || command === '--help' || command === '-h') {
  console.log(`RTPSC Client ID # / Customer ID # issuance

Usage:
  ./rtpsc ids status
  ./rtpsc ids issue client [--name "…" ] [--taxpayer-ref TP-…]
  ./rtpsc ids issue customer [--name "…" ] [--taxpayer-ref TP-…]
  ./rtpsc ids issue pair [--name "…" ] [--taxpayer-ref TP-…]
  ./rtpsc ids lookup <CL-######|CU-######>
  ./rtpsc ids list [client|customer]

Distinct from ./rtpsc clients (API/TDS machine credentials).
`);
  process.exit(0);
}

if (command === 'status') {
  console.log(JSON.stringify({ ...describePartyIdentity(), ...issuer.status() }, null, 2));
  process.exit(0);
}

if (command === 'list') {
  const kind = kindArg === 'customer' || kindArg === 'client' ? kindArg : null;
  console.log(JSON.stringify({ records: issuer.list({ kind, limit: 200 }) }, null, 2));
  process.exit(0);
}

if (command === 'lookup') {
  const number = kindArg;
  if (!number) {
    console.error('Usage: ./rtpsc ids lookup CL-000001');
    process.exit(1);
  }
  const record = issuer.get(number);
  if (!record) {
    console.error(`Not found: ${number}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ record }, null, 2));
  process.exit(0);
}

if (command === 'issue') {
  const kind = kindArg === 'customer' ? 'customer' : kindArg === 'pair' ? 'pair' : 'client';
  const name = argValue('--name');
  const taxpayerRef = argValue('--taxpayer-ref') ?? argValue('--ref');
  try {
    if (kind === 'pair') {
      const pair = await issuer.issuePair({ name, taxpayerRef, source: 'cli' });
      console.log(JSON.stringify(pair, null, 2));
    } else {
      const result = await issuer.issue({ kind, name, taxpayerRef, source: 'cli' });
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

console.error(`Unknown command: ${command}
Usage:
  node scripts/ids.mjs status
  node scripts/ids.mjs issue client|customer|pair [--name "Label"] [--taxpayer-ref TP-…]
  node scripts/ids.mjs lookup CL-000001
  node scripts/ids.mjs list [client|customer]`);
process.exit(1);
