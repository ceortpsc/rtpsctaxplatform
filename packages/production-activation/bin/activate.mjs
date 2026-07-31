#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activateProduction, activationHeartbeat, loadLatestActivation } from '../src/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const json = args.includes('--json');
const skipGates = args.includes('--skip-gates');
const heartbeat = args.includes('--heartbeat') || args[0] === 'heartbeat';
const statusOnly = args.includes('--status') || args[0] === 'status';

function parseEvidence(argv) {
  const evidence = {};
  for (const flag of [
    'cloudFormationComplete',
    'tlsIssued',
    'dnsResolved',
    'releaseAttestation',
    'ownerApproved',
    'stagingVerified'
  ]) {
    if (argv.includes(`--evidence-${flag}`)) evidence[flag] = true;
  }
  return evidence;
}

if (statusOnly) {
  const latest = await loadLatestActivation(root);
  const payload = latest || { state: 'PROPOSED', ok: null, note: 'no activation receipts yet' };
  console.log(json ? JSON.stringify(payload, null, 2) : `state=${payload.state} ok=${payload.ok}`);
  process.exit(0);
}

if (heartbeat) {
  const report = await activationHeartbeat(root);
  console.log(json ? JSON.stringify(report, null, 2) : `heartbeat ok=${report.ok} state=${report.latestState}`);
  process.exit(report.ok ? 0 : 1);
}

const result = await activateProduction(root, {
  mode: 'automated',
  trigger: 'cli',
  skipGates,
  evidence: parseEvidence(args),
  requestedBy: process.env.USER || 'operator'
});

if (json) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Production activation → ${result.state}`);
  console.log(`ok=${result.ok} productionVerified=${result.productionVerified}`);
  console.log(`receipt=${result.receipt.outPath}`);
  if (result.gaps?.length) console.log(`gaps=${result.gaps.join(',')}`);
}
process.exit(result.ok ? 0 : 1);
