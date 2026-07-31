// Next.js-style file-based page router (dependency-free).
// Convention: each *.page.mjs module exports { route, title, description, getServerData?, render }.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderDocument } from './layout.mjs';

export async function createRouter({ pagesDir }) {
  const entries = await readdir(pagesDir);
  const routes = new Map();
  for (const file of entries) {
    if (!file.endsWith('.page.mjs')) continue;
    const mod = await import(pathToFileURL(path.join(pagesDir, file)).href);
    const page = mod.default ?? mod.page ?? mod;
    if (!page || typeof page.route !== 'string' || typeof page.render !== 'function') {
      throw new Error(`Invalid page module "${file}" — needs { route, render }.`);
    }
    if (routes.has(page.route)) throw new Error(`Duplicate route "${page.route}" (from ${file}).`);
    routes.set(page.route, { file, ...page });
  }

  return Object.freeze({
    match(pathname) { return routes.get(pathname) ?? null; },
    list() {
      return [...routes.values()].map((page) => ({ route: page.route, title: page.title, description: page.description }));
    },
    async render(page, ctx) {
      const data = typeof page.getServerData === 'function' ? await page.getServerData(ctx) : {};
      const body = page.render(data, ctx);
      return renderDocument({
        title: page.title,
        description: page.description,
        activePath: page.route,
        body,
        session: ctx.session,
        auth: ctx.auth
      }, ctx.config);
    }
  });
}
