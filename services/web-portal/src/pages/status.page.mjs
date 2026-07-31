import { esc } from '../layout.mjs';
import { pageIntro, workspacePanel } from '../presentations.mjs';
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

    return `${pageIntro({
      title: 'System status',
      lede: `${esc(healthy)} of ${esc(data.services.length)} services reachable from this portal.`,
      actions: '<a class="ghost-btn" href="/status">Refresh</a>'
    })}
${workspacePanel({
  body: `<table class="data-table">
          <thead><tr><th>Service</th><th>Port</th><th>Health</th></tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table>`
})}`;
  }
};
