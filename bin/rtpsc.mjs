#!/usr/bin/env node
// RTPSC — Ross Tax Pro Software Co Platform v2.0-dev
// Custom, dependency-free command runner. Drives the platform directly through
// `node` (no package-manager `run` required). Usage: `./rtpsc <command> [args]`.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** A spawn plan: run `node <file> [args]` from the repo root. */
function node(file, args = []) {
  return { command: process.execPath, args: [path.join(repoRoot, file), ...args] };
}

/** A spawn plan: run `node <args>` (e.g. the built-in test runner). */
function nodeRaw(args) {
  return { command: process.execPath, args };
}

const SERVICE_ENTRIES = {
  gateway: 'services/api-gateway/src/index.mjs',
  'api-gateway': 'services/api-gateway/src/index.mjs',
  'refund-status': 'services/refund-status-service/src/index.mjs',
  transcript: 'services/transcript-service/src/index.mjs',
  analytics: 'services/analytics-service/src/index.mjs',
  enrollment: 'services/enrollment-service/src/index.mjs',
  invoice: 'services/invoice-service/src/index.mjs',
  'pos-crm': 'services/pos-crm-service/src/index.mjs',
  pos: 'services/pos-crm-service/src/index.mjs',
  crm: 'services/pos-crm-service/src/index.mjs',
  dashboard: 'services/modules-dashboard/src/index.mjs',
  'staff-portal': 'services/staff-portal/src/index.mjs',
  staff: 'services/staff-portal/src/index.mjs',
  'web-portal': 'services/web-portal/src/index.mjs',
  portal: 'services/web-portal/src/index.mjs',
  web: 'services/web-portal/src/index.mjs'
};

export const COMMANDS = {
  version: {
    usage: 'version [--json]',
    desc: 'Show the active Ross Tax Pro Software Co v2 release identity',
    plan: (rest) => node('scripts/release.mjs', ['current', ...rest])
  },
  release: {
    usage: 'release [current|list|show|validate|build|promote] [args]',
    desc: 'Inspect, validate, package, or evaluate promotion of v2 release channels',
    plan: (rest) => node('scripts/release.mjs', rest.length ? rest : ['current'])
  },
  lint: { usage: 'lint', desc: 'Run scaffold lint checks', plan: () => node('scripts/lint.mjs') },
  test: { usage: 'test', desc: 'Run the automated test suite', plan: () => nodeRaw(['--test']) },
  build: { usage: 'build', desc: 'Build the platform and active release manifests', plan: () => node('scripts/build.mjs') },
  start: {
    usage: 'start [gateway|refund-status|transcript|analytics|enrollment|invoice|pos-crm|dashboard|staff-portal|web-portal]',
    desc: 'Start a service (defaults to the api-gateway)',
    plan: (rest) => {
      const target = rest[0] ?? 'gateway';
      const entry = SERVICE_ENTRIES[target];
      if (!entry) return { error: `Unknown service "${target}". Options: ${Object.keys(SERVICE_ENTRIES).join(', ')}` };
      return node(entry);
    }
  },
  deploy: {
    usage: 'deploy [--smoke] [--full|--platform] [--skip-gates]',
    desc: 'Deploy platform services (add --full for RTPSC + ROSS.CO Infinite + SEO provisions)',
    plan: (rest) => {
      if (rest.includes('--full') || rest.includes('--platform')) {
        return node(
          'scripts/deploy-platform.mjs',
          rest.filter((arg) => arg !== '--full' && arg !== '--platform')
        );
      }
      return node('scripts/deploy-all.mjs', rest);
    }
  },
  'deploy-full': {
    usage: 'deploy-full [--smoke] [--skip-gates] [--skip-workers]',
    desc: 'Full deploy: gates, SEO/DNS artifacts, ROSS.CO Infinite, all services, workers, smoke',
    plan: (rest) => node('scripts/deploy-platform.mjs', rest)
  },
  activate: {
    usage: 'activate [--smoke|--skip-gates|--status|--heartbeat|--json] [--evidence-<flag>]',
    desc: 'Fully automated production activation (gates, receipts, workflow triggers)',
    plan: (rest) => node('packages/production-activation/bin/activate.mjs', rest)
  },
  workflows: { usage: 'workflows', desc: 'List background workflows', plan: () => node('workers/workflow-runner/src/cli.mjs', ['list']) },
  workflow: {
    usage: "workflow run <name> '<json>'  |  workflow emit <event> '<json>'",
    desc: 'Run or emit a single workflow',
    plan: (rest) => {
      if (rest.length === 0) return { error: 'workflow requires a subcommand: run | emit | list' };
      return node('workers/workflow-runner/src/cli.mjs', rest);
    }
  },
  agents: {
    usage: 'agents [docs|list|assign|run|required|trigger|workflow|help]',
    desc: 'Run/assign the deployment-assist team; dispatch assignment workflows & triggers',
    plan: (rest) => node('scripts/agents.mjs', rest)
  },
  canvas: {
    usage: 'canvas [list|kinds|describe|create [kind|all]]',
    desc: 'Create Cursor Canvas artifacts from platform state (.cursor/canvases)',
    plan: (rest) => node('scripts/canvas.mjs', rest.length ? rest : ['list'])
  },
  cloud: {
    usage: 'cloud doctor [--json]',
    desc: 'Verify Cursor Cloud helper tools (tmux, ffmpeg, desktop deps)',
    plan: (rest) => {
      const sub = rest[0] ?? 'doctor';
      if (sub !== 'doctor') {
        return { error: `Unknown cloud subcommand "${sub}". Use: ./rtpsc cloud doctor [--json]` };
      }
      return node('scripts/cloud-doctor.mjs', rest.slice(1));
    }
  },
  clients: {
    usage: 'clients [status|issue api|issue tds|ensure|export-env]',
    desc: 'Issue/list full API and TDS client ids (secrets gitignored)',
    plan: (rest) => node('scripts/clients.mjs', rest.length ? rest : ['status'])
  },
  env: { usage: 'env', desc: 'Print environment protection status', plan: () => node('scripts/env.mjs') }
};

export function buildUsage() {
  const lines = [
    'RTPSC — Ross Tax Pro Software Co Platform v2.0-dev',
    '',
    'Usage: ./rtpsc <command> [args]',
    '',
    'Commands:'
  ];
  for (const cmd of Object.values(COMMANDS)) {
    lines.push(`  ${cmd.usage.padEnd(52)} ${cmd.desc}`);
  }
  lines.push('  help                                                 Show this help');
  return lines.join('\n');
}

/** Resolve argv into a spawn plan (pure — no side effects). */
export function planCommand(argv) {
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help' || name === '-h') return { help: true };
  const command = COMMANDS[name];
  if (!command) return { error: `Unknown command: ${name}` };
  return command.plan(rest);
}

function main() {
  const plan = planCommand(process.argv.slice(2));
  if (plan.help) {
    console.log(buildUsage());
    return;
  }
  if (plan.error) {
    console.error(`${plan.error}\n\n${buildUsage()}`);
    process.exitCode = 1;
    return;
  }
  const child = spawn(plan.command, plan.args, { stdio: 'inherit', cwd: repoRoot });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
