import { install } from './install.mjs';
import { runScript, execCommand } from './run.mjs';
import { bench } from './bench.mjs';
import { discoverWorkspaces, loadRootManifest, workspaceByName } from './workspaces.mjs';
import { buildLockfile, readLockfile, writeLockfile, LOCKFILE_NAME, fingerprint } from './lockfile.mjs';
import {
  loadConfig,
  writeConfig,
  initConfig,
  getConfigValue,
  setConfigValue,
  DEFAULT_CONFIG,
  CONFIG_FILE_NAME
} from './config.mjs';
import { ExitCode, SignalCode, listCodes, AolError, getSignal } from './codes.mjs';
import { IP, copyrightBanner, copyrightJson } from './ip.mjs';
import { COMMANDS, resolveCommand, listCommands } from './commands.mjs';
import { doctor } from './doctor.mjs';
import { graph, mailStatus } from './graph.mjs';

/**
 * Programmatic Adaptive Optimized Linker API.
 *
 * @example
 * import { createAol } from '@rtp/aol';
 * const aol = await createAol({ root: process.cwd() });
 * await aol.install();
 * const buddies = await aol.listWorkspaces();
 */
export async function createAol(options = {}) {
  const root = options.root || process.cwd();
  const config = options.config || (await loadConfig(root));

  return {
    version: IP.version,
    root,
    config,
    install: (opts = {}) =>
      install(root, {
        quiet: opts.quiet ?? config.ui.quiet,
        force: opts.force ?? config.install.force
      }),
    run: (args, opts) => runScript(root, Array.isArray(args) ? args : [args], opts),
    exec: (args) => execCommand(root, Array.isArray(args) ? args : [args]),
    bench: (rounds = config.bench.rounds) => bench(root, rounds),
    listWorkspaces: async () => {
      const manifest = await loadRootManifest(root);
      return discoverWorkspaces(root, config.workspaces.patterns || manifest.workspaces || []);
    },
    why: async (name) => {
      const manifest = await loadRootManifest(root);
      const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
      const ws = workspaceByName(workspaces, name);
      if (!ws) throw new AolError('WORKSPACE_NOT_FOUND', name);
      const lock = await readLockfile(root);
      return { ...ws, fingerprint: lock?.packages?.[ws.name]?.fingerprint || fingerprint(ws) };
    },
    graph: () => graph(root),
    mail: () => mailStatus(root),
    doctor: () => doctor(root),
    getConfig: () => loadConfig(root),
    initConfig: (opts) => initConfig(root, opts),
    get: async (key) => getConfigValue(await loadConfig(root), key),
    set: async (key, value) => {
      const next = setConfigValue(await loadConfig(root), key, String(value));
      await writeConfig(root, next);
      return next;
    },
    codes: () => listCodes(),
    commands: () => listCommands(),
    copyright: () => copyrightJson(),
    apiSurface: () => describeApiSurface()
  };
}

export function describeApiSurface() {
  return {
    package: '@rtp/aol',
    version: IP.version,
    entry: 'tools/aol/src/index.mjs',
    createAol: {
      signature: 'createAol({ root?, config? }) → Promise<AolClient>',
      methods: [
        'install(opts?)',
        'run(args, opts?)',
        'exec(args)',
        'bench(rounds?)',
        'listWorkspaces()',
        'why(name)',
        'graph()',
        'mail()',
        'doctor()',
        'getConfig()',
        'initConfig(opts?)',
        'get(key)',
        'set(key, value)',
        'codes()',
        'commands()',
        'copyright()',
        'apiSurface()'
      ]
    },
    modules: {
      install: 'install()',
      run: 'runScript(), execCommand()',
      workspaces: 'discoverWorkspaces(), loadRootManifest(), workspaceByName()',
      lockfile: 'buildLockfile(), readLockfile(), writeLockfile(), LOCKFILE_NAME',
      config: 'loadConfig(), writeConfig(), initConfig(), DEFAULT_CONFIG',
      codes: 'ExitCode, SignalCode, AolError, listCodes()',
      ip: 'IP, copyrightBanner(), copyrightJson()',
      commands: 'COMMANDS, resolveCommand(), listCommands()',
      doctor: 'doctor()',
      graph: 'graph(), mailStatus()',
      cli: 'runCli(argv)',
      api: 'createAol(), describeApiSurface()'
    },
    exitCodes: ExitCode,
    signalCodes: Object.keys(SignalCode)
  };
}

export {
  install,
  runScript,
  execCommand,
  bench,
  discoverWorkspaces,
  loadRootManifest,
  workspaceByName,
  buildLockfile,
  readLockfile,
  writeLockfile,
  LOCKFILE_NAME,
  fingerprint,
  loadConfig,
  writeConfig,
  initConfig,
  getConfigValue,
  setConfigValue,
  DEFAULT_CONFIG,
  CONFIG_FILE_NAME,
  ExitCode,
  SignalCode,
  listCodes,
  AolError,
  getSignal,
  IP,
  copyrightBanner,
  copyrightJson,
  COMMANDS,
  resolveCommand,
  listCommands,
  doctor,
  graph,
  mailStatus
};
