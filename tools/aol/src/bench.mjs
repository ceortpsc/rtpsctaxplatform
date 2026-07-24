import { spawn } from 'node:child_process';
import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { install } from './install.mjs';
import * as ui from './ui.mjs';

/**
 * Benchmark AOL install against npm install on the same monorepo.
 * Reports wall-clock and computed speedup.
 */
export async function bench(root = process.cwd(), rounds = 3) {
  console.log(ui.brandLine());
  console.log(ui.info(`Benchmarking install velocity · ${rounds} rounds`));
  console.log('');

  const aolTimes = [];
  const npmTimes = [];

  for (let i = 1; i <= rounds; i += 1) {
    await resetNodeModules(root);

    const aolMs = await time(async () => {
      await install(root, { quiet: true, force: true });
    });
    aolTimes.push(aolMs);

    await resetNodeModules(root);

    const npmMs = await time(async () => {
      await runNpmInstall(root);
    });
    npmTimes.push(npmMs);

    const ratio = npmMs / Math.max(aolMs, 0.01);
    console.log(
      `  round ${i}:  AOL ${uiMs(aolMs)}   npm ${uiMs(npmMs)}   ${ratio.toFixed(1)}×`
    );
  }

  const aolAvg = avg(aolTimes);
  const npmAvg = avg(npmTimes);
  const speedup = npmAvg / Math.max(aolAvg, 0.01);

  console.log('');
  console.log(
    ui.panel('Velocity Report', [
      `AOL avg   ${aolAvg.toFixed(1)}ms`,
      `npm avg   ${npmAvg.toFixed(1)}ms`,
      `speedup   ${speedup.toFixed(1)}× faster`,
      speedup >= 20 ? "signal locked · you've got speed." : 'keep pushing the handshake.'
    ])
  );
  console.log('');

  return { aolAvg, npmAvg, speedup, aolTimes, npmTimes };
}

async function resetNodeModules(root) {
  await rm(path.join(root, 'node_modules'), { recursive: true, force: true });
  await rm(path.join(root, 'RTPSC-package-lock.json'), { force: true });
  await rm(path.join(root, 'aol.lock.json'), { force: true });
  // Keep npm package-lock out of the tree; npm will recreate links as needed.
}

function time(fn) {
  return (async () => {
    const t0 = performance.now();
    await fn();
    return performance.now() - t0;
  })();
}

function avg(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function uiMs(ms) {
  return `${ms.toFixed(1)}ms`.padStart(10);
}

function runNpmInstall(root) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['install', '--no-fund', '--no-audit', '--silent'], {
      cwd: root,
      stdio: 'ignore',
      env: process.env
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install exited ${code}`));
    });
  });
}
