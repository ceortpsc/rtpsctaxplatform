#!/usr/bin/env node
/** RTPSC Pro Superiority CLI — scorecard & tax-prep smoke helpers. */

import {
  buildSuperiorityScorecard,
  describeProSuperiority,
  listDifferentiators
} from '../packages/pro-superiority/src/index.mjs';
import {
  createTaxPrepStore,
  describeTaxPrep,
  diagnoseReturn
} from '../packages/tax-prep/src/index.mjs';

function usage() {
  return `RTPSC Pro Superiority (vs TaxSlayer Pro–class)

Usage:
  ./rtpsc pro scorecard [--json]
  ./rtpsc pro differentiators
  ./rtpsc pro diagnose --name "…" [--wages N] [--withholding N] [--eitc]
  ./rtpsc pro status

Pro Desk UI: ./rtpsc start pro-desk  →  http://localhost:3007
`;
}

function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') flags.json = true;
    else if (a === '--name') flags.name = argv[++i];
    else if (a === '--wages') flags.wages = Number(argv[++i]);
    else if (a === '--withholding') flags.withholding = Number(argv[++i]);
    else if (a === '--eitc') flags.eitc = true;
    else if (a === '--children') flags.children = Number(argv[++i]);
    else positionals.push(a);
  }
  return { flags, positionals };
}

async function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const [cmd] = positionals;

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(usage());
    return;
  }

  if (cmd === 'status') {
    console.log(
      JSON.stringify(
        {
          superiority: describeProSuperiority(),
          taxPrep: describeTaxPrep()
        },
        null,
        2
      )
    );
    return;
  }

  if (cmd === 'scorecard') {
    const card = buildSuperiorityScorecard();
    if (flags.json) {
      console.log(JSON.stringify(card, null, 2));
      return;
    }
    console.log(`${card.brand} · Superiority index ${card.index} (${card.verdict})`);
    console.log(card.headline);
    console.log('');
    for (const row of card.rows) {
      console.log(`  [${row.posture.padEnd(8)}] ${row.area}`);
    }
    return;
  }

  if (cmd === 'differentiators') {
    console.log(JSON.stringify({ items: listDifferentiators() }, null, 2));
    return;
  }

  if (cmd === 'diagnose') {
    const answers = {
      displayName: flags.name || 'Demo Taxpayer',
      taxpayerRef: 'TP-PRO',
      wages: flags.wages ?? 42000,
      withholding: flags.withholding ?? 4800,
      qualifyingChildren: flags.children ?? 1,
      claimEitc: Boolean(flags.eitc),
      documents: flags.eitc ? ['1040', '8867', 'w2'] : ['1040', 'w2']
    };
    const store = createTaxPrepStore();
    const created = store.createReturn(answers);
    store.updateInterview(created.id, answers);
    const result = store.runDiagnostics(created.id);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'diagnose-raw') {
    console.log(JSON.stringify(diagnoseReturn({ displayName: 'Raw' }), null, 2));
    return;
  }

  console.error(`Unknown pro subcommand: ${cmd}\n\n${usage()}`);
  process.exitCode = 1;
}

main();
