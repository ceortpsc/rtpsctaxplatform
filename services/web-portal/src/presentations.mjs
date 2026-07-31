// Signal Era XHTML presentation primitives for the public portal.
// All dynamic text must pass through esc() before interpolation.

import { esc } from './layout.mjs';

/** Brand-forward page intro (inner routes — not the full-bleed home hero). */
export function pageIntro({ title, lede, actions = '' }) {
  return `      <section class="page-intro" aria-label="Page introduction">
        <h1>${esc(title)}</h1>
        ${lede ? `<p class="lede">${lede}</p>` : ''}
        ${actions ? `<div class="hero-cta">${actions}</div>` : ''}
      </section>`;
}

/** Single-purpose section band with one headline + optional supporting line. */
export function sectionBand({ title, lede = '', body = '', label = '' }) {
  const aria = label ? ` aria-label="${esc(label)}"` : '';
  return `      <section class="section-band"${aria}>
        <h2>${esc(title)}</h2>
        ${lede ? `<p>${lede}</p>` : ''}
        ${body}
      </section>`;
}

/** Signal-trim feature rows (no card chrome). */
export function featureRows(items = []) {
  const rows = items
    .map(
      (item) => `<li>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.body)}</p>
          ${item.meta ? `<p class="card-meta">${item.meta}</p>` : ''}
        </li>`
    )
    .join('\n          ');
  return `<ul class="feature-list">${rows}</ul>`;
}

/** Workspace panel for authenticated / interactive surfaces. */
export function workspacePanel({ title = '', body = '', wide = true } = {}) {
  const cls = wide ? 'panel' : 'form-card';
  return `      <section class="${cls}">
        ${title ? `<h2>${esc(title)}</h2>` : ''}
        ${body}
      </section>`;
}

/** Access / CTA band (secondary viewport, never overlays hero media). */
export function accessBand({ title, lede, actions = '' }) {
  return `      <section class="access-band">
        <h2>${esc(title)}</h2>
        ${lede ? `<p>${lede}</p>` : ''}
        ${actions}
      </section>`;
}
