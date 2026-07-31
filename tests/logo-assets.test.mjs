import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentDispositionFor,
  contentTypeFor,
  wantsDownload
} from '../packages/platform-core/src/index.mjs';
import {
  listBrandLogoDownloads,
  serveDesignSystemAsset,
  DESIGN_SYSTEM_PUBLIC
} from '../packages/ui-design-system/src/static.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('logo asset files exist with required download extensions', () => {
  const required = [
    'assets/logos/rtpsc-monogram.svg',
    'assets/logos/rtpsc-monogram.png',
    'assets/logos/rtpsc-monogram.ico',
    'assets/logos/rtpsc-monogram-256.png',
    'assets/logos/rtpsc-wordmark.svg',
    'assets/logos/rtpsc-wordmark.png',
    'assets/logos/rtpsc-lockup-stacked.svg',
    'assets/logos/rtpsc-favicon.png',
    'assets/logos/rtpsc-favicon.ico',
    'assets/logos/manifest.json',
    'packages/ui-design-system/public/brand/logos/rtpsc-monogram.png',
    'packages/ui-design-system/public/brand/logos/monogram.ico',
    'packages/ui-design-system/public/brand/brand.css'
  ];
  for (const rel of required) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }
  const png = readFileSync(path.join(root, 'assets/logos/rtpsc-monogram.png'));
  assert.equal(png[0], 0x89);
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.ok(png.length > 400, 'signal monogram PNG should be richer than a flat tile');
  const ico = readFileSync(path.join(root, 'assets/logos/rtpsc-favicon.ico'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const manifest = JSON.parse(readFileSync(path.join(root, 'assets/logos/manifest.json'), 'utf8'));
  assert.equal(manifest.motif, 'signal-era-constellation');
  const monoSvg = readFileSync(path.join(root, 'assets/logos/rtpsc-monogram.svg'), 'utf8');
  assert.match(monoSvg, /circle cx="48"/);
  assert.doesNotMatch(monoSvg, />RTP</);
});

test('contentTypeFor maps logo download extensions', () => {
  assert.equal(contentTypeFor('x.svg'), 'image/svg+xml');
  assert.equal(contentTypeFor('x.png'), 'image/png');
  assert.equal(contentTypeFor('x.jpg'), 'image/jpeg');
  assert.equal(contentTypeFor('x.jpeg'), 'image/jpeg');
  assert.equal(contentTypeFor('x.gif'), 'image/gif');
  assert.equal(contentTypeFor('x.webp'), 'image/webp');
  assert.equal(contentTypeFor('x.ico'), 'image/x-icon');
});

test('wantsDownload and contentDisposition preserve filename extensions', () => {
  assert.equal(wantsDownload('/brand/logos/a.png'), false);
  assert.equal(wantsDownload('/brand/logos/a.png?download=1'), true);
  assert.equal(wantsDownload('/brand/logos/a.svg?download=true'), true);
  assert.equal(wantsDownload('/brand/logos/a.ico?attachment'), true);
  const disp = contentDispositionFor('/tmp/rtpsc-monogram.png', { download: true });
  assert.match(disp, /^attachment;/);
  assert.match(disp, /filename="rtpsc-monogram\.png"/);
  assert.match(disp, /filename\*=UTF-8''rtpsc-monogram\.png/);
});

test('listBrandLogoDownloads exposes svg/png/ico hrefs with download query', () => {
  const list = listBrandLogoDownloads();
  assert.ok(list.length >= 6);
  const exts = new Set(list.map((item) => item.ext));
  assert.ok(exts.has('.svg'));
  assert.ok(exts.has('.png'));
  assert.ok(exts.has('.ico'));
  for (const item of list) {
    assert.match(item.href, /^\/rtp-design\/brand\/logos\//);
    assert.match(item.downloadHref, /\?download=1$/);
    assert.equal(item.download, item.name);
    assert.ok(item.name.endsWith(item.ext));
  }
});

test('design-system logo download response keeps Content-Type and filename extension', async () => {
  const server = http.createServer((req, res) => {
    const handled = serveDesignSystemAsset(res, req.url);
    if (!handled) {
      res.writeHead(404);
      res.end('no');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/rtp-design/brand/logos/rtpsc-monogram.png?download=1`
    );
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /image\/png/);
    const disposition = res.headers.get('content-disposition') || '';
    assert.match(disposition, /attachment/);
    assert.match(disposition, /rtpsc-monogram\.png/);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf[0], 0x89);
    assert.ok(existsSync(path.join(DESIGN_SYSTEM_PUBLIC, 'brand/logos/rtpsc-monogram.png')));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
