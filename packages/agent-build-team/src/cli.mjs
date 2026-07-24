#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inventModules, describeInventory, DEVELOPMENTAL_SECTORS } from './inventory.mjs';
import { listRoles, TEAM_NAME, TEAM_VERSION } from './roles.mjs';
import { planTeamCoverage, runTeam } from './team.mjs';
import { formatTeamReport, toJsonReport } from './report.mjs';

function printHelp() {
  console.log(`Agent Build Engineering Team (abet) v${TEAM_VERSION}

Usage:
  abet <command> [options]

Commands:
  roles                 List engineering team roles
  inventory             Discover all developmental projects and modules
  plan                  Show coverage plan for every module
  run                   Run the full team assessment (+ quality gates)
  report                Alias of run; writes build/agent-build-team-report.json
  help                  Show this help

Options:
  --json                Machine-readable JSON output
  --verbose             Include per-role detail in text reports
  --skip-gates          Skip lint/test/build quality gates on run/report
  --root <dir>          Monorepo root (default: cwd)
  --out <file>          Write JSON report to a path (report/run)

Examples:
  ./scripts/aol run team
  node ./packages/agent-build-team/bin/abet.mjs inventory --json
  node ./packages/agent-build-team/bin/abet.mjs run --verbose
`);
}

function parseArgs(argv) {
  const args = {
    command: 'help',
    json: false,
    verbose: false,
    skipGates: false,
    root: process.cwd(),
    out: null
  };

  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--json') args.json = true;
    else if (token === '--verbose') args.verbose = true;
    else if (token === '--skip-gates') args.skipGates = true;
    else if (token === '--root') {
      args.root = path.resolve(argv[++i] ?? process.cwd());
    } else if (token === '--out') {
      args.out = argv[++i] ?? null;
    } else if (token.startsWith('-')) {
      throw new Error(`Unknown option: ${token}`);
    } else {
      positionals.push(token);
    }
  }

  if (positionals[0]) args.command = positionals[0];
  return args;
}

async function writeReportFile(report, outPath) {
  const target = outPath
    ? path.resolve(outPath)
    : path.join(process.cwd(), 'build', 'agent-build-team-report.json');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, toJsonReport(report));
  return target;
}

export async function runCli(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    printHelp();
    return 2;
  }

  const { command, json, verbose, skipGates, root, out } = args;

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }

  if (command === 'roles') {
    const payload = { team: TEAM_NAME, version: TEAM_VERSION, roles: listRoles() };
    console.log(json ? JSON.stringify(payload, null, 2) : payload.roles.map((r) => `${r.order}. ${r.name} (${r.id}) — ${r.description}`).join('\n'));
    return 0;
  }

  if (command === 'inventory') {
    const modules = await inventModules(root);
    const payload = describeInventory(modules);
    if (json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`${TEAM_NAME} inventory — ${payload.totalModules} modules across ${DEVELOPMENTAL_SECTORS.length} sectors`);
      for (const sector of payload.sectors) {
        console.log(`\n[${sector.sector}] ${sector.count}`);
        for (const module of sector.modules) {
          console.log(`  - ${module.name} (${module.packageName ?? 'unnamed'})`);
        }
      }
    }
    return 0;
  }

  if (command === 'plan') {
    const modules = await inventModules(root);
    const plan = planTeamCoverage(modules);
    if (json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(`${plan.team} coverage plan v${plan.version}`);
      console.log('\nObjectives:');
      for (const objective of plan.objectives) console.log(`  - ${objective}`);
      console.log('\nRoles:');
      for (const role of plan.roles) console.log(`  - ${role.name}`);
      console.log(`\nModules (${plan.moduleTargets.length}):`);
      for (const target of plan.moduleTargets) {
        console.log(`  - ${target.sector}/${target.name}`);
      }
    }
    return 0;
  }

  if (command === 'run' || command === 'report') {
    const report = await runTeam({
      rootDir: root,
      includeQualityGates: !skipGates
    });
    const written = await writeReportFile(report, out);
    if (json) {
      console.log(toJsonReport(report).trimEnd());
    } else {
      console.log(formatTeamReport(report, { verbose }).trimEnd());
      console.log(`\nJSON report: ${written}`);
    }
    return report.overall === 'fail' ? 1 : 0;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 2;
}
