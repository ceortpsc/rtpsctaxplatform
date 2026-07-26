import { IP } from './ip.mjs';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[38;2;61;224;197m',
  amber: '\x1b[38;2;255;183;3m',
  slate: '\x1b[38;2;143;176;200m'
};

export function banner() {
  return [
    `${c.amber}${c.bold}${IP.marks.find((m) => m.mark === '◈')?.mark || '◈'} ${IP.productName}${c.reset} ${c.cyan}Infinite Transfer Rate${c.reset}`,
    `${c.dim}${IP.productExpansion} v${IP.version}${c.reset}`,
    `${c.slate}Transfer without ceiling.${c.reset}`
  ].join('\n');
}

export function helpText() {
  return `${banner()}

Commands
  rossco install|transfer   Infinite transfer / AOL-backed parallel link
  rossco lifecycle|map      Full engineering lifecycle map
  rossco plan|scope|stage   Planning / scoping / staging artifacts
  rossco test|validate|verify
  rossco register|copyright Register product + show IP seal
  rossco presence|seo       Online presence + SEO emit
  rossco doctor|version|help|commands

Flags
  --json / -j               Machine-readable output
  --force / -f              Force relink on transfer/install
`;
}

export function panel(title, lines) {
  const body = lines.map((line) => `  ${line}`).join('\n');
  return `${c.cyan}${c.bold}${title}${c.reset}\n${body}`;
}
