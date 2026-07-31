#!/usr/bin/env node
// RTPSC security CLI — posture, secrets, tunnel gate, doctor, scan.

import { evaluateEnvironmentProtection, PLATFORM_IDENTITY } from '../packages/platform-core/src/index.mjs';
import {
  decryptField,
  encryptField,
  evaluateSecurityPosture,
  mintAccessToken,
  verifyAccessToken
} from '../packages/security-core/src/index.mjs';
import { evaluateSecretsStatus, listSecretCatalog } from '../packages/secrets-config/src/index.mjs';
import { createSecureTunnelAdapter, evaluateTunnelGate } from '../packages/secure-tunnel/src/index.mjs';
import { runSecurityScan } from '../workers/security-scanner-worker/src/index.mjs';

function usage() {
  return [
    'RTPSC security — operator security tooling',
    '',
    'Usage: ./rtpsc security <command>',
    '',
    'Commands:',
    '  status                 Aggregate security posture (redacted)',
    '  secrets                Secrets readiness + catalog (redacted)',
    '  tunnel                 Secure tunnel gate + adapter status',
    '  doctor                 Full security doctor report',
    '  scan                   Run security-scanner worker; write build report',
    '  encrypt <text>         AES-256-GCM encrypt (requires ENCRYPTION_KEY)',
    '  decrypt <ciphertext>   Decrypt a v1 ciphertext blob',
    '  mint-demo              Mint a demo HMAC token (requires SESSION_SECRET)',
    '  help                   Show this help'
  ].join('\n');
}

function print(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function main(argv) {
  const [cmd = 'status', ...rest] = argv;

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(usage());
    return;
  }

  if (cmd === 'status') {
    const secrets = evaluateSecretsStatus();
    const tunnelGate = evaluateTunnelGate();
    print({
      identity: PLATFORM_IDENTITY,
      security: evaluateSecurityPosture({ tunnelGate, secretsStatus: secrets }),
      environmentProtection: evaluateEnvironmentProtection()
    });
    return;
  }

  if (cmd === 'secrets') {
    print({
      identity: PLATFORM_IDENTITY,
      catalog: listSecretCatalog(),
      status: evaluateSecretsStatus()
    });
    return;
  }

  if (cmd === 'tunnel') {
    print({
      identity: PLATFORM_IDENTITY,
      gate: evaluateTunnelGate(),
      adapter: createSecureTunnelAdapter()
    });
    return;
  }

  if (cmd === 'doctor') {
    const secrets = evaluateSecretsStatus();
    const tunnelGate = evaluateTunnelGate();
    const security = evaluateSecurityPosture({ tunnelGate, secretsStatus: secrets });
    const envProt = evaluateEnvironmentProtection();
    const checks = [
      { id: 'SEC-HEADERS', ok: true, detail: 'Platform security headers available via security-core / platform-core' },
      { id: 'SEC-SESSION', ok: security.sessionSecretReady, detail: security.sessionSecretReady ? 'SESSION/JWT secret ready' : 'Provision SESSION_SECRET' },
      { id: 'SEC-ENCRYPT', ok: security.encryptionReady, detail: security.encryptionReady ? 'ENCRYPTION_KEY ready' : 'Provision ENCRYPTION_KEY' },
      { id: 'SEC-SECRETS', ok: secrets.ready, detail: secrets.summary },
      { id: 'SEC-TUNNEL', ok: tunnelGate.configReady, detail: tunnelGate.reasons.join(' ') || 'Tunnel config ready (adapter remains stub)' },
      { id: 'SEC-EFILE', ok: envProt.transmissionAllowed, detail: envProt.transmissionAllowed ? 'E-file transmission allowed' : envProt.reasons.join(' ') }
    ];
    print({
      identity: PLATFORM_IDENTITY,
      overall: checks.every((c) => c.ok) ? 'hardened_ready' : 'scaffold_attention',
      checks,
      security,
      tunnel: createSecureTunnelAdapter(),
      secrets,
      environmentProtection: envProt
    });
    return;
  }

  if (cmd === 'scan') {
    const { report, outPath } = await runSecurityScan();
    print({ writtenTo: outPath, summary: report.posture, secretsReady: report.secrets.ready });
    return;
  }

  if (cmd === 'encrypt') {
    const text = rest.join(' ');
    if (!text) {
      console.error('Usage: ./rtpsc security encrypt <text>');
      process.exitCode = 1;
      return;
    }
    print(encryptField(text));
    return;
  }

  if (cmd === 'decrypt') {
    const blob = rest[0];
    if (!blob) {
      console.error('Usage: ./rtpsc security decrypt <ciphertext>');
      process.exitCode = 1;
      return;
    }
    print(decryptField(blob));
    return;
  }

  if (cmd === 'mint-demo') {
    const minted = mintAccessToken({
      sub: 'rtp_api_demo',
      kind: 'api',
      scopes: ['api:read', 'refund:read']
    });
    if (!minted.ok) {
      print(minted);
      process.exitCode = 1;
      return;
    }
    const verified = verifyAccessToken(minted.accessToken);
    print({ minted, verified });
    return;
  }

  console.error(`Unknown security command: ${cmd}\n\n${usage()}`);
  process.exitCode = 1;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
