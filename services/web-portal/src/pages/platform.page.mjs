import { esc } from '../layout.mjs';
import { FEATURES } from '../content.mjs';

export default {
  route: '/platform',
  title: 'Platform',
  description: 'Every operator surface in the RTPSC tax platform, in one place.',

  render() {
    const cards = FEATURES.map(
      (feature) => `<article class="card">
          <h3>${esc(feature.title)}</h3>
          <p>${esc(feature.body)}</p>
          <p class="card-meta"><code>${esc(feature.service)}</code> · port ${esc(feature.port)}</p>
        </article>`
    ).join('\n        ');

    return `      <section class="page-head">
        <h1>Platform surfaces</h1>
        <p class="lede">Independent services, one identity. Each surface runs on its own port
        and shares the platform's compliance boundaries.</p>
      </section>
      <section class="cards">
        ${cards}
      </section>
      <section class="callout">
        <h2>Live health</h2>
        <p>Check which services are currently reachable from this portal.</p>
        <a class="cta-btn" href="/status">View system status</a>
      </section>`;
  }
};
