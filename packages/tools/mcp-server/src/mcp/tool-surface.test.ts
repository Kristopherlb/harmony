/**
 * packages/tools/mcp-server/src/mcp/tool-surface.test.ts
 * TDD: MCP tools/list + tools/call behavior over a Tool Manifest.
 */
import { describe, it, expect } from 'vitest';
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from '../manifest/capabilities.js';
import { createToolSurface } from './tool-surface.js';
import { signGoldenCallEnvelope } from './call-envelope.js';

describe('createToolSurface', () => {
  const manifest = generateToolManifestFromCapabilities({
    registry: createCapabilityRegistry(),
    generated_at: '2026-01-28T00:00:00.000Z',
    version: '1',
    includeBlueprints: true,
  });

  it('lists tools from manifest with inputSchema', () => {
    const surface = createToolSurface({ manifest });
    const tools = surface.listTools();
    const echo = tools.find((t) => t.name === 'golden.echo');
    expect(echo).toBeDefined();
    expect(echo?.inputSchema).toBeDefined();
  });

  it('tools/call returns isError=true when args invalid', async () => {
    const surface = createToolSurface({ manifest, traceId: () => 'trace-test' });
    const res = await surface.callTool({
      name: 'golden.echo',
      arguments: {},
    });

    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({
      trace_id: 'trace-test',
    });
  });

  it('tools/call returns structuredContent with trace_id on success', async () => {
    const surface = createToolSurface({ manifest, traceId: () => 'trace-ok' });
    const res = await surface.callTool({
      name: 'golden.echo',
      arguments: { x: 7 },
    });

    expect(res.isError).toBe(false);
    expect(res.structuredContent).toMatchObject({
      trace_id: 'trace-ok',
    });
  });

  it('can execute a capability via injected runner (non-echo)', async () => {
    const capManifest = {
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
      tools: [
        {
          id: 'cap.any',
          type: 'CAPABILITY',
          description: 'Any capability',
          data_classification: 'PUBLIC',
          json_schema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema#',
            type: 'object',
            properties: { x: { type: 'number' } },
            required: ['x'],
          },
        },
      ],
    } as const;

    const surface = createToolSurface({
      manifest: capManifest as any,
      traceId: () => 'trace-cap',
      capabilityRunner: async ({ id, args }) => ({
        result: { id, args },
      }),
    });

    const res = await surface.callTool({ name: 'cap.any', arguments: { x: 9 } });
    expect(res.isError).toBe(false);
    expect(res.structuredContent).toMatchObject({
      trace_id: 'trace-cap',
      result: { id: 'cap.any', args: { x: 9 } },
    });
  });

  it('tools/call can execute a blueprint via injected runner', async () => {
    const surface = createToolSurface({
      manifest,
      traceId: () => 'trace-bp',
      blueprintRunner: async ({ id }) => ({
        result: { workflow_id: `wf:${id}` },
      }),
    });

    const res = await surface.callTool({
      name: 'workflows.echo',
      arguments: { x: 1 },
    });

    expect(res.isError).toBe(false);
    expect(res.structuredContent).toMatchObject({
      trace_id: 'trace-bp',
      result: { workflow_id: 'wf:workflows.echo' },
    });
  });

  it('returns approval_required for RESTRICTED tools without invoking runner', async () => {
    const restrictedManifest = {
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
      tools: [
        {
          id: 'cap.restricted',
          type: 'CAPABILITY',
          description: 'Restricted tool',
          data_classification: 'RESTRICTED',
          json_schema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema#',
            type: 'object',
            properties: { x: { type: 'number' } },
            required: ['x'],
          },
        },
      ],
    } as const;

    const surface = createToolSurface({
      manifest: restrictedManifest as any,
      traceId: () => 'trace-restricted',
      capabilityRunner: async () => {
        throw new Error('runner should not be invoked');
      },
    });

    const res = await surface.callTool({
      name: 'cap.restricted',
      arguments: { x: 1 },
    });

    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({
      trace_id: 'trace-restricted',
      error: 'APPROVAL_REQUIRED',
      data_classification: 'RESTRICTED',
    });
  });

  it('requires a signed call envelope when configured', async () => {
    const capManifest = {
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
      tools: [
        {
          id: 'cap.any',
          type: 'CAPABILITY',
          description: 'Any capability',
          data_classification: 'PUBLIC',
          json_schema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema#',
            type: 'object',
            properties: { x: { type: 'number' } },
            required: ['x'],
          },
        },
      ],
    } as const;

    const secret = 'test-secret';
    const envelope = signGoldenCallEnvelope(
      {
        initiatorId: 'user:test',
        roles: ['role:dev'],
        tokenRef: 'tok',
        appId: 'app',
        environment: 'test',
        costCenter: 'CC-1',
        dataClassification: 'INTERNAL',
        traceId: 'trace-from-envelope',
      },
      secret
    );

    const surface = createToolSurface({
      manifest: capManifest as any,
      traceId: () => 'trace-generated',
      envelope: { hmacSecret: secret, require: true },
      capabilityRunner: async ({ traceId, context }) => ({
        result: { traceId, context },
      }),
    });

    const res = await surface.callTool({
      name: 'cap.any',
      arguments: { x: 1 },
      meta: { golden: envelope },
    });

    expect(res.isError).toBe(false);
    expect(res.structuredContent).toMatchObject({
      trace_id: 'trace-from-envelope',
      result: {
        traceId: 'trace-from-envelope',
        context: {
          initiatorId: 'user:test',
          roles: ['role:dev'],
          costCenter: 'CC-1',
        },
      },
    });
  });

  it('rejects missing call envelope when required', async () => {
    const capManifest = {
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
      tools: [
        {
          id: 'cap.any',
          type: 'CAPABILITY',
          description: 'Any capability',
          data_classification: 'PUBLIC',
          json_schema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema#',
            type: 'object',
            properties: { x: { type: 'number' } },
            required: ['x'],
          },
        },
      ],
    } as const;

    const surface = createToolSurface({
      manifest: capManifest as any,
      traceId: () => 'trace-generated',
      envelope: { hmacSecret: 'test-secret', require: true },
      capabilityRunner: async () => ({ result: {} }),
    });

    const res = await surface.callTool({
      name: 'cap.any',
      arguments: { x: 1 },
    });

    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({
      trace_id: 'trace-generated',
      error: 'UNAUTHORIZED',
    });
  });
});

