import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentDispositionFor,
  contentTypeFor,
  sendJson,
  wantsDownload
} from '../../platform-core/src/index.mjs';

const PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESIGN_SYSTEM_PUBLIC = path.join(PACKAGE_ROOT, 'public');
export const DESIGN_SYSTEM_PREFIX = '/rtp-design';

/**
 * Serve design-system static assets from @rtp/ui-design-system/public.
 * Mount at DESIGN_SYSTEM_PREFIX (default /rtp-design/*).
 * Use `?download=1` to force Content-Disposition attachment with the real file extension.
 */
export function serveDesignSystemAsset(response, requestPath) {
  if (!requestPath.startsWith(DESIGN_SYSTEM_PREFIX)) return false;

  const original = String(requestPath);
  let decoded;
  try {
    decoded = decodeURIComponent(original.slice(DESIGN_SYSTEM_PREFIX.length).split('?')[0]);
  } catch {
    sendJson(response, 400, { error: 'bad_request', message: 'Malformed URL encoding' });
    return true;
  }

  const relative = decoded === '' || decoded === '/' ? 'theme.css' : decoded.replace(/^\/+/, '');
  const absolute = path.join(DESIGN_SYSTEM_PUBLIC, relative);
  const resolvedRoot = path.resolve(DESIGN_SYSTEM_PUBLIC);

  if (!path.resolve(absolute).startsWith(resolvedRoot)) {
    sendJson(response, 403, { error: 'forbidden' });
    return true;
  }

  if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
    sendJson(response, 404, { error: 'not_found', path: requestPath.split('?')[0] });
    return true;
  }

  const download = wantsDownload(original);
  response.writeHead(200, {
    'content-type': contentTypeFor(absolute),
    'content-disposition': contentDispositionFor(absolute, { download })
  });
  fs.createReadStream(absolute).pipe(response);
  return true;
}

/** Stylesheet link tags for standard RTPSC operator pages. */
export function designSystemStylesheets() {
  return [
    `${DESIGN_SYSTEM_PREFIX}/theme.css`,
    `${DESIGN_SYSTEM_PREFIX}/components.css`,
    `${DESIGN_SYSTEM_PREFIX}/shell.css`,
    `${DESIGN_SYSTEM_PREFIX}/brand/brand.css`
  ];
}

/** Brand logo download catalog (extensions required for Save-As / attachment). */
export function listBrandLogoDownloads() {
  const logosDir = path.join(DESIGN_SYSTEM_PUBLIC, 'brand/logos');
  if (!fs.existsSync(logosDir)) return [];
  const allowed = new Set(['.svg', '.png', '.ico', '.jpg', '.jpeg', '.webp', '.gif']);
  return fs
    .readdirSync(logosDir)
    .filter((name) => allowed.has(path.extname(name).toLowerCase()))
    .sort()
    .map((name) => {
      const ext = path.extname(name).toLowerCase();
      return {
        name,
        ext,
        contentType: contentTypeFor(name),
        href: `${DESIGN_SYSTEM_PREFIX}/brand/logos/${name}`,
        downloadHref: `${DESIGN_SYSTEM_PREFIX}/brand/logos/${name}?download=1`,
        download: name
      };
    });
}
