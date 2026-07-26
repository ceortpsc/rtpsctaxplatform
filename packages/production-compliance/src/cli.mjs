#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHECKLIST_SECTIONS, checklistSummary, listChecklistItems } from './checklist.mjs';
import { runComplianceChecks } from './checks.mjs';
import {
  buildReport,
  writeReportArtifacts,
  formatMarkdownReport,
  readLatestLog,
  exitCodeForReport,
  REPORT_JSON,
  REPORT_MD,
  CHECKLIST_LOG
} from './report.mjs';

function printHelp() {
  console.log(`prodcheck — RTPSC live production checklist, compliance report, and log

Usage:
  prodcheck checklist [--json]
  prodcheck run [--skip-gates] [--live] [--strict-production] [--json]
  prodcheck report [--skip-gates] [--live] [--strict-production] [--json]
  prodcheck log
  prodcheck help

Artifacts:
  ${REPORT_JSON}
  ${REPORT_MD}
  ${CHECKLIST_LOG}
`);
}

function parseArgs(argv) {
  const args = {
    command: 'run',
    skipGates: false,
    live: false,
    strictProduction: false,
    json: false
  };

  const positionals = [];
  for (const arg of argv) {
    if (arg === '--skip-gates') args.skipGates = true;
    else if (arg === '--live') args.live = true;
    else if (arg === '--strict-production') args.strictProduction = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.command = 'help';
    else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals[0]) args.command = positionals[0];
  return args;
}

function formatChecklistText() {
  const summary = checklistSummary();
  const lines = [
    '# Full Live Production Checklist',
    `version=${summary.version}  sections=${summary.sections}  items=${summary.items}`,
    `modes: automated=${summary.byMode.automated} manual=${summary.byMode.manual} live=${summary.byMode.live}`,
    ''
  ];

  for (const section of CHECKLIST_SECTIONS) {
    lines.push(`## ${section.title}`);
    for (const item of section.items) {
      lines.push(`- [ ] ${item.id} (${item.mode}/${item.severity}) ${item.title}`);
      lines.push(`      evidence: ${item.evidence}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function executeReport(root, args) {
  const startedAt = new Date().toISOString();
  const { results, gateResults, live } = await runComplianceChecks(root, {
    skipGates: args.skipGates,
    live: args.live,
    strictProduction: args.strictProduction
  });

  const report = buildReport({
    root,
    results,
    gateResults,
    live,
    options: {
      startedAt,
      skipGates: args.skipGates,
      strictProduction: args.strictProduction
    }
  });

  const artifacts = await writeReportArtifacts(root, report);
  return { report, artifacts };
}

export async function runCli(argv = [], { cwd = process.cwd(), stdout = console.log, stderr = console.error } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    stderr(String(error.message || error));
    printHelp();
    process.exitCode = 2;
    return;
  }

  const root = cwd;

  if (args.command === 'help') {
    printHelp();
    return;
  }

  if (args.command === 'checklist') {
    if (args.json) {
      stdout(JSON.stringify({ summary: checklistSummary(), items: listChecklistItems() }, null, 2));
    } else {
      stdout(formatChecklistText());
    }
    return;
  }

  if (args.command === 'log') {
    try {
      stdout(await readLatestLog(root));
    } catch {
      stderr(`No checklist log found at ${path.join(root, CHECKLIST_LOG)}. Run: prodcheck run`);
      process.exitCode = 1;
    }
    return;
  }

  if (args.command === 'run' || args.command === 'report') {
    const { report, artifacts } = await executeReport(root, args);
    if (args.json) {
      stdout(JSON.stringify(report, null, 2));
    } else {
      stdout(formatMarkdownReport(report));
      stdout(`Wrote ${artifacts.jsonPath}`);
      stdout(`Wrote ${artifacts.mdPath}`);
      stdout(`Wrote ${artifacts.logPath}`);
    }
    process.exitCode = exitCodeForReport(report, { strictProduction: args.strictProduction });
    return;
  }

  stderr(`Unknown command: ${args.command}`);
  printHelp();
  process.exitCode = 2;
}

// Allow direct execution via node src/cli.mjs
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli(process.argv.slice(2));
}
