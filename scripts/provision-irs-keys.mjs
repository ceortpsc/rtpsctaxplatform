#!/usr/bin/env node
/**
 * Provision IRS JWT signing keys (RS256) and optionally promote APP_ENV to production.
 *
 * Keys are written under gitignored certs/. Never prints private key PEM.
 *
 * Usage:
 *   ./rtpsc provision irs-keys [--json] [--force] [--production] [--enable-transmission]
 */

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapEnv, loadRuntimeConfig, evaluateEnvironmentProtection, redactConfig } from '../packages/platform-core/src/index.mjs';
import { loadIrsConfig, redactIrsConfig } from '../services/irs-gateway/src/index.mjs';
import { createSecureTunnelAdapter } from '../packages/secure-tunnel/src/index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PRIMARY_KEY = 'certs/irs_tds_private.key';
const PRIMARY_PUB = 'certs/irs_tds_public.pem';
const SECONDARY_KEY = 'certs/irs_tds_private_secondary.key';
const SECONDARY_PUB = 'certs/irs_tds_public_secondary.pem';

function isPlaceholder(value) {
  const s = String(value ?? '').trim();
  if (!s || s === 'unset') return true;
  return (
    s.startsWith('replace-via-') ||
    s.startsWith('replace-in-') ||
    s.startsWith('local-') ||
    s === 'your-domain.example'
  );
}

function fingerprintPem(pem) {
  const b64 = String(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const der = Buffer.from(b64, 'base64');
  return createHash('sha256').update(der).digest('hex');
}

function generateKeyPair(privateRel, publicRel, { force = false } = {}) {
  const privatePath = path.join(repoRoot, privateRel);
  const publicPath = path.join(repoRoot, publicRel);
  mkdirSync(path.dirname(privatePath), { recursive: true });
  const existed = existsSync(privatePath);
  if (existed && !force) {
    const pub = existsSync(publicPath)
      ? readFileSync(publicPath, 'utf8')
      : (() => {
          execFileSync('openssl', ['rsa', '-in', privatePath, '-pubout', '-out', publicPath], { stdio: 'pipe' });
          return readFileSync(publicPath, 'utf8');
        })();
    chmodSync(privatePath, 0o600);
    return {
      privatePath: privateRel,
      publicPath: publicRel,
      created: false,
      fingerprintSha256: fingerprintPem(pub)
    };
  }
  execFileSync('openssl', ['genrsa', '-out', privatePath, '2048'], { stdio: 'pipe' });
  execFileSync('openssl', ['rsa', '-in', privatePath, '-pubout', '-out', publicPath], { stdio: 'pipe' });
  chmodSync(privatePath, 0o600);
  const pub = readFileSync(publicPath, 'utf8');
  return {
    privatePath: privateRel,
    publicPath: publicRel,
    created: true,
    fingerprintSha256: fingerprintPem(pub)
  };
}

function upsertEnvFile(filePath, updates) {
  let text = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  if (!text.endsWith('\n') && text.length) text += '\n';
  const keys = Object.keys(updates);
  for (const key of keys) {
    const value = updates[key];
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, line);
    else text += `${line}\n`;
  }
  writeFileSync(filePath, text, 'utf8');
  return keys;
}

async function main(argv = process.argv.slice(2)) {
  bootstrapEnv({ cwd: repoRoot, override: false });
  const asJson = argv.includes('--json');
  const force = argv.includes('--force');
  const production = argv.includes('--production');
  const enableTransmission = argv.includes('--enable-transmission');

  const primary = generateKeyPair(PRIMARY_KEY, PRIMARY_PUB, { force });
  const secondary = generateKeyPair(SECONDARY_KEY, SECONDARY_PUB, { force });

  const existing = loadIrsConfig();
  const primaryClientId = isPlaceholder(existing.clientId)
    ? `rtp_irs_primary_${randomBytes(8).toString('hex')}`
    : existing.clientId;
  const secondaryClientId = isPlaceholder(process.env.IRS_CLIENT_ID_SECONDARY)
    ? `rtp_irs_secondary_${randomBytes(8).toString('hex')}`
    : String(process.env.IRS_CLIENT_ID_SECONDARY).trim();
  const primaryKeyId = isPlaceholder(existing.keyId) ? 'rtpsc-irs-kid-primary-1' : existing.keyId;
  const secondaryKeyId = isPlaceholder(process.env.IRS_KEY_ID_SECONDARY)
    ? 'rtpsc-irs-kid-secondary-1'
    : String(process.env.IRS_KEY_ID_SECONDARY).trim();

  const envUpdates = {
    IRS_PRIVATE_KEY_PATH: PRIMARY_KEY,
    IRS_PRIVATE_KEY_PATH_PRIMARY: PRIMARY_KEY,
    IRS_PRIVATE_KEY_PATH_SECONDARY: SECONDARY_KEY,
    IRS_KEY_ID: primaryKeyId,
    IRS_KEY_ID_PRIMARY: primaryKeyId,
    IRS_KEY_ID_SECONDARY: secondaryKeyId,
    IRS_CLIENT_ID: primaryClientId,
    IRS_CLIENT_ID_PRIMARY: primaryClientId,
    IRS_CLIENT_ID_SECONDARY: secondaryClientId,
    IRS_TOKEN_URL: process.env.IRS_TOKEN_URL || 'https://api.irs.gov/oauth2/v1/token',
    IRS_SCOPE: process.env.IRS_SCOPE || 'tds'
  };

  if (production) {
    envUpdates.APP_ENV = 'production';
    envUpdates.NODE_ENV = 'production';
  }
  if (enableTransmission) {
    envUpdates.EFILE_TRANSMISSION_ENABLED = 'true';
  }

  const envPath = path.join(repoRoot, '.env');
  const updatedKeys = upsertEnvFile(envPath, envUpdates);

  // Reload with override so doctor reflects new values in this process.
  bootstrapEnv({ cwd: repoRoot, override: true });
  for (const [k, v] of Object.entries(envUpdates)) process.env[k] = v;

  const runtime = loadRuntimeConfig();
  const irs = loadIrsConfig();
  const protection = evaluateEnvironmentProtection(runtime);
  const tunnel = createSecureTunnelAdapter().describe();

  const report = {
    ok: true,
    provisionedAt: new Date().toISOString(),
    keys: {
      primary: {
        privatePath: primary.privatePath,
        publicPath: primary.publicPath,
        created: primary.created,
        fingerprintSha256: primary.fingerprintSha256,
        keyId: primaryKeyId,
        clientIdHint: `${primaryClientId.slice(0, 12)}…`
      },
      secondary: {
        privatePath: secondary.privatePath,
        publicPath: secondary.publicPath,
        created: secondary.created,
        fingerprintSha256: secondary.fingerprintSha256,
        keyId: secondaryKeyId,
        clientIdHint: `${secondaryClientId.slice(0, 12)}…`
      }
    },
    envFile: envPath,
    updatedKeys,
    productionPromoted: production === true,
    transmissionFlagEnabled: enableTransmission === true,
    runtime: redactConfig(runtime),
    irs: redactIrsConfig(irs),
    protection,
    tunnelStatus: tunnel.status,
    notice: [
      'Private keys are gitignored under certs/ — never commit them.',
      'Provisioned IRS_CLIENT_ID values are local operational ids until replaced with IRS-registered client ids.',
      'Live token success still requires IRS-registered client + matching public key on file with IRS.',
      'Transmission remains gated by evaluateEnvironmentProtection / secure-tunnel ready status.'
    ]
  };

  mkdirSync(path.join(repoRoot, 'build'), { recursive: true });
  writeFileSync(
    path.join(repoRoot, 'build', 'irs-key-provision-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`IRS signing keys provisioned → ${PRIMARY_KEY} (+ secondary)`);
    console.log(`APP_ENV=${runtime.appEnv} · transmissionAllowed=${protection.transmissionAllowed} · tunnel=${tunnel.status}`);
    console.log(`Updated .env keys: ${updatedKeys.join(', ')}`);
    console.log('Report: build/irs-key-provision-report.json');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main };
