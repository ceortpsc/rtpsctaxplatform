import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

/**
 * Self-contained MCP JSON-RPC stdio server (no external SDK).
 * Targets MCP initialize / tools/list / tools/call lifecycle shape.
 */
export const TOOLS = [
  {
    name: 'ross_hash',
    description: 'Return SHA-256 digest of provided text',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    }
  },
  {
    name: 'ross_resolve_info',
    description: 'Describe ROSS.CO Infinite resolver capabilities',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'ross_seo_status',
    description: 'Summarize SEO ownership evidence states',
    inputSchema: { type: 'object', properties: {} }
  }
];

export function createMcpServer({ product = 'ROSS.CO Infinite MCP', version = '1.0.0' } = {}) {
  function handleMessage(message) {
    if (!message || typeof message !== 'object') return null;
    const { id, method, params } = message;

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion || '2025-11-25',
          capabilities: { tools: {} },
          serverInfo: { name: product, version }
        }
      };
    }

    if (method === 'notifications/initialized' || method === 'initialized') return null;

    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    }

    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      if (name === 'ross_hash') {
        const digest = createHash('sha256').update(String(args.text ?? '')).digest('hex');
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `sha256:${digest}` }] } };
      }
      if (name === 'ross_resolve_info') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  resolver: 'deterministic-semver',
                  lockfile: 'ross.lock.json',
                  store: 'content-addressed-sha256'
                })
              }
            ]
          }
        };
      }
      if (name === 'ross_seo_status') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  pipeline: [
                    'ASSERTED',
                    'PREVALIDATED',
                    'DEPLOYED',
                    'PROVIDER_VERIFIED',
                    'INDEXING_ENABLED',
                    'INDEXED'
                  ],
                  note: 'Provider verification requires live DNS/token confirmation.'
                })
              }
            ]
          }
        };
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
    }

    if (id === undefined) return null;
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }

  async function listenStdio() {
    const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      const response = handleMessage(message);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  }

  return { handleMessage, listenStdio, tools: TOOLS };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const server = createMcpServer();
  await server.listenStdio();
}
