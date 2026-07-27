import { fileURLToPath } from 'node:url';
import {
  createServiceDescriptor,
  startHttpService,
  packageDir,
  loadRuntimeConfig,
  redactConfig
} from '../../../packages/platform-core/src/index.mjs';
import {
  CAPABILITY_CATALOG,
  REQUIRED_SETUP_STEPS,
  APPLE_ASC_HOME,
  APPLE_ASC_INTEGRATIONS,
  APPLE_DEVELOPER_PORTAL,
  createTokenFromConfig,
  evaluateAppleConnectGate,
  listApps,
  loadAppleConnectConfig,
  redactAppleConnectConfig
} from '../../../packages/apple-connect/src/index.mjs';

export const appleDeveloperConsoleDescriptor = createServiceDescriptor({
  name: 'apple-developer-console',
  domain: 'integrations',
  responsibilities: [
    'Operate the RTPSC Apple Developer Console for App Store Connect automation.',
    'Issue ES256 JWTs for App Store Connect API when secrets are provisioned.',
    'Surface required setup checklist, capabilities, and gated live Apple API calls.'
  ],
  dependencies: ['@rtp/apple-connect', '@rtp/ui-system']
});

const DEFAULT_PORT = 8870;

function sendError(sendJson, response, error) {
  const status =
    error.code === 'credentials_not_configured'
      ? 503
      : error.code === 'private_key_missing'
        ? 500
        : error.code === 'apple_api_error'
          ? error.status || 502
          : 500;
  sendJson(response, status, {
    error: error.code || 'internal_error',
    message: error.message,
    gate: error.gate || undefined,
    apple: error.body || undefined
  });
}

export function start(options = {}) {
  const staticDir = packageDir(import.meta.url, '../public');
  const appleConfig = () => loadAppleConnectConfig(options.appleConfig || {});

  return startHttpService({
    descriptor: appleDeveloperConsoleDescriptor,
    defaultPort: options.port ?? DEFAULT_PORT,
    staticDir,
    extraMetadata: {
      ui: '/',
      portals: {
        developer: APPLE_DEVELOPER_PORTAL,
        appStoreConnect: APPLE_ASC_HOME,
        apiKeys: APPLE_ASC_INTEGRATIONS
      },
      apple: redactAppleConnectConfig(appleConfig())
    },
    routes: {
      'GET /api/apple/status': ({ response, sendJson, config }) => {
        const apple = appleConfig();
        sendJson(response, 200, {
          runtime: redactConfig(config || loadRuntimeConfig()),
          apple: redactAppleConnectConfig(apple),
          gate: evaluateAppleConnectGate(apple),
          capabilities: CAPABILITY_CATALOG,
          setup: REQUIRED_SETUP_STEPS,
          portals: {
            developer: APPLE_DEVELOPER_PORTAL,
            appStoreConnect: APPLE_ASC_HOME,
            apiKeys: APPLE_ASC_INTEGRATIONS,
            certificates: 'https://developer.apple.com/account/resources/certificates/list',
            identifiers: 'https://developer.apple.com/account/resources/identifiers/list',
            devices: 'https://developer.apple.com/account/resources/devices/list',
            profiles: 'https://developer.apple.com/account/resources/profiles/list'
          }
        });
      },
      'POST /api/apple/token': ({ response, sendJson }) => {
        try {
          const apple = appleConfig();
          const gate = evaluateAppleConnectGate(apple);
          if (!gate.safeguards.secretsConfigured) {
            const err = new Error(gate.reasons[0]);
            err.code = 'credentials_not_configured';
            err.gate = gate;
            throw err;
          }
          const jwt = createTokenFromConfig(apple);
          const [, payloadB64] = jwt.split('.');
          const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
          sendJson(response, 200, {
            tokenType: 'Bearer',
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            // Never return the raw JWT in UI logs by default — operator must opt in.
            tokenPreview: `${jwt.slice(0, 16)}…${jwt.slice(-8)}`,
            token: process.env.APPLE_RETURN_FULL_TOKEN === 'true' ? jwt : undefined,
            audience: payload.aud,
            issuerId: payload.iss,
            note:
              process.env.APPLE_RETURN_FULL_TOKEN === 'true'
                ? 'Full token returned because APPLE_RETURN_FULL_TOKEN=true.'
                : 'Full JWT omitted. Set APPLE_RETURN_FULL_TOKEN=true only in secured operator sessions.'
          });
        } catch (error) {
          sendError(sendJson, response, error);
        }
      },
      'GET /api/apple/apps': async ({ response, sendJson }) => {
        try {
          const data = await listApps(appleConfig());
          sendJson(response, 200, { source: 'live', data });
        } catch (error) {
          if (error.code === 'credentials_not_configured') {
            sendJson(response, 200, {
              source: 'stub',
              gate: error.gate || evaluateAppleConnectGate(appleConfig()),
              data: { data: [] },
              message:
                'Live App Store Connect apps are blocked until secrets are provisioned and APPLE_CONNECT_ENABLED=true.'
            });
            return;
          }
          sendError(sendJson, response, error);
        }
      },
      'GET /api/apple/checklist': ({ response, sendJson }) => {
        const gate = evaluateAppleConnectGate(appleConfig());
        sendJson(response, 200, {
          gate,
          steps: REQUIRED_SETUP_STEPS.map((step, index) => ({
            ...step,
            order: index + 1,
            complete:
              step.id === 'provision_secrets' ? gate.safeguards.secretsConfigured && gate.safeguards.enabledFlag : false
          }))
        });
      }
    },
    onReady: ({ config }) => {
      console.log(`Apple Developer Console running on port ${config.servicePort}`);
      console.log(`UI: http://127.0.0.1:${config.servicePort}/`);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
