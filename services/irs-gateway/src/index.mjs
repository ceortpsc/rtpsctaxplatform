import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  createServiceDescriptor,
  loadRuntimeConfig,
  redactConfig,
  bootstrapEnv
} from '../../../packages/platform-core/src/index.mjs';
import { clientIdentityPlaceholders } from '../../../packages/client-config/src/index.mjs';

// Load gitignored .env before reading IRS credential paths.
bootstrapEnv();

export const irsGatewayDescriptor = createServiceDescriptor({
  name: 'irs-gateway',
  domain: 'irs-oauth',
  responsibilities: [
    'Issue IRS OAuth2 client-credentials tokens via JWT client assertion.',
    'Expose a deterministic /irs/token endpoint for approved TDS scope.',
    'Keep certificates and secrets environment-only.'
  ],
  dependencies: []
});

const DEFAULT_TOKEN_URL = 'https://api.irs.gov/oauth2/v1/token';
const DEFAULT_SCOPE = 'tds';
const DEFAULT_PORT = 8820;

function firstEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim() !== '' && !String(value).startsWith('replace-via-')) {
      return String(value).trim();
    }
  }
  return undefined;
}

export function loadIrsConfig(overrides = {}) {
  return {
    tokenUrl: overrides.tokenUrl ?? firstEnv('IRS_TOKEN_URL') ?? DEFAULT_TOKEN_URL,
    scope: overrides.scope ?? firstEnv('IRS_SCOPE') ?? DEFAULT_SCOPE,
    clientId:
      overrides.clientId ??
      firstEnv('IRS_CLIENT_ID_PRIMARY', 'IRS_CLIENT_ID') ??
      'unset',
    clientSecret:
      overrides.clientSecret ??
      firstEnv('IRS_CLIENT_SECRET_PRIMARY', 'IRS_CLIENT_SECRET') ??
      'unset',
    keyId: overrides.keyId ?? firstEnv('IRS_KEY_ID_PRIMARY', 'IRS_KEY_ID') ?? 'unset',
    privateKeyPath:
      overrides.privateKeyPath ??
      firstEnv('IRS_PRIVATE_KEY_PATH_PRIMARY', 'IRS_PRIVATE_KEY_PATH') ??
      'unset',
    secondaryConfigured: Boolean(
      firstEnv('IRS_CLIENT_ID_SECONDARY') && firstEnv('IRS_PRIVATE_KEY_PATH_SECONDARY')
    )
  };
}

export function redactIrsConfig(config) {
  return {
    tokenUrl: config.tokenUrl,
    scope: config.scope,
    clientId: config.clientId,
    keyId: config.keyId,
    privateKeyPath: config.privateKeyPath === 'unset' ? 'unset' : '[configured]',
    secondaryConfigured: config.secondaryConfigured,
    secretsConfigured:
      config.clientId !== 'unset' &&
      config.keyId !== 'unset' &&
      config.privateKeyPath !== 'unset'
  };
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function loadPrivateKey(keyPath) {
  const resolved = path.resolve(keyPath);
  return fs.readFileSync(resolved, 'utf8');
}

export function createClientAssertion({ clientId, keyId, tokenUrl, privateKeyPem, now = Date.now() }) {
  const header = { alg: 'RS256', typ: 'JWT', kid: keyId };
  const issuedAt = Math.floor(now / 1000);
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: tokenUrl,
    jti: crypto.randomUUID(),
    iat: issuedAt,
    exp: issuedAt + 300
  };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKeyPem);
  return `${signingInput}.${base64Url(signature)}`;
}

export async function requestIrsAccessToken(config, { fetchImpl = fetch } = {}) {
  if (
    config.clientId === 'unset' ||
    config.keyId === 'unset' ||
    config.privateKeyPath === 'unset'
  ) {
    const error = new Error('IRS credentials are not configured');
    error.code = 'credentials_not_configured';
    throw error;
  }

  let privateKeyPem;
  try {
    privateKeyPem = loadPrivateKey(config.privateKeyPath);
  } catch (cause) {
    const error = new Error(`Unable to read IRS private key at ${config.privateKeyPath}`);
    error.code = 'private_key_unreadable';
    error.cause = cause;
    throw error;
  }

  const assertion = createClientAssertion({
    clientId: config.clientId,
    keyId: config.keyId,
    tokenUrl: config.tokenUrl,
    privateKeyPem
  });

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    scope: config.scope,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion
  });

  if (config.clientSecret !== 'unset') {
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetchImpl(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(`IRS token endpoint returned HTTP ${response.status}`);
    error.code = 'irs_token_http_error';
    error.status = response.status;
    error.details = data;
    throw error;
  }

  if (!data.access_token) {
    const error = new Error('IRS token response missing access_token');
    error.code = 'irs_token_malformed';
    error.details = data;
    throw error;
  }

  return data;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

export function start(options = {}) {
  const runtime = loadRuntimeConfig({ servicePort: options.port ?? DEFAULT_PORT });
  const irs = loadIrsConfig(options.irs);
  const payload = {
    service: irsGatewayDescriptor,
    runtime: redactConfig(runtime),
    irs: redactIrsConfig(irs),
    metadata: {
      credentialPlaceholders: clientIdentityPlaceholders.irs,
      tokenPath: '/irs/token',
      assertion: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    }
  };

  const server = http.createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json; charset=utf-8');

    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200);
      response.end(
        JSON.stringify({
          status: 'ok',
          service: irsGatewayDescriptor.name,
          environment: runtime.appEnv
        })
      );
      return;
    }

    if (request.method === 'GET' && request.url === '/metadata') {
      response.writeHead(200);
      response.end(JSON.stringify(payload, null, 2));
      return;
    }

    if (request.method === 'POST' && request.url === '/irs/token') {
      try {
        request.resume();
        const token = await requestIrsAccessToken(irs, { fetchImpl: options.fetchImpl });
        response.writeHead(200);
        response.end(
          JSON.stringify({
            access_token: token.access_token,
            token_type: token.token_type ?? 'Bearer',
            expires_in: token.expires_in ?? null,
            scope: token.scope ?? irs.scope
          })
        );
      } catch (error) {
        const status =
          error.code === 'credentials_not_configured' || error.code === 'private_key_unreadable'
            ? 503
            : error.status && Number.isInteger(error.status)
              ? error.status
              : 500;
        response.writeHead(status);
        response.end(
          JSON.stringify({
            error: error.code ?? 'irs_token_error',
            message: error.message,
            details: error.details ?? undefined
          })
        );
      }
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: 'not_found', service: irsGatewayDescriptor.name }));
  });

  const port = runtime.servicePort || DEFAULT_PORT;
  server.listen(port);
  console.log(`IRS Gateway running on port ${port}`);
  return { server, config: runtime, irs, payload };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
