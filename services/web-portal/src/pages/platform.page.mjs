import { esc } from '../layout.mjs';
import { accessBand, featureRows, pageIntro } from '../presentations.mjs';
import { FEATURES } from '../content.mjs';

export default {
  route: '/platform',
  title: 'Platform',
  description: 'Signal Era rollout of every RTPSC operator surface — transmission-ready presentation stack.',

  render() {
    const rows = featureRows(
      FEATURES.map((feature) => ({
        title: feature.title,
        body: feature.body,
        meta: `<code>${esc(feature.service)}</code> · port ${esc(feature.port)}`
      }))
    );

    return `${pageIntro({
      title: 'Platform rollout',
      lede: 'Independent services, one Signal Era identity. Each surface runs on its own port and shares the platform compliance boundary.'
    })}
      <section class="section-band" aria-label="Operator surfaces">
        <h2>Operator surfaces in transmission</h2>
        <p>New-era tech presentations for refund, invoice, POS, enrollment, gateway, and module catalog consoles.</p>
        ${rows}
      </section>
${accessBand({
  title: 'Live health',
  lede: 'Probe which services are reachable from this XHTML portal right now.',
  actions: '<a class="cta-btn" href="/status">View system status</a>'
})}`;
  }
};
