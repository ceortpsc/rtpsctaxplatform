import test from 'node:test';
import assert from 'node:assert/strict';
import { planCommand } from '../bin/rtpsc.mjs';
import { runCloudDoctor } from '../scripts/cloud-doctor.mjs';

test('cloud doctor command is registered on rtpsc', () => {
  const plan = planCommand(['cloud', 'doctor']);
  assert.match(plan.args.join(' '), /scripts\/cloud-doctor\.mjs$/);
  assert.equal(plan.command, process.execPath);

  const withJson = planCommand(['cloud', 'doctor', '--json']);
  assert.match(withJson.args.join(' '), /cloud-doctor\.mjs --json$/);

  const bad = planCommand(['cloud', 'frob']);
  assert.match(bad.error, /Unknown cloud subcommand/);
});

test('runCloudDoctor reports dockerfile cloud helpers and environment.json', async () => {
  const report = await runCloudDoctor();
  assert.equal(typeof report.ok, 'boolean');
  assert.ok(Array.isArray(report.results));

  const dockerfile = report.results.find((r) => r.id === 'dockerfile-cloud-helpers');
  assert.ok(dockerfile?.ok, 'Dockerfile must declare tmux/ffmpeg/locales');

  const envJson = report.results.find((r) => r.id === 'environment-json');
  assert.ok(envJson?.ok, 'environment.json must parse with terminals');

  const tmux = report.results.find((r) => r.id === 'tmux');
  assert.ok(tmux, 'tmux check present');
  // In this Cloud pod /exec-daemon/tmux or system tmux should resolve.
  assert.equal(tmux.ok, true, `tmux should resolve (got ${tmux.detail || tmux.path})`);
});
