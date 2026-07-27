// Next.js-style file-based page router (dependency-free).
//
// Convention: each file in src/pages named "<name>.page.mjs" exports a page
// module: { route, title, description, getServerData?, render(data, ctx) }.
// The router discovers them at startup (like Next.js "pages/"), then maps a
// request pathname to a page and renders it through the XHTML layout.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderDocument } from './layout.mjs';

/**
 * Build a router by scanning a pages directory for *.page.mjs modules.
 * @param {object} options
 * @param {string} options.pagesDir  Absolute path to the pages directory.
 */
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
    if (routes.has(page.route)) {
      throw new Error(`Duplicate route "${page.route}" (from ${file}).`);
    }
    routes.set(page.route, { file, ...page });
  }

  return Object.freeze({
    /** Return the page for a pathname, or null. */
    match(pathname) {
      return routes.get(pathname) ?? null;
    },

    /** All registered routes (for sitemap generation). */
    list() {
      return [...routes.values()].map((page) => ({
        route: page.route,
        title: page.title,
        description: page.description
      }));
    },

    /**
     * Render a page to a full XHTML document.
     * @param {object} page   A matched page.
     * @param {object} ctx    { url, config, session, services }.
     */
    async render(page, ctx) {
      const data = typeof page.getServerData === 'function' ? await page.getServerData(ctx) : {};
      const body = page.render(data, ctx);
      return renderDocument(
        {
          title: page.title,
          description: page.description,
          activePath: page.route,
          body
        },
        ctx.config
      );
    }
  });
}
