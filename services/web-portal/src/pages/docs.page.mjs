import { esc } from '../layout.mjs';
import { pageIntro, workspacePanel } from '../presentations.mjs';
import { DOC_LINKS } from '../content.mjs';

export default {
  route: '/docs',
  title: 'Docs',
  description: 'Documentation and machine-readable XML surfaces for the RTPSC platform.',

  render() {
    const links = DOC_LINKS.map(
      (doc) => `<li><a href="${esc(doc.href)}">${esc(doc.title)}</a></li>`
    ).join('\n          ');

    return `${pageIntro({
      title: 'Documentation',
      lede: 'Architecture, API surface, engineering standards, and Signal Era presentation guidance.'
    })}
${workspacePanel({
  body: `<ul class="link-list">
          ${links}
        </ul>
        <p class="muted small">Machine-readable XML surfaces:
          <a href="/sitemap.xml">/sitemap.xml</a>,
          <a href="/feed.xml">/feed.xml</a>,
          <a href="/robots.txt">/robots.txt</a>,
          <a href="/opensearch.xml">/opensearch.xml</a>.
        </p>`
})}`;
  }
};
