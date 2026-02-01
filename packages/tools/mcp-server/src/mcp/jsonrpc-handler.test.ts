/**
 * packages/tools/mcp-server/src/mcp/jsonrpc-handler.test.ts
 * TDD: JSON-RPC handler for initialize + tools/list + tools/call.
 */
import { describe, it, expect } from 'vitest';
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from '../manifest/capabilities.js';
import { createToolSurface } from './tool-surface.js';
import { createMcpJsonRpcHandler } from './jsonrpc-handler.js';

describe('createMcpJsonRpcHandler', () => {
  const manifest = generateToolManifestFromCapabilities({
    registry: createCapabilityRegistry(),
    generated_at: '2026-01-28T00:00:00.000Z',
    version: '1',
  });

  it('responds to tools/list with manifest-derived tools', async () => {
    const surface = createToolSurface({ manifest, traceId: () => 'trace-1' });
    const handler = createMcpJsonRpcHandler({
      toolSurface: surface,
      serverInfo: { name: 'golden-mcp-server', version: '1.0.0' },
      manifestInfo: { version: manifest.version, generated_at: manifest.generated_at },
    });

    const res = await handler({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });

    expect(res).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        tools: expect.any(Array),
        manifest: {
          version: '1',
          generated_at: '2026-01-28T00:00:00.000Z',
        },
      },
    });
    expect(res && typeof res === 'object' && 'result' in res).toBe(true);
    const result = (res as { result: { tools: Array<{ name?: unknown }> } }).result;
    const echo = result.tools.find((t) => t.name === 'golden.echo');
    expect(echo).toBeDefined();
  });
});

