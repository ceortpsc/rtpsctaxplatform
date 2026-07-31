import test from 'node:test';
import assert from 'node:assert/strict';
import { describeApiSurface, compareSemver, createMcpServer } from '../tools/ross-infinite/src/index.mjs';
import { loadOwnershipConfig } from '../tools/ross-infinite/src/seo/ownership.mjs';

test('ross-infinite API surface is wired into the monorepo', () => {
  const surface = describeApiSurface();
  assert.equal(surface.package, '@rtp/ross-infinite');
  assert.ok(surface.commands.includes('seo'));
  assert.ok(compareSemver('1.0.1', '1.0.0') > 0);
});

test('platform ownership config loads from repo root', async () => {
  const { config } = await loadOwnershipConfig(process.cwd());
  assert.equal(config.owner.ownerName, 'Condre Dvon Ross');
  assert.equal(config.owner.ownerAssertion, true);
});

test('MCP server advertises ROSS.CO Infinite', () => {
  const mcp = createMcpServer();
  const init = mcp.handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'platform', version: '0' } }
  });
  assert.match(init.result.serverInfo.name, /ROSS\.CO Infinite/);
});
