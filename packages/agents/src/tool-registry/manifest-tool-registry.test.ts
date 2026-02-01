/**
 * packages/agents/src/tool-registry/manifest-tool-registry.test.ts
 * TDD: in-process ToolRegistry adapter backed by the Tool Manifest (Option A).
 */
import { describe, it, expect } from 'vitest';
import type { ToolRegistry } from '@golden/core';
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from '@golden/mcp-server';
import { createManifestToolRegistry } from './manifest-tool-registry.js';

describe('createManifestToolRegistry', () => {
  it('filters to authorizedTools and returns trace_id in results', async () => {
    const manifest = generateToolManifestFromCapabilities({
      registry: createCapabilityRegistry(),
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
    });

    const registry: ToolRegistry = createManifestToolRegistry({
      manifest,
      authorizedTools: ['golden.echo'],
      traceId: () => 'trace-registry-1',
    });

    expect(registry.list()).toEqual(['golden.echo']);

    const fn = registry.get('golden.echo');
    expect(fn).toBeDefined();
    const out = await fn!({ x: 3 });
    expect(out.trace_id).toBe('trace-registry-1');
    expect(out.result).toMatchObject({ result: { y: 3 }, trace_id: 'trace-registry-1' });
  });

  it('does not expose tools not in authorizedTools', () => {
    const manifest = generateToolManifestFromCapabilities({
      registry: createCapabilityRegistry(),
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
    });

    const registry = createManifestToolRegistry({
      manifest,
      authorizedTools: [],
    });

    expect(registry.list()).toEqual([]);
    expect(registry.get('golden.echo')).toBeUndefined();
  });
});

