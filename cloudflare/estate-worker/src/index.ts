import manifest from '../repositories.json';

export interface Env {
  ESTATE_NAME?: string;
  ORIGIN_BASE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

    if (url.pathname === '/__ross/health') {
      return new Response(JSON.stringify({
        ok: true,
        service: env.ESTATE_NAME || 'Ross Cloudflare Worker Estate Gateway',
        owner: manifest.owner,
        repositoryCount: manifest.repositories.length,
        generated: manifest.generated
      }), { status: 200, headers });
    }

    if (url.pathname === '/__ross/repositories') {
      return new Response(JSON.stringify({ owner: manifest.owner, repositories: manifest.repositories }), { status: 200, headers });
    }

    if (url.pathname === '/__ross/provider') {
      return new Response(JSON.stringify({
        platform: 'Cloudflare Workers',
        sourceControl: 'GitHub',
        repository: 'ceortpsc/rtpsctaxplatform',
        secretsInSource: false,
        trafficProxyEnabled: Boolean(env.ORIGIN_BASE)
      }), { status: 200, headers });
    }

    if (env.ORIGIN_BASE) {
      const origin = new URL(env.ORIGIN_BASE);
      origin.pathname = url.pathname;
      origin.search = url.search;
      const next = new Request(origin.toString(), request);
      return fetch(next);
    }

    return new Response(JSON.stringify({
      error: 'ROUTE_NOT_CONFIGURED',
      message: 'Estate gateway is healthy, but no ORIGIN_BASE has been configured for application traffic.'
    }), { status: 503, headers });
  }
};
