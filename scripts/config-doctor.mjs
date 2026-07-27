#!/usr/bin/env node
/**
 * RTPSC configuration doctor — reports actual tunnel, gateway, transmitter,
 * endpoint, route, and pipeline configuration status.
 */
import { loadPlatformEnv, loadRuntimeConfig, redactConfig, evaluateEnvironmentProtection } from '../packages/platform-core/src/index.mjs';
import { createSecureTunnelAdapter } from '../packages/secure-tunnel/src/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

loadPlatformEnv({ cwd: process.cwd() });

const asJson = process.argv.includes('--json');
const runtime = loadRuntimeConfig();
const protection = evaluateEnvironmentProtection(runtime);
const tunnel = createSecureTunnelAdapter();
const description = tunnel.describe();

const report = {
  checkedAt: new Date().toISOString(),
  envFile: loadPlatformEnv({ cwd: process.cwd() }),
  runtime: redactConfig(runtime),
  protection,
  tunnel: description,
  gateways: description.gateways,
  services: tunnel.services,
  workers: tunnel.workers,
  pipelines: tunnel.pipelines,
  allowlist: tunnel.allowlist,
  transmitters: description.transmitters,
  readiness: {
    tunnelStatus: tunnel.status,
    transmissionAllowed: protection.transmissionAllowed,
    irsCredentialsLikely: runtime.apiClientSecret !== 'unset' && false, // IRS keys separate
    nextSteps:
      tunnel.status === 'ready'
        ? ['Provision IRS private key + client id', 'Confirm legal sign-offs', 'Run transmission smoke in prod']
        : tunnel.status === 'configured'
          ? [
              'Tunnel allowlist + client configured',
              'Set APP_ENV=prod only after approvals',
              'Provision IRS_CLIENT_ID_PRIMARY / KEY / PRIVATE_KEY_PATH',
              'Set EFILE_TRANSMISSION_ENABLED=true only then'
            ]
          : ['Set APPROVED_TUNNEL_ENDPOINT to an allowlisted HTTPS URL', 'Set TUNNEL_CLIENT_ID / TUNNEL_CLIENT_SECRET', 'Copy env/.env.local.example → .env']
  }
};

mkdirSync('build', { recursive: true });
writeFileSync('build/platform-config-doctor.json', JSON.stringify(report, null, 2));

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`RTPSC Config Doctor — tunnel: ${tunnel.status}`);
  console.log(`Transmission allowed: ${protection.transmissionAllowed}`);
  console.log(`Approved tunnel: ${description.config.approvedTunnelEndpoint}`);
  console.log(`Gateways: ${description.gateways.map((g) => `${g.id}:${g.port}`).join(', ')}`);
  console.log(`Services: ${tunnel.services.length} · Workers: ${tunnel.workers.length} · Pipelines: ${tunnel.pipelines.length}`);
  console.log(`Allowlist: ${tunnel.allowlist.map((a) => a.id).join(', ')}`);
  if (description.reasons?.length) {
    console.log('Holds:');
    for (const reason of description.reasons) console.log(`  - ${reason}`);
  }
  console.log('Wrote build/platform-config-doctor.json');
}
