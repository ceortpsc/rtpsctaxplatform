import { esc } from '../layout.mjs';
import { probeServices } from '../status.mjs';

export default {
  route: '/status',
  title: 'Status',
  description: 'Live health of the RTPSC platform services.',

  async getServerData() {
    return { services: await probeServices() };
  },

  render(data) {
    const rows = data.services
      .map(
        (service) => `<tr>
          <td>${esc(service.name)}</td>
          <td><code>:${esc(service.port)}</code></td>
          <td><span class="pill ${service.healthy ? 'pill-active' : 'pill-suspended'}">${service.healthy ? 'healthy' : 'unreachable'}</span></td>
        </tr>`
      )
      .join('\n          ');

    const healthy = data.services.filter((service) => service.healthy).length;

    return `      <section class="page-head">
        <h1>System status</h1>
        <p class="lede">${esc(healthy)} of ${esc(data.services.length)} services reachable from this portal.</p>
        <a class="ghost-btn" href="/status">Refresh</a>
      </section>
      <section class="panel">
        <table class="data-table">
          <thead><tr><th>Service</th><th>Port</th><th>Health</th></tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table>
      </section>`;
  }
};
