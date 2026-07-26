#!/usr/bin/env node
/**
 * RTPSC Cloud Doctor — verify Cursor Cloud helper tools (tmux, ffmpeg, …).
 *
 * Usage:
 *   ./rtpsc cloud doctor
 *   ./rtpsc cloud doctor --json
 *   node scripts/cloud-doctor.mjs
 */

import { access, constants } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CHECKS = [
  {
    id: 'tmux',
    required: true,
    description: 'tmux for environment.json terminals / configure-terminals / start-all',
    resolve: () => resolveBinary(['tmux', '/exec-daemon/tmux', '/usr/bin/tmux'])
  },
  {
    id: 'ffmpeg',
    required: false,
    description: 'ffmpeg for recordScreen / demo video artifacts (recommended)',
    resolve: () => resolveBinary(['ffmpeg', '/usr/bin/ffmpeg'])
  },
  {
    id: 'git',
    required: true,
    description: 'git for workspace checkout operations',
    resolve: () => resolveBinary(['git', '/usr/bin/git'])
  },
  {
    id: 'node',
    required: true,
    description: 'Node.js >= 22 runtime',
    resolve: () => resolveBinary(['node', '/usr/local/node/bin/node'])
  },
  {
    id: 'sudo',
    required: false,
    description: 'sudo for privileged Cloud helpers',
    resolve: () => resolveBinary(['sudo', '/usr/bin/sudo'])
  },
  {
    id: 'locale',
    required: false,
    description: 'en_US.UTF-8 locale for desktop / computer-use bootstrap',
    resolve: () => {
      const locale = process.env.LANG || process.env.LC_ALL || '';
      if (/utf-?8/i.test(locale)) return { ok: true, path: locale || 'C.UTF-8' };
      return { ok: false, path: locale || null, detail: 'LANG/LC_ALL not UTF-8' };
    }
  },
  {
    id: 'exec-daemon-tmux-conf',
    required: false,
    description: 'Cursor portal tmux config when present',
    resolve: async () => {
      const conf = '/exec-daemon/tmux.portal.conf';
      try {
        await access(conf, constants.R_OK);
        return { ok: true, path: conf };
      } catch {
        return { ok: false, path: null, detail: 'optional — only present in live Cloud pods' };
      }
    }
  },
  {
    id: 'environment-json',
    required: true,
    description: '.cursor/environment.json is valid JSON with terminals',
    resolve: async () => {
      const file = path.join(repoRoot, '.cursor/environment.json');
      try {
        const { readFile } = await import('node:fs/promises');
        const raw = await readFile(file, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.terminals) || parsed.terminals.length === 0) {
          return { ok: false, path: file, detail: 'terminals[] missing' };
        }
        return { ok: true, path: file };
      } catch (error) {
        return {
          ok: false,
          path: file,
          detail: error instanceof Error ? error.message : String(error)
        };
      }
    }
  },
  {
    id: 'dockerfile-cloud-helpers',
    required: true,
    description: '.cursor/Dockerfile installs tmux and ffmpeg',
    resolve: async () => {
      const file = path.join(repoRoot, '.cursor/Dockerfile');
      try {
        const { readFile } = await import('node:fs/promises');
        const text = await readFile(file, 'utf8');
        const hasTmux = /\btmux\b/.test(text);
        const hasFfmpeg = /\bffmpeg\b/.test(text);
        const hasLocales = /\blocales\b/.test(text);
        if (hasTmux && hasFfmpeg && hasLocales) return { ok: true, path: file };
        return {
          ok: false,
          path: file,
          detail: `missing packages — tmux:${hasTmux} ffmpeg:${hasFfmpeg} locales:${hasLocales}`
        };
      } catch (error) {
        return {
          ok: false,
          path: file,
          detail: error instanceof Error ? error.message : String(error)
        };
      }
    }
  }
];

async function resolveBinary(candidates) {
  for (const candidate of candidates) {
    if (candidate.includes('/')) {
      try {
        await access(candidate, constants.X_OK);
        return { ok: true, path: candidate };
      } catch {
        continue;
      }
    } else {
      const found = spawnSync('bash', ['-lc', `command -v ${candidate}`], {
        encoding: 'utf8'
      });
      if (found.status === 0) {
        const resolved = found.stdout.trim();
        if (resolved) return { ok: true, path: resolved };
      }
    }
  }
  return { ok: false, path: null, detail: `not found (tried ${candidates.join(', ')})` };
}

export async function runCloudDoctor() {
  const results = [];
  for (const check of CHECKS) {
    const outcome = await check.resolve();
    results.push({
      id: check.id,
      required: check.required,
      description: check.description,
      ok: Boolean(outcome.ok),
      path: outcome.path ?? null,
      detail: outcome.detail ?? null
    });
  }
  const failedRequired = results.filter((r) => r.required && !r.ok);
  return {
    ok: failedRequired.length === 0,
    generatedAt: new Date().toISOString(),
    summary:
      failedRequired.length === 0
        ? 'Cloud helper tools look ready.'
        : `Missing required Cloud helpers: ${failedRequired.map((r) => r.id).join(', ')}`,
    results,
    notes: [
      '`Desktop init script not found, exiting` is Cursor platform desktop bootstrap — not a repo script.',
      'Custom Dockerfiles must ship tmux (terminals) + locales/xz-utils (desktop) + ffmpeg (recordScreen).',
      'After Dockerfile changes, force a Cloud environment rebuild (Dockerfile comment bump or delete saved env).'
    ]
  };
}

function printHuman(report) {
  console.log(`RTPSC Cloud Doctor — ${report.ok ? 'READY' : 'NEEDS FIX'}`);
  console.log(report.summary);
  console.log('');
  for (const item of report.results) {
    const mark = item.ok ? '✓' : item.required ? '✗' : '·';
    const where = item.path ? ` → ${item.path}` : '';
    const detail = item.detail ? ` (${item.detail})` : '';
    console.log(`${mark} ${item.id}${where}${detail}`);
    console.log(`  ${item.description}`);
  }
  console.log('');
  for (const note of report.notes) console.log(`note: ${note}`);
}

async function main(argv) {
  const json = argv.includes('--json');
  const report = await runCloudDoctor();
  if (json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main(process.argv.slice(2));
}
