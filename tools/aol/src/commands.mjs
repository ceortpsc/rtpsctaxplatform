/**
 * Concept command registry — Instant Messenger–era verbs mapped to AOL operations.
 */

export const COMMANDS = Object.freeze([
  {
    name: 'install',
    aliases: ['i', 'link', 'dial', 'handshake'],
    concept: 'Quantum handshake — open parallel tunnels and link the constellation',
    category: 'core',
    usage: 'aol install [--force]'
  },
  {
    name: 'run',
    aliases: [],
    concept: 'Transmit a script signal through a workspace or root',
    category: 'core',
    usage: 'aol run [-w <workspace>] <script> [-- args...]'
  },
  {
    name: 'exec',
    aliases: [],
    concept: 'Raw command execution inside a workspace channel',
    category: 'core',
    usage: 'aol exec -w <workspace> -- <command>'
  },
  {
    name: 'ls',
    aliases: ['list', 'buddy', 'buddies'],
    concept: 'Workspace Buddy List — who is online in the monorepo',
    category: 'core',
    usage: 'aol ls'
  },
  {
    name: 'why',
    aliases: [],
    concept: 'Explain a buddy link (location, fingerprint, scripts)',
    category: 'core',
    usage: 'aol why <workspace>'
  },
  {
    name: 'lock',
    aliases: ['seal', 'rtpsc-lock'],
    concept: 'Show or re-seal RTPSC-package-lock.json (platform lockfile)',
    category: 'core',
    usage: 'aol lock [--json] [--write|--seal]'
  },
  {
    name: 'bench',
    aliases: ['velocity', 'speed'],
    concept: 'Velocity report — AOL vs npm install wall-clock',
    category: 'core',
    usage: 'aol bench [rounds]'
  },
  {
    name: 'config',
    aliases: ['cfg'],
    concept: 'Read or write aol.config.json constellation settings',
    category: 'config',
    usage: 'aol config <list|get|set|init> ...'
  },
  {
    name: 'codes',
    aliases: ['signals'],
    concept: 'List signal / exit codes for automation and diagnostics',
    category: 'meta',
    usage: 'aol codes [--json]'
  },
  {
    name: 'api',
    aliases: [],
    concept: 'Show the programmatic Adaptive Optimized Linker API surface',
    category: 'meta',
    usage: 'aol api [--json]'
  },
  {
    name: 'copyright',
    aliases: ['ip', 'license', 'notice'],
    concept: 'Copyright, trademark, and intellectual-property notices',
    category: 'ip',
    usage: 'aol copyright [--json]'
  },
  {
    name: 'doctor',
    aliases: ['diag', 'health'],
    concept: 'Diagnose links, lockfile, config, and IP notice presence',
    category: 'meta',
    usage: 'aol doctor [--json]'
  },
  {
    name: 'graph',
    aliases: ['constellation', 'map'],
    concept: 'Print the workspace constellation map',
    category: 'core',
    usage: 'aol graph [--json]'
  },
  {
    name: 'mail',
    aliases: ['signal', 'status'],
    concept: "You've got status — lock + workspace signal summary",
    category: 'core',
    usage: 'aol mail [--json]'
  },
  {
    name: 'whoami',
    aliases: ['brand'],
    concept: 'Product identity and brand expansion',
    category: 'ip',
    usage: 'aol whoami'
  },
  {
    name: 'help',
    aliases: ['--help', '-h'],
    concept: 'Command catalog',
    category: 'meta',
    usage: 'aol help [command]'
  },
  {
    name: 'version',
    aliases: ['--version', '-v'],
    concept: 'Print aol/<version>',
    category: 'meta',
    usage: 'aol version'
  },
  {
    name: 'commands',
    aliases: ['concepts'],
    concept: 'List all concept commands with Instant Messenger semantics',
    category: 'meta',
    usage: 'aol commands [--json]'
  }
]);

export function resolveCommand(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return (
    COMMANDS.find((c) => c.name === lower) ||
    COMMANDS.find((c) => c.aliases.includes(lower)) ||
    null
  );
}

export function listCommands({ category } = {}) {
  return COMMANDS.filter((c) => !category || c.category === category);
}
