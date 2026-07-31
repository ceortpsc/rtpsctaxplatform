import { esc } from '../layout.mjs';
import { DOC_LINKS } from '../content.mjs';

export default {
  route: '/docs',
  title: 'Docs',
  description: 'Documentation for the RTPSC tax platform.',

  render() {
    const links = DOC_LINKS.map(
      (doc) => `<li><a href="${esc(doc.href)}">${esc(doc.title)}</a></li>`
    ).join('\n          ');

    return `      <section class="page-head">
        <h1>Documentation</h1>
        <p class="lede">Architecture, API surface, engineering standards, and operations.</p>
      </section>
      <section class="panel">
        <ul class="link-list">
          ${links}
        </ul>
        <p class="muted small">Machine-readable surfaces:
          <a href="/sitemap.xml">/sitemap.xml</a>,
          <a href="/feed.xml">/feed.xml</a>,
          <a href="/robots.txt">/robots.txt</a>,
          <a href="/opensearch.xml">/opensearch.xml</a>.
        </p>
      </section>`;
  }
};
