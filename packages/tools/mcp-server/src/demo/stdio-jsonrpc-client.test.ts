/**
 * packages/tools/mcp-server/src/demo/stdio-jsonrpc-client.test.ts
 * TDD: Minimal JSON-RPC client over MCP stdio (newline-delimited JSON).
 */
import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from '../manifest/capabilities.js';
import { runMcpStdioServer } from '../mcp/stdio-server.js';
import { createStdioJsonRpcClient } from './stdio-jsonrpc-client.js';

describe('createStdioJsonRpcClient', () => {
  it('can initialize, list tools, and call golden.echo (local fallback)', async () => {
    const manifest = generateToolManifestFromCapabilities({
      registry: createCapabilityRegistry(),
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
      includeBlueprints: true,
    });

    // Client writes -> server reads
    const stdin = new PassThrough();
    // Server writes -> client reads
    const stdout = new PassThrough();

    const server = runMcpStdioServer({
      manifest,
      stdin,
      stdout,
      useEnvDefaults: false, // force local fallback path (no Temporal runner)
    });

    const client = createStdioJsonRpcClient({ stdin, stdout });

    const init = await client.request('initialize', { protocolVersion: '2025-11-25' });
    expect(init).toHaveProperty('serverInfo');

    const list = await client.request('tools/list', {});
    expect(list).toHaveProperty('tools');
    const tools = (list as any).tools as Array<{ name: string }>;
    expect(tools.some((t) => t.name === 'golden.echo')).toBe(true);

    const call = await client.request('tools/call', { name: 'golden.echo', arguments: { x: 3 } });
    expect(call).toHaveProperty('structuredContent');
    expect((call as any).structuredContent).toMatchObject({
      trace_id: expect.any(String),
      result: { y: 3 },
    });

    // Shut down server loop.
    stdin.end();
    await server;
  });
});

