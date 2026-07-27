#!/usr/bin/env node
// RTPSC — Ross Tax Pro Software Co · Efile Transmission Software
// Custom, dependency-free command runner. Drives the platform directly through
// `node` (no package-manager `run` required). Usage: `./rtpsc <command> [args]`.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapEnv } from '../packages/platform-core/src/index.mjs';

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
  apple: 'services/apple-developer-console/src/index.mjs',
  'apple-developer-console': 'services/apple-developer-console/src/index.mjs',
  'apple-console': 'services/apple-developer-console/src/index.mjs'
};

export const COMMANDS = {
  lint: { usage: 'lint', desc: 'Run scaffold lint checks', plan: () => node('scripts/lint.mjs') },
  test: {
    usage: 'test',
    desc: 'Run the automated test suite',
    plan: () => ({
      command: process.execPath,
      args: ['--test'],
      env: { ...process.env, RTPSC_SKIP_ENV_FILE: '1' }
    })
  },
  build: { usage: 'build', desc: 'Build the platform manifest', plan: () => node('scripts/build.mjs') },
  start: {
    usage: 'start [gateway|refund-status|transcript|analytics|enrollment|invoice|pos-crm|dashboard|apple]',
    desc: 'Start a service (defaults to the api-gateway)',
    plan: (rest) => {
      const target = rest[0] ?? 'gateway';
      const entry = SERVICE_ENTRIES[target];
      if (!entry) return { error: `Unknown service "${target}". Options: ${Object.keys(SERVICE_ENTRIES).join(', ')}` };
      return node(entry);
    }
  },
  deploy: { usage: 'deploy [--smoke]', desc: 'Deploy all services + background worker', plan: (rest) => node('scripts/deploy-all.mjs', rest) },
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
  env: { usage: 'env', desc: 'Print environment protection status', plan: () => node('scripts/env.mjs') },
  config: {
    usage: 'config doctor [--json]',
    desc: 'Doctor for tunnels, gateways, transmitters, endpoints, routes, pipelines',
    plan: (rest) => {
      const sub = rest[0] ?? 'doctor';
      if (sub !== 'doctor') {
        return { error: `Unknown config subcommand "${sub}". Use: ./rtpsc config doctor [--json]` };
      }
      return node('scripts/config-doctor.mjs', rest.slice(1));
    }
  },
  seed: {
    usage: 'seed [--json] [--no-persist]',
    desc: 'Fully seed and wire firm/catalog/topology (no demo placeholders)',
    plan: (rest) => node('scripts/seed.mjs', rest)
  }
};

export function buildUsage() {
  const lines = [
    'RTPSC — Ross Tax Pro Software Co · Efile Transmission Software',
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
  const argv = process.argv.slice(2);
  const commandName = argv[0];
  // Keep unit tests deterministic — do not inject operator .env into the test process.
  if (commandName && commandName !== 'test' && commandName !== 'lint' && commandName !== 'help') {
    bootstrapEnv({ cwd: repoRoot });
  }
  const plan = planCommand(argv);
  if (plan.help) {
    console.log(buildUsage());
    return;
  }
  if (plan.error) {
    console.error(`${plan.error}\n\n${buildUsage()}`);
    process.exitCode = 1;
    return;
  }
  const child = spawn(plan.command, plan.args, {
    stdio: 'inherit',
    cwd: repoRoot,
    env: plan.env ?? process.env
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
