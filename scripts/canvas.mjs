#!/usr/bin/env node
/**
 * RTPSC Canvas CLI — create Cursor Canvas artifacts from platform state.
 *
 * Usage:
 *   ./rtpsc canvas list
 *   ./rtpsc canvas kinds
 *   ./rtpsc canvas create [platform|compliance|agents|modules|all]
 *   ./rtpsc canvas describe
 */

import {
  createCanvas,
  createAllCanvases,
  listCanvasFiles,
  listCanvasKinds,
  describeCanvasSurface,
  DEFAULT_CANVAS_DIR
} from '../packages/canvas-core/src/index.mjs';

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage() {
  return [
    'RTPSC Canvas — Cursor Canvas creation',
    '',
    'Usage:',
    '  ./rtpsc canvas list',
    '  ./rtpsc canvas kinds',
    '  ./rtpsc canvas describe',
    '  ./rtpsc canvas create [platform|compliance|agents|modules|all]',
    '',
    `Default output: ${DEFAULT_CANVAS_DIR}`,
    'Open generated files in Cursor (Agents Window → Canvas / Open Canvas).'
  ].join('\n');
}

async function main(argv) {
  const [subcommand, target] = argv;

  if (!subcommand || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    console.log(usage());
    return;
  }

  if (subcommand === 'list') {
    printJson({ canvases: await listCanvasFiles() });
    return;
  }

  if (subcommand === 'kinds') {
    printJson({ kinds: listCanvasKinds() });
    return;
  }

  if (subcommand === 'describe') {
    printJson(describeCanvasSurface());
    return;
  }

  if (subcommand === 'create') {
    const kind = target ?? 'all';
    if (kind === 'all') {
      const created = await createAllCanvases();
      printJson({ created, count: created.length });
      return;
    }
    const created = await createCanvas(kind);
    printJson({ created });
    return;
  }

  console.error(`Unknown canvas subcommand: ${subcommand}\n\n${usage()}`);
  process.exitCode = 1;
}

await main(process.argv.slice(2));
