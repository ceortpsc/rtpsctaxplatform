import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { designSystemStylesheets, DESIGN_SYSTEM_PUBLIC } from '../packages/ui-design-system/src/static.mjs';

test('ui cosmetics: shared stylesheet is mounted after core shell styles', () => {
  const styles = designSystemStylesheets();
  assert.deepEqual(styles.slice(-2), ['/rtp-design/shell.css', '/rtp-design/cosmetics.css']);
  assert.equal(new Set(styles).size, styles.length);
});

test('ui cosmetics: asset contains required accessibility and presentation contracts', () => {
  const cssPath = path.join(DESIGN_SYSTEM_PUBLIC, 'cosmetics.css');
  assert.equal(fs.existsSync(cssPath), true);
  const css = fs.readFileSync(cssPath, 'utf8');
  for (const token of [
    'data-density="compact"',
    'data-contrast="high"',
    'prefers-reduced-transparency',
    '@media print',
    '[data-rtp-reveal]',
    '.rtp-status-rail',
    '.rtp-skeleton'
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('ui cosmetics: shell exposes cosmetic preference functions', () => {
  const shell = fs.readFileSync(path.join(DESIGN_SYSTEM_PUBLIC, 'shell.js'), 'utf8');
  for (const name of ['applyDensity', 'applyContrast', 'applyMotion']) assert.match(shell, new RegExp(name));
  assert.match(shell, /rtp\.cosmetics\.density/);
  assert.match(shell, /IntersectionObserver/);
});
