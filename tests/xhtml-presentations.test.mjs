import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageIntro, featureRows, accessBand } from '../services/web-portal/src/presentations.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('presentation helpers emit well-formed XHTML fragments', () => {
  const intro = pageIntro({ title: 'Platform <rollout>', lede: 'Signal-clear stack.' });
  assert.match(intro, /page-intro/);
  assert.match(intro, /Platform &lt;rollout&gt;/);
  assert.doesNotMatch(intro, /Platform <rollout>/);

  const rows = featureRows([{ title: 'Refund & Center', body: 'Timeline <events>' }]);
  assert.match(rows, /feature-list/);
  assert.match(rows, /Refund &amp; Center/);
  assert.match(rows, /Timeline &lt;events&gt;/);

  const band = accessBand({ title: 'Live', lede: 'Probe services.', actions: '<a class="cta-btn" href="/status">Go</a>' });
  assert.match(band, /access-band/);
  assert.match(band, /cta-btn/);
});

test('approved XHTML fixtures exist and stay Signal Era', () => {
  for (const file of ['signal-era-shell.xhtml', 'signal-era-hero.xhtml']) {
    const abs = path.join(root, 'assets/xhtml', file);
    assert.ok(fs.existsSync(abs), `${file} missing`);
    const xml = fs.readFileSync(abs, 'utf8');
    assert.ok(xml.startsWith('<?xml'));
    assert.match(xml, /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    assert.doesNotMatch(xml, /Iowan|Palatino|#b8860b|#d4af37/i);
  }
});
