import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  createAol,
  describeApiSurface,
  listCodes,
  ExitCode,
  SignalCode,
  AolError,
  loadConfig,
  initConfig,
  getConfigValue,
  setConfigValue,
  IP,
  copyrightJson,
  listCommands,
  resolveCommand,
  doctor,
  graph,
  mailStatus
} from '../tools/aol/src/index.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aol-api-'));
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture-root',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*'],
        scripts: { hello: 'node -e "console.log(1)"' }
      },
      null,
      2
    )
  );
  await mkdir(path.join(root, 'packages/alpha'), { recursive: true });
  await writeFile(
    path.join(root, 'packages/alpha/package.json'),
    JSON.stringify({ name: '@fix/alpha', version: '0.1.0', private: true }, null, 2)
  );
  // IP assets expected by doctor when run against repo; for fixture, create stubs
  await writeFile(path.join(root, 'LICENSE'), 'MIT\n');
  await mkdir(path.join(root, 'tools/aol'), { recursive: true });
  await writeFile(path.join(root, 'tools/aol/NOTICE'), 'notice\n');
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs/aol-intellectual-property.md'), '# ip\n');
  return root;
}

describe('AOL codes, config, API, IP', () => {
  it('exposes signal and exit codes', () => {
    assert.equal(ExitCode.OK, 0);
    assert.equal(SignalCode.UNKNOWN_COMMAND.code, 'AOL-G001');
    const codes = listCodes();
    assert.ok(codes.length >= 10);
    const err = new AolError('WORKSPACE_NOT_FOUND', '@x/y');
    assert.equal(err.code, 'AOL-W001');
    assert.equal(err.exitCode, ExitCode.WORKSPACE);
  });

  it('loads defaults and supports config init/get/set', async () => {
    const root = await makeFixture();
    try {
      const cfg = await loadConfig(root);
      assert.equal(cfg.brand.name, 'AOL');
      assert.match(cfg.ip.disclaimer, /Not affiliated/);
      await initConfig(root, { force: true });
      assert.equal(getConfigValue(cfg, 'brand.tagline'), "You've got packages.");
      const next = setConfigValue(cfg, 'bench.rounds', '5');
      assert.equal(next.bench.rounds, 5);
      assert.throws(() => setConfigValue(cfg, 'brand.name', 'X'), /read-only|AOL-C003/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('createAol installs and reports graph/mail/doctor', async () => {
    const root = await makeFixture();
    try {
      const aol = await createAol({ root });
      const result = await aol.install({ quiet: true, force: true });
      assert.equal(result.linked, 1);
      const buddies = await aol.listWorkspaces();
      assert.equal(buddies[0].name, '@fix/alpha');
      const g = await aol.graph();
      assert.equal(g.nodeCount, 1);
      const mail = await aol.mail();
      assert.equal(mail.workspaces, 1);
      assert.equal(mail.lockfile, true);
      const report = await doctor(root);
      assert.equal(report.ok, true);
      assert.ok(aol.copyright().product.includes('Adaptive Optimized Linker'));
      assert.ok(aol.apiSurface().createAol.methods.includes('install(opts?)'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('concept command registry resolves aliases', () => {
    assert.equal(resolveCommand('dial').name, 'install');
    assert.equal(resolveCommand('buddy').name, 'ls');
    assert.equal(resolveCommand('velocity').name, 'bench');
    assert.equal(resolveCommand('ip').name, 'copyright');
    assert.ok(listCommands().length >= 15);
  });

  it('IP constants include disclaimer and marks', () => {
    assert.equal(IP.productName, 'AOL');
    assert.match(IP.disclaimer, /America Online/);
    const json = copyrightJson();
    assert.ok(json.marks.some((m) => m.mark === '▲'));
    assert.ok(describeApiSurface().signalCodes.includes('OK'));
  });

  it('graph and mailStatus work on fixture', async () => {
    const root = await makeFixture();
    try {
      const aol = await createAol({ root });
      await aol.install({ quiet: true, force: true });
      const g = await graph(root);
      assert.ok(g.edges.length >= 2);
      const m = await mailStatus(root);
      assert.equal(m.greeting, "You've got status.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
