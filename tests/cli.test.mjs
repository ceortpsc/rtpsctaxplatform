import test from 'node:test';
import assert from 'node:assert/strict';
import { planCommand, buildUsage, COMMANDS } from '../bin/rtpsc.mjs';

test('help is shown for no command or help flags', () => {
  assert.equal(planCommand([]).help, true);
  assert.equal(planCommand(['help']).help, true);
  assert.equal(planCommand(['--help']).help, true);
  assert.equal(planCommand(['-h']).help, true);
});

test('unknown command reports an error', () => {
  const plan = planCommand(['frobnicate']);
  assert.match(plan.error, /Unknown command/);
});

test('core commands resolve to node spawn plans (no pnpm)', () => {
  assert.match(planCommand(['lint']).args.join(' '), /scripts\/lint\.mjs$/);
  assert.deepEqual(planCommand(['test']).args, ['--test']);
  assert.match(planCommand(['build']).args.join(' '), /scripts\/build\.mjs$/);
  assert.match(planCommand(['deploy', '--smoke']).args.join(' '), /deploy-all\.mjs --smoke$/);
  assert.match(planCommand(['env']).args.join(' '), /scripts\/env\.mjs$/);
  // every plan runs via the node executable, never a package manager
  for (const name of Object.keys(COMMANDS)) {
    const plan = COMMANDS[name].plan([]);
    if (plan.command) assert.equal(plan.command, process.execPath);
  }
});

test('start resolves services and rejects unknown ones', () => {
  assert.match(planCommand(['start', 'dashboard']).args.join(' '), /modules-dashboard\/src\/index\.mjs$/);
  assert.match(planCommand(['start', 'invoice']).args.join(' '), /invoice-service\/src\/index\.mjs$/);
  assert.match(planCommand(['start', 'pos-crm']).args.join(' '), /pos-crm-service\/src\/index\.mjs$/);
  assert.match(planCommand(['start', 'crm']).args.join(' '), /pos-crm-service\/src\/index\.mjs$/);
  assert.match(planCommand(['start']).args.join(' '), /api-gateway\/src\/index\.mjs$/);
  assert.match(planCommand(['start', 'nope']).error, /Unknown service/);
});

test('agents docs maps to the --write flag', () => {
  assert.deepEqual(planCommand(['agents', 'docs']).args.slice(-1), ['--write']);
  assert.equal(planCommand(['agents']).args.some((a) => a === '--write'), false);
});

test('usage lists the commands', () => {
  const usage = buildUsage();
  for (const name of ['lint', 'test', 'build', 'deploy', 'agents', 'canvas', 'workflow', 'clients']) {
    assert.ok(usage.includes(name), `usage should mention ${name}`);
  }
});

test('clients command resolves to scripts/clients.mjs', () => {
  assert.match(planCommand(['clients']).args.join(' '), /scripts\/clients\.mjs/);
  assert.match(planCommand(['clients', 'issue', 'api']).args.join(' '), /issue api$/);
});

test('canvas command resolves to scripts/canvas.mjs', () => {
  assert.match(planCommand(['canvas']).args.join(' '), /scripts\/canvas\.mjs/);
  assert.match(planCommand(['canvas', 'create', 'all']).args.join(' '), /create all$/);
  assert.match(planCommand(['canvas', 'kinds']).args.join(' '), /kinds$/);
});
