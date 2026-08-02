# Logo Assets — Signal Era

Approved **Ross Tax Pro Software Co (RTPSC)** brand marks. Motif: a **rising-signal
constellation** on a graphite chassis (not generic letter tiles).

## Extensions (required for download / Save As)

| Extension | MIME | Use |
|-----------|------|-----|
| `.svg` | `image/svg+xml` | Primary vector logo |
| `.png` | `image/png` | Raster download / embeds |
| `.ico` | `image/x-icon` | Favicon / shortcuts |

```bash
node scripts/generate-logo-assets.mjs
# or: pnpm run logos:generate
```

## Files

| File | Description |
|------|-------------|
| `rtpsc-monogram.svg` / `.png` / `.ico` | Signal constellation app mark |
| `rtpsc-monogram-256.png` | Print/master raster |
| `rtpsc-wordmark.svg` / `.png` | Mark + RTPSC + company name |
| `rtpsc-lockup-stacked.svg` | Centered cover lockup |
| `rtpsc-emblem.svg` | Full Signal Era emblem |
| `rtpsc-favicon.png` / `.ico` | 32×32 favicon |
| `manifest.json` | Generated inventory (`motif: signal-era-constellation`) |

Served at `/rtp-design/brand/logos/*` and presented via `/rtp-design/brand/brand.css`.

## Download

```
/rtp-design/brand/logos/rtpsc-monogram.png?download=1
/rtp-design/brand/logos/rtpsc-monogram.svg?download=1
/rtp-design/brand/logos/rtpsc-favicon.ico?download=1
```

`?download=1` sets `Content-Disposition: attachment` **with the filename extension preserved**.
