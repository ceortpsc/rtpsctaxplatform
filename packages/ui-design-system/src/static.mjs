import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendJson } from '../../platform-core/src/index.mjs';

const PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESIGN_SYSTEM_PUBLIC = path.join(PACKAGE_ROOT, 'public');
export const DESIGN_SYSTEM_PREFIX = '/rtp-design';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

/**
 * Serve design-system static assets from @rtp/ui-design-system/public.
 * Mount at DESIGN_SYSTEM_PREFIX (default /rtp-design/*).
 */
export function serveDesignSystemAsset(response, requestPath) {
  if (!requestPath.startsWith(DESIGN_SYSTEM_PREFIX)) return false;

  let decoded;
  try {
    decoded = decodeURIComponent(requestPath.slice(DESIGN_SYSTEM_PREFIX.length).split('?')[0]);
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
    sendJson(response, 404, { error: 'not_found', path: requestPath });
    return true;
  }

  response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream' });
  fs.createReadStream(absolute).pipe(response);
  return true;
}

/** Stylesheet link tags for standard RTPSC operator pages. */
export function designSystemStylesheets() {
  return [
    `${DESIGN_SYSTEM_PREFIX}/theme.css`,
    `${DESIGN_SYSTEM_PREFIX}/components.css`,
    `${DESIGN_SYSTEM_PREFIX}/shell.css`
  ];
}
