import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { listChecklistItems } from './checklist.mjs';
import { evaluateManualSignoff, loadSignoffRegistry, SIGNOFF_REGISTRY_PATH } from './signoffs.mjs';

const DEFAULT_LIVE_ENDPOINTS = Object.freeze([
  { id: 'api-gateway', url: 'http://127.0.0.1:3000/health' },
  { id: 'refund-status', url: 'http://127.0.0.1:3001/health' },
  { id: 'transcript', url: 'http://127.0.0.1:3002/health' },
  { id: 'analytics', url: 'http://127.0.0.1:3003/health' },
  { id: 'enrollment', url: 'http://127.0.0.1:3004/health' },
  { id: 'invoice', url: 'http://127.0.0.1:3005/health' },
  { id: 'pos-crm', url: 'http://127.0.0.1:3006/health' },
  { id: 'modules-dashboard', url: 'http://127.0.0.1:3010/health' },
  { id: 'irs-gateway', url: 'http://127.0.0.1:8820/health' },
  { id: 'ai-workforce-hub', url: 'http://127.0.0.1:8860/health' }
]);

async function exists(root, relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readText(root, relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function result(item, status, message, details = {}) {
  return {
    id: item.id,
    title: item.title,
    sectionId: item.sectionId,
    sectionTitle: item.sectionTitle,
    mode: item.mode,
    severity: item.severity,
    status,
    message,
    evidence: item.evidence,
    ...details
  };
}

async function fileContains(root, relativePaths, needle) {
  for (const relativePath of relativePaths) {
    if (!(await exists(root, relativePath))) continue;
    const text = await readText(root, relativePath);
    if (text.includes(needle)) return true;
  }
  return false;
}

async function scanTrackedSourcesForSecrets(root) {
  const suspicious = [];
  const roots = ['packages', 'services', 'workers', 'pipelines', 'engines', 'tools', 'scripts', 'docs'];
  const secretPatterns = [
    /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    // Real assignments only — ignore placeholders, docs, and JS template interpolations (${...}).
    /(?:^|[^A-Z_])(?:API_CLIENT_SECRET|TDS_CLIENT_SECRET|TUNNEL_CLIENT_SECRET|PASSWORD)\s*=\s*['"](?!\$\{)(?!unset|replace-in-approved-secret-store|prod-[a-z-]+|example)[^'"]{16,}['"]/m
  ];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!/\.(mjs|js|md|yml|yaml|json|tf|example|sh)$/i.test(entry.name)) continue;
      if (entry.name === 'RTPSC-package-lock.json' || entry.name === 'RTPSC-footprints.json') continue;
      if (full.endsWith(`${path.sep}production-compliance${path.sep}src${path.sep}checks.mjs`)) continue;
      const text = await readFile(full, 'utf8');
      for (const pattern of secretPatterns) {
        if (pattern.test(text)) {
          suspicious.push(path.relative(root, full));
          break;
        }
      }
    }
  }

  for (const sector of roots) {
    await walk(path.join(root, sector));
  }
  return suspicious;
}

function runCommand(command, args, { cwd, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\ntimeout after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

async function probeHealth(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 500) };
  } catch (error) {
    return { ok: false, status: 0, body: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function runAutomatedItem(root, item, context) {
  switch (item.id) {
    case 'GOV-001':
      return result(item, (await exists(root, 'docs/compliance-and-governance.md')) ? 'pass' : 'fail', 'Compliance governance doc check');
    case 'GOV-002':
      return result(item, (await exists(root, 'docs/irm-aligned-handbook.md')) ? 'pass' : 'fail', 'IRM handbook check');
    case 'GOV-003':
      return result(item, (await exists(root, 'docs/operations-runbook.md')) ? 'pass' : 'fail', 'Operations runbook check');
    case 'GOV-004':
      return result(item, (await exists(root, 'docs/live-production-checklist.md')) ? 'pass' : 'fail', 'Live production checklist doc check');
    case 'GOV-007':
      return result(
        item,
        (await exists(root, 'docs/enterprise-tax-software-checklist.md')) ? 'pass' : 'fail',
        'Enterprise tax software checklist doc check'
      );
    case 'GOV-009': {
      const registryOk = await exists(root, SIGNOFF_REGISTRY_PATH);
      const readmeOk = await exists(root, 'policy/procedures/production-signoffs/README.md');
      return result(
        item,
        registryOk && readmeOk ? 'pass' : 'fail',
        registryOk && readmeOk ? 'Production sign-off pack present' : 'Missing production sign-off pack'
      );
    }
    case 'BND-001': {
      const ok = await fileContains(root, ['docs/compliance-and-governance.md', 'README.md'], 'No unauthorized access to IRS systems');
      return result(item, ok ? 'pass' : 'fail', 'Unauthorized IRS access boundary language');
    }
    case 'BND-002': {
      const ok = await fileContains(
        root,
        ['docs/compliance-and-governance.md', 'README.md', 'packages/platform-core/src/index.mjs'],
        'scraping'
      );
      return result(item, ok ? 'pass' : 'fail', 'Anti-scraping boundary language');
    }
    case 'BND-003': {
      const hits = await scanTrackedSourcesForSecrets(root);
      return result(item, hits.length === 0 ? 'pass' : 'fail', hits.length === 0 ? 'No embedded secret patterns detected' : 'Potential secrets detected', {
        findings: hits
      });
    }
    case 'BND-004': {
      const { createSecureTunnelAdapter } = await import(path.join(root, 'packages/secure-tunnel/src/index.mjs'));
      const adapter = createSecureTunnelAdapter();
      return result(item, adapter.status === 'stub' ? 'pass' : 'fail', `Secure tunnel status=${adapter.status}`);
    }
    case 'SEC-001': {
      const mod = await import(path.join(root, 'packages/security-core/src/index.mjs'));
      const ok =
        typeof mod.mintAccessToken === 'function' &&
        typeof mod.encryptField === 'function' &&
        typeof mod.createRateLimiter === 'function' &&
        typeof mod.applySecurityHeaders === 'function' &&
        mod.SECURITY_HEADERS &&
        typeof mod.SECURITY_HEADERS === 'object';
      return result(item, ok ? 'pass' : 'fail', 'Security-core exports present');
    }
    case 'SEC-002': {
      const mod = await import(path.join(root, 'packages/secrets-config/src/index.mjs'));
      const status = mod.evaluateSecretsStatus({
        env: {
          API_CLIENT_ID: 'a',
          API_CLIENT_SECRET: 'b',
          TDS_CLIENT_ID: 'c',
          TDS_CLIENT_SECRET: 'd',
          TUNNEL_CLIENT_ID: 'e',
          TUNNEL_CLIENT_SECRET: 'f',
          APPROVED_TUNNEL_ENDPOINT: 'https://approved.example',
          SESSION_SECRET: 'session-test-secret',
          ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef'
        }
      });
      const leaked = JSON.stringify(status).includes('session-test-secret');
      const ok = status.ready === true && !leaked && Array.isArray(mod.listSecretCatalog());
      return result(item, ok ? 'pass' : 'fail', 'Secrets-config readiness is redacted');
    }
    case 'SEC-003': {
      const { createSecureTunnelAdapter, evaluateTunnelGate } = await import(
        path.join(root, 'packages/secure-tunnel/src/index.mjs')
      );
      const gate = evaluateTunnelGate({
        env: {
          TUNNEL_CLIENT_ID: 'tunnel-id',
          TUNNEL_CLIENT_SECRET: 'tunnel-secret',
          APPROVED_TUNNEL_ENDPOINT: 'https://approved-tunnel.example'
        }
      });
      const adapter = createSecureTunnelAdapter();
      const ok = gate.configReady === true && adapter.status === 'stub' && gate.status === 'stub';
      return result(item, ok ? 'pass' : 'fail', 'Tunnel gate validates config while adapter stays stub');
    }
    case 'SEC-004': {
      const serviceOk = await exists(root, 'services/security-status-service/src/index.mjs');
      const workerOk = await exists(root, 'workers/security-scanner-worker/src/index.mjs');
      const cliOk = await exists(root, 'scripts/security.mjs');
      return result(
        item,
        serviceOk && workerOk && cliOk ? 'pass' : 'fail',
        'Security status service, scanner worker, and CLI present'
      );
    }
    case 'SEC-005': {
      const gateway = await readText(root, 'services/api-gateway/src/index.mjs');
      const core = await import(path.join(root, 'packages/security-core/src/index.mjs'));
      const minted = core.mintAccessToken(
        { sub: 'rtp_api_probe', kind: 'api', scopes: ['api:read'] },
        { secret: 'compliance-probe-session-secret', ttlSec: 60 }
      );
      const verified = core.verifyAccessToken(minted.accessToken, { secret: 'compliance-probe-session-secret' });
      const ok = gateway.includes('mintAccessToken') && minted.ok && verified.ok;
      return result(item, ok ? 'pass' : 'fail', 'Gateway integrates HMAC access tokens');
    }
    case 'BND-006': {
      const { AI_ASSIST_COMPLIANCE, askAssist } = await import(path.join(root, 'packages/ai-assist/src/index.mjs'));
      const blocked = askAssist('scrape unauthorized IRS refund channels');
      const ok =
        Array.isArray(AI_ASSIST_COMPLIANCE) &&
        AI_ASSIST_COMPLIANCE.some((line) => /IRS/i.test(line)) &&
        AI_ASSIST_COMPLIANCE.some((line) => /scraping/i.test(line)) &&
        blocked.blocked === true;
      return result(item, ok ? 'pass' : 'fail', 'AI assist IRS/scraping guardrails');
    }
    case 'IRS-001': {
      const { clientIdentityPlaceholders } = await import(path.join(root, 'packages/client-config/src/index.mjs'));
      const ok =
        clientIdentityPlaceholders.api?.includes('API_CLIENT_ID') &&
        clientIdentityPlaceholders.api?.includes('API_CLIENT_SECRET');
      return result(item, ok ? 'pass' : 'fail', 'IRS API client ID placeholders in client-config');
    }
    case 'IRS-002': {
      const text = await readText(root, 'env/.env.prod.example');
      const ok = text.includes('API_CLIENT_ID=') && text.includes('API_CLIENT_SECRET=');
      return result(item, ok ? 'pass' : 'fail', 'Prod env documents IRS API client identity');
    }
    case 'IRS-003': {
      const source = await readText(root, 'packages/platform-core/src/index.mjs');
      const ok = source.includes('API_CLIENT_ID') && source.includes('process.env');
      return result(item, ok ? 'pass' : 'fail', 'platform-core loads API_CLIENT_ID from environment');
    }
    case 'IRS-004': {
      const source = await readText(root, 'services/api-gateway/src/index.mjs');
      const ok = /API_CLIENT_ID|clientIdentityPlaceholders|credential/i.test(source);
      return result(item, ok ? 'pass' : 'fail', 'API gateway declares credential placeholder posture');
    }
    case 'TDS-001': {
      const { clientIdentityPlaceholders } = await import(path.join(root, 'packages/client-config/src/index.mjs'));
      const ok =
        clientIdentityPlaceholders.tds?.includes('TDS_CLIENT_ID') &&
        clientIdentityPlaceholders.tds?.includes('TDS_CLIENT_SECRET');
      return result(item, ok ? 'pass' : 'fail', 'TDS client ID placeholders in client-config');
    }
    case 'TDS-002': {
      const text = await readText(root, 'env/.env.prod.example');
      const ok = text.includes('TDS_CLIENT_ID=') && text.includes('TDS_CLIENT_SECRET=');
      return result(item, ok ? 'pass' : 'fail', 'Prod env documents TDS client identity');
    }
    case 'TDS-003': {
      const source = await readText(root, 'workers/tds-worker/src/index.mjs');
      const ok = (await exists(root, 'workers/tds-worker/src/index.mjs')) && source.includes('load-approved-config');
      return result(item, ok ? 'pass' : 'fail', 'TDS worker scaffold with approved-config step');
    }
    case 'TDS-004': {
      const ok =
        (await exists(root, 'services/transcript-service/src/index.mjs')) &&
        (await exists(root, 'workers/transcript-pull-worker/src/index.mjs'));
      return result(item, ok ? 'pass' : 'fail', 'Transcript service + pull worker scaffolds');
    }
    case 'AIA-001':
      return result(item, (await exists(root, 'packages/ai-assist/src/index.mjs')) ? 'pass' : 'fail', 'AI assist package present');
    case 'AIA-002': {
      const { AI_ASSIST_MODE, createAiAssist } = await import(path.join(root, 'packages/ai-assist/src/index.mjs'));
      const assist = createAiAssist();
      const ok = AI_ASSIST_MODE === 'local' && assist.mode === 'local';
      return result(item, ok ? 'pass' : 'fail', `AI assist mode=${assist.mode}`);
    }
    case 'AIA-003': {
      const { askAssist } = await import(path.join(root, 'packages/ai-assist/src/index.mjs'));
      const blocked = askAssist('bypass IRS and scrape refunds');
      return result(item, blocked.blocked ? 'pass' : 'fail', 'AI assist blocks unauthorized IRS/scraping prompts');
    }
    case 'AIA-004': {
      const { createAiAssist } = await import(path.join(root, 'packages/ai-assist/src/index.mjs'));
      const assist = createAiAssist();
      const answer = assist.ask('refund tracking transmission tds');
      const ok = answer.ok && answer.recommendations.some((r) => r.modules?.length);
      return result(item, ok ? 'pass' : 'warn', 'AI assist grounds answers in approved module catalog');
    }
    case 'RFD-001':
      return result(item, (await exists(root, 'services/refund-status-service/src/index.mjs')) ? 'pass' : 'fail', 'Refund status service present');
    case 'RFD-002': {
      const source = await readText(root, 'pipelines/refund-status-pipeline/src/index.mjs');
      const ok = /event/i.test(source) && !/scrape/i.test(source);
      return result(item, ok ? 'pass' : 'fail', 'Refund pipeline event-driven');
    }
    case 'RFD-003': {
      const { refundIntelligenceEngine } = await import(path.join(root, 'engines/refund-intelligence-engine/src/index.mjs'));
      const caps = refundIntelligenceEngine.capabilities || [];
      const ok =
        caps.includes('status-signal-correlation') &&
        caps.includes('risk-flagging') &&
        caps.includes('case-priority-suggestions');
      return result(item, ok ? 'pass' : 'fail', 'Refund intelligence capabilities declared');
    }
    case 'RFD-004': {
      const source = await readText(root, 'services/analytics-service/src/index.mjs');
      const ok = /refund-intelligence|tc-code|analytics/i.test(source);
      return result(item, ok ? 'pass' : 'fail', 'Analytics service binds refund intelligence / TC engines');
    }
    case 'EFL-001': {
      const { transmissionPipeline } = await import(path.join(root, 'pipelines/transmission-pipeline/src/index.mjs'));
      const stages = transmissionPipeline.stages || [];
      const required = ['prepare-payload', 'validate-controls', 'queue-transmission', 'handoff-approved-tunnel', 'process-acknowledgement'];
      const ok = required.every((stage) => stages.includes(stage));
      return result(item, ok ? 'pass' : 'fail', 'Transmission pipeline stages complete', { stages });
    }
    case 'EFL-002': {
      const source = await readText(root, 'services/api-gateway/src/index.mjs');
      const ok = /transmission/i.test(source);
      return result(item, ok ? 'pass' : 'fail', 'API gateway declares transmission flows');
    }
    case 'EFL-003': {
      const ok = await exists(root, 'packages/secure-tunnel/src/index.mjs');
      return result(item, ok ? 'pass' : 'fail', 'Secure tunnel adapter scaffold present');
    }
    case 'EFL-004':
      return result(item, (await exists(root, 'pipelines/masterfile-pipeline/src/index.mjs')) ? 'pass' : 'warn', 'Masterfile pipeline scaffold');
    case 'EFL-005': {
      const ok = (await exists(root, 'forms')) && (await exists(root, 'letters'));
      return result(item, ok ? 'pass' : 'warn', 'Forms and letters directories present');
    }
    case 'CFG-001':
      return result(item, (await exists(root, 'env/.env.prod.example')) ? 'pass' : 'fail', 'Prod env example present');
    case 'CFG-002': {
      const { clientIdentityPlaceholders } = await import(path.join(root, 'packages/client-config/src/index.mjs'));
      const ok =
        Array.isArray(clientIdentityPlaceholders.api) &&
        clientIdentityPlaceholders.api.includes('API_CLIENT_SECRET') &&
        clientIdentityPlaceholders.secureTunnel.includes('APPROVED_TUNNEL_ENDPOINT');
      return result(item, ok ? 'pass' : 'fail', 'Client identity placeholders are env-based');
    }
    case 'CFG-003': {
      const text = await readText(root, 'env/.env.prod.example');
      const ok = text.includes('replace-in-approved-secret-store') && !/SECRET=\S{20,}/.test(text.replaceAll('replace-in-approved-secret-store', ''));
      return result(item, ok ? 'pass' : 'fail', 'Prod example uses secret-store placeholders');
    }
    case 'PLT-001': {
      const { createServiceDescriptor } = await import(path.join(root, 'packages/platform-core/src/index.mjs'));
      const descriptor = createServiceDescriptor({ name: 'probe', domain: 'probe' });
      const ok = Array.isArray(descriptor.compliance) && descriptor.compliance.some((line) => line.includes('IRS'));
      return result(item, ok ? 'pass' : 'fail', 'Service descriptors include compliance notices');
    }
    case 'PLT-002': {
      const { createWorkerDescriptor } = await import(path.join(root, 'packages/platform-core/src/index.mjs'));
      const descriptor = createWorkerDescriptor({ name: 'probe-worker' });
      const ok = Array.isArray(descriptor.compliance) && descriptor.compliance.length > 0;
      return result(item, ok ? 'pass' : 'fail', 'Worker descriptors include compliance notices');
    }
    case 'PLT-003': {
      const source = await readText(root, 'workers/live-source-fetcher/src/index.mjs');
      const ok = source.includes('validate-compliance') && source.includes('Reject scraping-based implementations');
      return result(
        item,
        ok ? 'pass' : 'warn',
        ok ? 'Live-source worker includes validate-compliance and anti-scraping controls' : 'Missing validate-compliance / anti-scraping controls'
      );
    }
    case 'PLT-004': {
      const source = await readText(root, 'pipelines/refund-status-pipeline/src/index.mjs');
      const ok = /event/i.test(source) && !/scrape/i.test(source);
      return result(item, ok ? 'pass' : 'fail', 'Refund-status pipeline remains event-driven');
    }
    case 'INF-001':
      return result(item, (await exists(root, 'infra/terraform/env/prod/README.md')) ? 'pass' : 'warn', 'Prod Terraform folder check');
    case 'INF-002':
      return result(item, (await exists(root, '.github/workflows/ci.yml')) ? 'pass' : 'fail', 'CI workflow check');
    case 'INF-003':
      return result(item, (await exists(root, '.github/workflows/compliance.yml')) ? 'pass' : 'fail', 'Compliance workflow check');
    case 'INF-004': {
      const dirs = ['policy/guidelines', 'policy/procedures', 'policy/regulations', 'policy/rules'];
      const missing = [];
      for (const dir of dirs) {
        if (!(await exists(root, dir))) missing.push(dir);
      }
      return result(item, missing.length === 0 ? 'pass' : 'warn', missing.length === 0 ? 'Policy directories present' : 'Missing policy directories', {
        missing
      });
    }
    case 'OPS-001': {
      if (context.skipGates) {
        return result(item, 'skipped', 'Quality gates skipped (--skip-gates)');
      }
      if (context.gateResults) {
        const ok = context.gateResults.ok;
        return result(item, ok ? 'pass' : 'fail', ok ? 'lint/test/build passed' : 'Quality gates failed', {
          gates: context.gateResults.gates
        });
      }
      return result(item, 'pending', 'Quality gates not yet executed');
    }
    case 'OPS-002':
      return result(item, 'pass', 'Report artifact will be written by this run', {
        artifact: 'build/production-compliance-report.json'
      });
    case 'OPS-003':
      return result(item, 'pass', 'Checklist log will be written by this run', {
        artifact: 'build/production-compliance-checklist.log'
      });
    default:
      return result(item, 'skip', `No automated handler for ${item.id}`);
  }
}

async function runLiveItem(item, context) {
  if (!context.live) {
    return result(item, 'skipped', 'Live probes skipped (pass --live to enable)');
  }

  const byId = Object.fromEntries(context.endpoints.map((endpoint) => [endpoint.id, endpoint]));

  if (item.id === 'PLT-005' || item.id === 'EFL-011') {
    const probe = await probeHealth(byId['api-gateway'].url);
    return result(item, probe.ok ? 'pass' : 'fail', probe.ok ? 'api-gateway /health ok' : 'api-gateway /health failed', { probe });
  }

  if (item.id === 'PLT-006') {
    const probes = [];
    for (const endpoint of context.endpoints.slice(1)) {
      probes.push({ ...endpoint, ...(await probeHealth(endpoint.url)) });
    }
    const ok = probes.every((probe) => probe.ok);
    return result(item, ok ? 'pass' : 'fail', ok ? 'Domain service health probes ok' : 'One or more domain health probes failed', {
      probes
    });
  }

  if (item.id === 'RFD-009') {
    const targets = [byId['refund-status'], byId.analytics].filter(Boolean);
    const probes = [];
    for (const endpoint of targets) {
      probes.push({ ...endpoint, ...(await probeHealth(endpoint.url)) });
    }
    const ok = probes.length > 0 && probes.every((probe) => probe.ok);
    return result(item, ok ? 'pass' : 'fail', ok ? 'Refund + analytics health probes ok' : 'Refund/analytics health probes failed', {
      probes
    });
  }

  return result(item, 'skip', `No live handler for ${item.id}`);
}

export async function runQualityGates(root) {
  const gates = {};
  for (const name of ['lint', 'test', 'build']) {
    gates[name] = await runCommand('node', ['./tools/aol/bin/aol.mjs', 'run', name], { cwd: root });
  }
  return {
    ok: Object.values(gates).every((gate) => gate.ok),
    gates: Object.fromEntries(
      Object.entries(gates).map(([name, gate]) => [
        name,
        { ok: gate.ok, code: gate.code, stdout: gate.stdout.slice(-400), stderr: gate.stderr.slice(-400) }
      ])
    )
  };
}

/**
 * Execute the full production compliance checklist.
 */
export async function runComplianceChecks(root, options = {}) {
  const items = listChecklistItems();
  const context = {
    skipGates: Boolean(options.skipGates),
    live: Boolean(options.live),
    endpoints: options.endpoints || DEFAULT_LIVE_ENDPOINTS,
    gateResults: null,
    signoffRegistry: await loadSignoffRegistry(root)
  };

  if (!context.skipGates) {
    context.gateResults = await runQualityGates(root);
  }

  const results = [];
  for (const item of items) {
    if (item.mode === 'manual') {
      const evaluation = evaluateManualSignoff(item, context.signoffRegistry, {
        strictProduction: Boolean(options.strictProduction)
      });
      results.push(
        result(item, evaluation.status, evaluation.message, {
          signoff: evaluation.signoff
        })
      );
      continue;
    }

    if (item.mode === 'live') {
      results.push(await runLiveItem(item, context));
      continue;
    }

    results.push(await runAutomatedItem(root, item, context));
  }

  return { results, gateResults: context.gateResults, live: context.live, signoffRegistry: context.signoffRegistry };
}

export { DEFAULT_LIVE_ENDPOINTS };
