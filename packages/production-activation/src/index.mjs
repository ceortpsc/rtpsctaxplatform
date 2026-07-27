import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';

/** Honest activation labels from rossco-production-activation.md */
export const ACTIVATION_STATES = Object.freeze([
  'PROPOSED',
  'GENERATED',
  'LOCALLY_VALIDATED',
  'AUTOMATICALLY_TESTED',
  'OWNER_APPROVED',
  'STAGING_VERIFIED',
  'PRODUCTION_VERIFIED',
  'FILED',
  'REGISTERED',
  'BLOCKED'
]);

export const DEFAULT_ACTIVATION_GATES = Object.freeze([
  { id: 'lint', command: 'node', args: ['scripts/lint.mjs'], required: true },
  { id: 'test', command: 'node', args: ['--test'], required: true },
  { id: 'build', command: 'bash', args: ['scripts/build.sh'], required: true },
  {
    id: 'rossco-validate',
    command: 'node',
    args: ['tools/rossco/bin/rossco.mjs', 'validate', '--json'],
    required: true
  },
  {
    id: 'ross-infinite-doctor',
    command: 'node',
    args: ['tools/ross-infinite/src/cli.mjs', 'doctor', 'tools/ross-infinite', '--json'],
    required: true
  },
  {
    id: 'seo-deploy',
    command: 'node',
    args: ['tools/ross-infinite/src/cli.mjs', 'seo', 'deploy', 'config/seo/ross.co.ownership.json', '--json'],
    required: true
  },
  {
    id: 'compliance-scaffold',
    command: 'node',
    args: ['packages/production-compliance/bin/prodcheck.mjs', 'run', '--skip-gates', '--json'],
    required: true
  },
  {
    id: 'deploy-platform-smoke',
    command: 'node',
    args: ['scripts/deploy-platform.mjs', '--smoke', '--skip-gates'],
    required: true
  }
]);

export function stateIndex(state) {
  return ACTIVATION_STATES.indexOf(state);
}

export function canClaimProductionVerified(evidence = {}) {
  return Boolean(
    evidence.cloudFormationComplete &&
      evidence.tlsIssued &&
      evidence.dnsResolved &&
      evidence.releaseAttestation &&
      evidence.ownerApproved
  );
}

/**
 * Run a single gate command from repo root.
 */
export function runGate(root, gate, { env = process.env, timeoutMs = 900000 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(gate.command, gate.args, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            child.kill('SIGKILL');
          }, timeoutMs)
        : null;
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({
        id: gate.id,
        required: gate.required !== false,
        ok: code === 0,
        code: code ?? 1,
        signal,
        durationMs: Date.now() - started,
        stdoutTail: stdout.slice(-2000),
        stderrTail: stderr.slice(-2000)
      });
    });
  });
}

export async function runActivationGates(root, {
  gates = DEFAULT_ACTIVATION_GATES,
  skipGates = false,
  only = null,
  env = process.env
} = {}) {
  if (skipGates) {
    return {
      ok: true,
      skipped: true,
      results: gates.map((g) => ({ id: g.id, ok: true, skipped: true, required: g.required !== false }))
    };
  }
  const selected = only?.length ? gates.filter((g) => only.includes(g.id)) : gates;
  const results = [];
  for (const gate of selected) {
    const result = await runGate(root, gate, { env });
    results.push(result);
    if (!result.ok && result.required) {
      return { ok: false, skipped: false, results };
    }
  }
  return { ok: results.every((r) => r.ok || !r.required), skipped: false, results };
}

export function evaluateActivation({ gateReport, evidence = {}, forceBlock = false } = {}) {
  if (forceBlock) {
    return {
      state: 'BLOCKED',
      automated: false,
      productionVerified: false,
      reasons: ['forced block']
    };
  }

  const failedRequired = (gateReport?.results || []).filter((r) => r.required && !r.ok && !r.skipped);
  if (failedRequired.length) {
    return {
      state: 'BLOCKED',
      automated: true,
      productionVerified: false,
      reasons: failedRequired.map((r) => `gate:${r.id}`)
    };
  }

  if (canClaimProductionVerified(evidence)) {
    return {
      state: 'PRODUCTION_VERIFIED',
      automated: true,
      productionVerified: true,
      reasons: ['all production evidence present']
    };
  }

  // Fully automated local path — never claim live production without cloud/DNS/TLS evidence.
  const state = gateReport?.skipped
    ? 'GENERATED'
    : evidence.stagingVerified
      ? 'STAGING_VERIFIED'
      : 'AUTOMATICALLY_TESTED';

  return {
    state,
    automated: true,
    productionVerified: false,
    reasons: [
      'automated local/staging activation complete',
      'live PRODUCTION_VERIFIED requires CloudFormation, TLS, DNS, attestation, and owner approval evidence'
    ],
    gaps: [
      !evidence.cloudFormationComplete && 'cloudFormationComplete',
      !evidence.tlsIssued && 'tlsIssued',
      !evidence.dnsResolved && 'dnsResolved',
      !evidence.releaseAttestation && 'releaseAttestation',
      !evidence.ownerApproved && 'ownerApproved'
    ].filter(Boolean)
  };
}

export async function writeActivationReceipt(root, payload) {
  const dir = path.join(root, 'build', 'production-activation');
  await mkdir(dir, { recursive: true });
  const stamped = {
    product: 'RTPSC + ROSS.CO Infinite',
    kind: 'production-activation',
    generatedAt: new Date().toISOString(),
    ...payload
  };
  const body = `${JSON.stringify(stamped, null, 2)}\n`;
  const digest = createHash('sha256').update(body).digest('hex');
  const fileName = `activation-${Date.now()}-${digest.slice(0, 12)}.json`;
  const outPath = path.join(dir, fileName);
  await writeFile(outPath, body, 'utf8');
  await writeFile(`${outPath}.sha256`, `${digest}  ${fileName}\n`, 'utf8');
  await writeFile(path.join(dir, 'LATEST.json'), body, 'utf8');
  await writeFile(path.join(root, 'build', 'production-activation-status.json'), body, 'utf8');
  return {
    outPath: path.relative(root, outPath),
    latestPath: path.relative(root, path.join(dir, 'LATEST.json')),
    statusPath: 'build/production-activation-status.json',
    digest
  };
}

export async function loadLatestActivation(root) {
  try {
    const raw = await readFile(path.join(root, 'build', 'production-activation', 'LATEST.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Fully automated activation entrypoint used by workflows and CLI.
 */
export async function activateProduction(root, input = {}) {
  const startedAt = new Date().toISOString();
  const mode = input.mode || 'automated';
  const evidence = {
    cloudFormationComplete: Boolean(input.evidence?.cloudFormationComplete),
    tlsIssued: Boolean(input.evidence?.tlsIssued),
    dnsResolved: Boolean(input.evidence?.dnsResolved),
    releaseAttestation: Boolean(input.evidence?.releaseAttestation),
    ownerApproved: Boolean(input.evidence?.ownerApproved),
    // Only claim staging when the caller (or a passed gate) asserts it — never by default.
    stagingVerified: Boolean(input.evidence?.stagingVerified)
  };

  const gateReport = await runActivationGates(root, {
    skipGates: Boolean(input.skipGates),
    only: input.onlyGates || null,
    env: process.env
  });

  // Promote stagingVerified when the deploy smoke gate actually passed (not skipped).
  const deploySmoke = (gateReport.results || []).find((r) => r.id === 'deploy-platform-smoke');
  if (deploySmoke?.ok && !deploySmoke.skipped) {
    evidence.stagingVerified = true;
  }

  const evaluation = evaluateActivation({
    gateReport,
    evidence,
    forceBlock: Boolean(input.forceBlock)
  });

  const receipt = await writeActivationReceipt(root, {
    mode,
    trigger: input.trigger || 'manual',
    requestedBy: input.requestedBy || 'automation',
    startedAt,
    completedAt: new Date().toISOString(),
    ok: evaluation.state !== 'BLOCKED',
    state: evaluation.state,
    productionVerified: evaluation.productionVerified,
    automated: evaluation.automated,
    reasons: evaluation.reasons,
    gaps: evaluation.gaps || [],
    gates: gateReport,
    evidence,
    nextEvents: evaluation.state === 'BLOCKED'
      ? ['production.gate.failed']
      : ['production.activation.completed'],
    notes: [
      'Automated activation never claims REGISTERED/FILED without official legal receipts.',
      'PRODUCTION_VERIFIED requires live infra evidence flags in the activation input.'
    ]
  });

  return {
    ok: evaluation.state !== 'BLOCKED',
    state: evaluation.state,
    productionVerified: evaluation.productionVerified,
    gaps: evaluation.gaps || [],
    gates: gateReport,
    receipt,
    events: evaluation.state === 'BLOCKED'
      ? [{ name: 'production.gate.failed', payload: { state: evaluation.state, receipt: receipt.outPath } }]
      : [{ name: 'production.activation.completed', payload: { state: evaluation.state, receipt: receipt.outPath } }]
  };
}

export async function activationHeartbeat(root) {
  const latest = await loadLatestActivation(root);
  const required = [
    'scripts/deploy-platform.mjs',
    'config/seo/ross.co.ownership.json',
    'tools/ross-infinite/package.json',
    'packages/production-compliance/package.json',
    'docs/rossco-production-activation.md'
  ];
  const checks = [];
  for (const rel of required) {
    try {
      await access(path.join(root, rel));
      checks.push({ id: rel, ok: true });
    } catch {
      checks.push({ id: rel, ok: false });
    }
  }
  return {
    ok: checks.every((c) => c.ok),
    latestState: latest?.state || 'PROPOSED',
    latestOk: latest?.ok ?? null,
    checks,
    observedAt: new Date().toISOString()
  };
}
