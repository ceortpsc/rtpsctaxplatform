#!/usr/bin/env node
// RTPSC — Ross Tax Pro Software Co · Efile Transmission Software
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
  dashboard: 'services/modules-dashboard/src/index.mjs'
};

export const COMMANDS = {
  lint: { usage: 'lint', desc: 'Run scaffold lint checks', plan: () => node('scripts/lint.mjs') },
  test: { usage: 'test', desc: 'Run the automated test suite', plan: () => nodeRaw(['--test']) },
  build: { usage: 'build', desc: 'Build the platform manifest', plan: () => node('scripts/build.mjs') },
  start: {
    usage: 'start [gateway|refund-status|transcript|analytics|enrollment|invoice|dashboard]',
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
    usage: 'agents [docs]',
    desc: 'Run the deployment-assist & development team (add "docs" to write markdown)',
    plan: (rest) => node('scripts/agents.mjs', rest.includes('docs') || rest.includes('--write') ? ['--write'] : [])
  },
  env: { usage: 'env', desc: 'Print environment protection status', plan: () => node('scripts/env.mjs') }
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
