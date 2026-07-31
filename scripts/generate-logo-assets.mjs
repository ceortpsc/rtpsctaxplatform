#!/usr/bin/env node
/**
 * Generate RTPSC Signal Era brand logo raster downloads (PNG + ICO).
 * Renders the rising-signal constellation — not generic text blocks.
 * Dependency-free (Node zlib only). Safe to re-run.
 */
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const deflate = promisify(zlib.deflate);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Signal Era palette
const CLEAR = [0, 0, 0, 0];
const FIELD_TOP = [0x1a, 0x27, 0x40, 0xff];
const FIELD_BOT = [0x0b, 0x12, 0x20, 0xff];
const SIGNAL_BRIGHT = [0x4e, 0xb8, 0xd9, 0xff];
const SIGNAL = [0x1a, 0x9b, 0xc7, 0xff];
const SIGNAL_DEEP = [0x0a, 0x7e, 0xa4, 0xff];
const MIST = [0xe8, 0xee, 0xf6, 0xff];
const STEEL = [0x5b, 0x6b, 0x7c, 0xff];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

async function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = await deflate(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t)
  ];
}

function setPixel(rgba, width, height, x, y, color, alpha = 1) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= width || yi >= height) return;
  const i = (yi * width + xi) * 4;
  const a = Math.max(0, Math.min(1, (color[3] / 255) * alpha));
  if (a >= 0.99) {
    rgba[i] = color[0];
    rgba[i + 1] = color[1];
    rgba[i + 2] = color[2];
    rgba[i + 3] = 255;
    return;
  }
  const inv = 1 - a;
  rgba[i] = Math.round(rgba[i] * inv + color[0] * a);
  rgba[i + 1] = Math.round(rgba[i + 1] * inv + color[1] * a);
  rgba[i + 2] = Math.round(rgba[i + 2] * inv + color[2] * a);
  rgba[i + 3] = Math.min(255, Math.round(rgba[i + 3] + (255 - rgba[i + 3]) * a));
}

function fillRoundedRect(rgba, width, height, x0, y0, w, h, r, color) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const dx = x < x0 + r ? x0 + r - x : x >= x0 + w - r ? x - (x0 + w - 1 - r) : 0;
      const dy = y < y0 + r ? y0 + r - y : y >= y0 + h - r ? y - (y0 + h - 1 - r) : 0;
      if (dx * dx + dy * dy <= r * r + r) setPixel(rgba, width, height, x, y, color);
    }
  }
}

function strokeRoundedRect(rgba, width, height, x0, y0, w, h, r, color, thickness = 2) {
  for (let t = 0; t < thickness; t += 1) {
    const inset = t;
    const rr = Math.max(1, r - inset);
    // Approximate ring by drawing outer fill then punching inner — skip punch, draw edge samples
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      // four corners via parametric is heavy; use distance field ring instead below
    }
  }
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const lx = x - x0;
      const ly = y - y0;
      const cx = Math.max(r, Math.min(lx, w - 1 - r));
      const cy = Math.max(r, Math.min(ly, h - 1 - r));
      const dx = lx - cx;
      const dy = ly - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const edge = Math.abs(dist - r);
      const onStraight =
        (ly <= r || ly >= h - 1 - r || lx <= r || lx >= w - 1 - r) &&
        dist <= r + 0.5;
      if (dist <= r + thickness && dist >= r - 0.2) {
        setPixel(rgba, width, height, x, y, color, 1);
      } else if (
        (Math.abs(lx) < thickness || Math.abs(lx - (w - 1)) < thickness) &&
        ly >= r &&
        ly <= h - 1 - r
      ) {
        setPixel(rgba, width, height, x, y, color);
      } else if (
        (Math.abs(ly) < thickness || Math.abs(ly - (h - 1)) < thickness) &&
        lx >= r &&
        lx <= w - 1 - r
      ) {
        setPixel(rgba, width, height, x, y, color);
      } else if (edge < thickness && dist >= r - thickness) {
        setPixel(rgba, width, height, x, y, color, Math.max(0, 1 - edge / thickness));
      }
      void onStraight;
    }
  }
}

function fillCircle(rgba, width, height, cx, cy, r, color, alpha = 1) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y += 1) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x += 1) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d <= r2) setPixel(rgba, width, height, x, y, color, alpha);
      else if (d <= (r + 0.8) * (r + 0.8)) {
        const soft = 1 - (Math.sqrt(d) - r);
        setPixel(rgba, width, height, x, y, color, alpha * Math.max(0, soft));
      }
    }
  }
}

function strokeCircle(rgba, width, height, cx, cy, r, color, thickness = 1.2, alpha = 1) {
  for (let y = Math.floor(cy - r - thickness - 1); y <= Math.ceil(cy + r + thickness + 1); y += 1) {
    for (let x = Math.floor(cx - r - thickness - 1); x <= Math.ceil(cx + r + thickness + 1); x += 1) {
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      const edge = Math.abs(d - r);
      if (edge <= thickness) setPixel(rgba, width, height, x, y, color, alpha * (1 - edge / (thickness + 0.01)));
    }
  }
}

function drawLine(rgba, width, height, x0, y0, x1, y1, color, thickness = 2) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    fillCircle(rgba, width, height, x, y, thickness / 2, color);
  }
}

function fillGradientChassis(rgba, size) {
  const pad = Math.round(size * 0.03);
  const r = Math.round(size * 0.22);
  for (let y = pad; y < size - pad; y += 1) {
    const ty = (y - pad) / (size - pad * 2 - 1);
    const rowColor = mix(FIELD_TOP, FIELD_BOT, ty);
    for (let x = pad; x < size - pad; x += 1) {
      const lx = x - pad;
      const ly = y - pad;
      const w = size - pad * 2;
      const h = size - pad * 2;
      const cx = Math.max(r, Math.min(lx, w - 1 - r));
      const cy = Math.max(r, Math.min(ly, h - 1 - r));
      const dx = lx - cx;
      const dy = ly - cy;
      if (dx * dx + dy * dy <= r * r + r) setPixel(rgba, size, size, x, y, rowColor);
    }
  }
  // signal stroke ring
  strokeRoundedRect(rgba, size, size, pad, pad, size - pad * 2, size - pad * 2, r, SIGNAL, Math.max(2, Math.round(size * 0.03)));
  // inner hairline
  const inset = Math.round(size * 0.1);
  strokeRoundedRect(
    rgba,
    size,
    size,
    inset,
    inset,
    size - inset * 2,
    size - inset * 2,
    Math.round(size * 0.17),
    SIGNAL,
    1
  );
  // soften inner ring
  for (let y = inset; y < size - inset; y += 1) {
    for (let x = inset; x < size - inset; x += 1) {
      // noop — stroke already applied
    }
  }
}

/** Rising signal constellation matching the SVG monogram / emblem. */
function renderSignalMonogram(size) {
  const rgba = Buffer.alloc(size * size * 4);
  fillGradientChassis(rgba, size);

  const nodes = [
    { x: 0.25, y: 0.7, r: 0.045 },
    { x: 0.4, y: 0.45, r: 0.05 },
    { x: 0.53, y: 0.58, r: 0.042 },
    { x: 0.75, y: 0.28, r: 0.058 }
  ].map((n) => ({ x: n.x * size, y: n.y * size, r: n.r * size }));

  const thickness = Math.max(1.6, size * 0.035);
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const color = mix(SIGNAL_DEEP, SIGNAL_BRIGHT, i / (nodes.length - 1));
    drawLine(rgba, size, size, a.x, a.y, b.x, b.y, color, thickness);
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    fillCircle(rgba, size, size, n.x, n.y, n.r, SIGNAL_BRIGHT);
    if (i === nodes.length - 1) {
      strokeCircle(rgba, size, size, n.x, n.y, n.r * 1.85, SIGNAL_BRIGHT, Math.max(1, size * 0.015), 0.55);
    }
  }
  return rgba;
}

function renderWordmarkBanner(width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  // mist background
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = MIST[0];
    rgba[i + 1] = MIST[1];
    rgba[i + 2] = MIST[2];
    rgba[i + 3] = 255;
  }
  const mark = Math.min(height - 8, 56);
  const markRgba = renderSignalMonogram(mark);
  const ox = 4;
  const oy = Math.round((height - mark) / 2);
  for (let y = 0; y < mark; y += 1) {
    for (let x = 0; x < mark; x += 1) {
      const si = (y * mark + x) * 4;
      if (markRgba[si + 3] < 8) continue;
      setPixel(rgba, width, height, ox + x, oy + y, [
        markRgba[si],
        markRgba[si + 1],
        markRgba[si + 2],
        markRgba[si + 3]
      ]);
    }
  }
  // Typographic bars standing in for RTPSC (vector SVG carries real type; raster is mark-led)
  const tx = ox + mark + 14;
  const barH = Math.max(4, Math.round(height * 0.12));
  const letterGaps = [0, 18, 34, 52, 68];
  const letterWidths = [14, 12, 14, 12, 14];
  for (let i = 0; i < 5; i += 1) {
    const color = mix(SIGNAL_DEEP, FIELD_BOT, i / 4);
    for (let y = Math.round(height * 0.28); y < Math.round(height * 0.28) + Math.round(height * 0.32); y += 1) {
      for (let x = tx + letterGaps[i]; x < tx + letterGaps[i] + letterWidths[i]; x += 1) {
        setPixel(rgba, width, height, x, y, color);
      }
    }
  }
  // subtitle rule
  for (let x = tx; x < tx + 160; x += 1) {
    for (let y = 0; y < 2; y += 1) {
      setPixel(rgba, width, height, x, Math.round(height * 0.72) + y, STEEL, 0.7);
    }
  }
  void barH;
  return { width, height, rgba };
}

function encodeIcoWithPng(pngBuffer, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = width >= 256 ? 0 : width;
  entry[1] = height >= 256 ? 0 : height;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

async function writePngIco(outDir, baseName, size) {
  const rgba = renderSignalMonogram(size);
  const png = await encodePng(size, size, rgba);
  await writeFile(path.join(outDir, `${baseName}.png`), png);
  const fav = size === 32 ? png : await encodePng(32, 32, renderSignalMonogram(32));
  await writeFile(path.join(outDir, `${baseName}.ico`), encodeIcoWithPng(fav, 32, 32));
  return createHash('sha256').update(png).digest('hex').slice(0, 12);
}

async function main() {
  const assetLogos = path.join(root, 'assets/logos');
  const designLogos = path.join(root, 'packages/ui-design-system/public/brand/logos');
  await mkdir(assetLogos, { recursive: true });
  await mkdir(designLogos, { recursive: true });

  const svgSources = [
    ['packages/ui-design-system/public/brand/logos/monogram.svg', 'rtpsc-monogram.svg'],
    ['packages/ui-design-system/public/brand/logos/wordmark.svg', 'rtpsc-wordmark.svg'],
    ['packages/ui-design-system/public/brand/logos/lockup-stacked.svg', 'rtpsc-lockup-stacked.svg'],
    ['packages/ui-design-system/public/assets/emblem.svg', 'rtpsc-emblem.svg']
  ];
  for (const [src, dest] of svgSources) {
    await copyFile(path.join(root, src), path.join(assetLogos, dest));
  }

  const sha = await writePngIco(assetLogos, 'rtpsc-monogram', 128);
  await writePngIco(assetLogos, 'rtpsc-emblem-mark', 128);
  const favRgba = renderSignalMonogram(32);
  const favPng = await encodePng(32, 32, favRgba);
  await writeFile(path.join(assetLogos, 'rtpsc-favicon.png'), favPng);
  await writeFile(path.join(assetLogos, 'rtpsc-favicon.ico'), encodeIcoWithPng(favPng, 32, 32));

  const banner = renderWordmarkBanner(420, 72);
  await writeFile(path.join(assetLogos, 'rtpsc-wordmark.png'), await encodePng(banner.width, banner.height, banner.rgba));

  // 256 master mark for print/docs
  await writeFile(
    path.join(assetLogos, 'rtpsc-monogram-256.png'),
    await encodePng(256, 256, renderSignalMonogram(256))
  );

  const mirror = [
    'rtpsc-monogram.svg',
    'rtpsc-wordmark.svg',
    'rtpsc-lockup-stacked.svg',
    'rtpsc-emblem.svg',
    'rtpsc-monogram.png',
    'rtpsc-monogram.ico',
    'rtpsc-monogram-256.png',
    'rtpsc-wordmark.png',
    'rtpsc-favicon.png',
    'rtpsc-favicon.ico',
    'rtpsc-emblem-mark.png',
    'rtpsc-emblem-mark.ico'
  ];
  for (const file of mirror) {
    await copyFile(path.join(assetLogos, file), path.join(designLogos, file));
  }

  await copyFile(path.join(assetLogos, 'rtpsc-monogram.svg'), path.join(designLogos, 'monogram.svg'));
  await copyFile(path.join(assetLogos, 'rtpsc-wordmark.svg'), path.join(designLogos, 'wordmark.svg'));
  await copyFile(path.join(assetLogos, 'rtpsc-lockup-stacked.svg'), path.join(designLogos, 'lockup-stacked.svg'));
  await copyFile(path.join(assetLogos, 'rtpsc-monogram.png'), path.join(designLogos, 'monogram.png'));
  await copyFile(path.join(assetLogos, 'rtpsc-monogram.ico'), path.join(designLogos, 'monogram.ico'));
  await copyFile(path.join(assetLogos, 'rtpsc-wordmark.png'), path.join(designLogos, 'wordmark.png'));

  const files = readdirSync(assetLogos).filter((f) => !f.endsWith('.md') && f !== 'manifest.json').sort();
  const manifest = {
    product: 'RTPSC',
    kind: 'brand-logo-assets',
    motif: 'signal-era-constellation',
    generatedAt: new Date().toISOString(),
    extensions: ['.svg', '.png', '.ico'],
    files,
    monogramPngSha12: sha
  };
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(assetLogos, 'manifest.json'), body);
  await writeFile(path.join(designLogos, 'manifest.json'), body);
  console.log(`Signal Era logo assets → assets/logos (${files.length} files)`);
  console.log(`Motif: rising-signal constellation · extensions: ${manifest.extensions.join(', ')}`);
}

await main();
