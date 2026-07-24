// Agent orchestrator CLI.
//   node scripts/agents.mjs           # run all agents, print JSON summary
//   node scripts/agents.mjs --write   # also write generated markdown docs to disk
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runPlatformAgents } from '../packages/agent-core/src/roster.mjs';

const write = process.argv.includes('--write');
const { reports, documents } = await runPlatformAgents();

if (write) {
  for (const doc of documents) {
    await mkdir(path.dirname(doc.path), { recursive: true });
    const contents = doc.markdown.endsWith('\n') ? doc.markdown : `${doc.markdown}\n`;
    await writeFile(doc.path, contents);
    console.log(`wrote ${doc.path}`);
  }
  console.log(`\nGenerated ${documents.length} markdown document(s).`);
} else {
  console.log(
    JSON.stringify(
      reports.map((report) => ({ agent: report.agent, status: report.status, summary: report.summary })),
      null,
      2
    )
  );
}
