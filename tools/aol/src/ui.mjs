import { ansi } from './ansi.mjs';

const { bold, dim, cyan, amber, sky, mint, rose, white, silver } = ansi;

/** Brand mark — yellow triangle evolved into a signal chevron. */
export function brandLine() {
  return `${amber(bold('▲'))} ${cyan(bold('AOL'))} ${silver('Adaptive Optimized Linker')} ${dim('v0.1')}`;
}

export function youveGot(kind = 'packages') {
  return `${amber(bold("You've got"))} ${cyan(bold(kind))}${amber('.')}`;
}

export function panel(title, lines = []) {
  const width = 56;
  const top = `${sky('┌')}${sky('─'.repeat(width - 2))}${sky('┐')}`;
  const mid = `${sky('│')} ${bold(white(title.padEnd(width - 4)))}${sky('│')}`;
  const sep = `${sky('├')}${sky('─'.repeat(width - 2))}${sky('┤')}`;
  const body = lines.map((line) => {
    const plain = stripAnsi(String(line));
    const pad = Math.max(0, width - 4 - plain.length);
    return `${sky('│')} ${line}${' '.repeat(pad)}${sky('│')}`;
  });
  const bot = `${sky('└')}${sky('─'.repeat(width - 2))}${sky('┘')}`;
  return [top, mid, sep, ...body, bot].join('\n');
}

export function buddyList(entries) {
  const rows = entries.map((e, i) => {
    const status = e.ok ? mint('●') : rose('○');
    const name = cyan(e.name);
    const loc = dim(e.location || '');
    return `  ${status} ${name}  ${loc}`;
  });
  return panel('Workspace Buddy List', [
    dim('signal · constellation · monorepo'),
    ...rows
  ]);
}

export function handshake(step, total, label) {
  const filled = Math.round((step / total) * 18);
  const bar = `${cyan('█'.repeat(filled))}${dim('░'.repeat(18 - filled))}`;
  return `  ${amber('⌁')} quantum handshake  [${bar}]  ${silver(label)}`;
}

export function success(ms, stats) {
  const speed = stats?.speedup ? `  ${mint(`${stats.speedup}×`)} vs npm baseline` : '';
  return [
    '',
    youveGot(stats?.kind || 'packages'),
    `  ${mint('✓')} linked ${bold(String(stats?.linked ?? 0))} workspaces in ${cyan(`${ms.toFixed(1)}ms`)}${speed}`,
    stats?.scripts ? `  ${sky('→')} scripts ready · ${dim('aol run <script>')}` : '',
    ''
  ].filter(Boolean).join('\n');
}

export function info(msg) {
  return `${sky('ℹ')} ${msg}`;
}

export function warn(msg) {
  return `${amber('⚠')} ${msg}`;
}

export function error(msg) {
  return `${rose('✖')} ${msg}`;
}

export function helpText() {
  return [
    brandLine(),
    '',
    dim('Next-level package velocity. Instant Messenger soul. Zero bloat.'),
    '',
    bold('Core'),
    `  ${cyan('aol')} ${white('install')}|${white('dial')}     Quantum handshake + parallel link`,
    `  ${cyan('aol')} ${white('run')} [-w name] <script>  Transmit a script signal`,
    `  ${cyan('aol')} ${white('exec')} -w name -- <cmd>   Raw workspace channel exec`,
    `  ${cyan('aol')} ${white('ls')}|${white('buddy')}         Workspace Buddy List`,
    `  ${cyan('aol')} ${white('why')} <name>              Explain a buddy link`,
    `  ${cyan('aol')} ${white('graph')}|${white('mail')}|${white('lock')}  Map / status / RTPSC lock`,
    `  ${cyan('aol')} ${white('bench')}|${white('velocity')}   Speed report vs npm`,
    '',
    bold('Config · Codes · API · IP'),
    `  ${cyan('aol')} ${white('config')} <list|get|set|init>`,
    `  ${cyan('aol')} ${white('codes')} | ${white('api')} | ${white('commands')}`,
    `  ${cyan('aol')} ${white('copyright')}|${white('ip')} | ${white('whoami')} | ${white('doctor')}`,
    '',
    bold('Signal'),
    `  Lockfile: ${amber('RTPSC-package-lock.json')}  Config: ${amber('aol.config.json')}  License: ${amber('MIT')}`,
    `  ${dim('aol help <command> · aol commands --json')}`,
    ''
  ].join('\n');
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}
