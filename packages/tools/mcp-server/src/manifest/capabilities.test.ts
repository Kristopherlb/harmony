/**
 * packages/tools/mcp-server/src/manifest/capabilities.test.ts
 * TDD: deterministic tool manifest generation from capability registry.
 */
import { describe, it, expect } from 'vitest';
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from './capabilities.js';

describe('generateToolManifestFromCapabilities', () => {
  it('includes golden.echo with deterministic json_schema', () => {
    const registry = createCapabilityRegistry();
    const manifest = generateToolManifestFromCapabilities({
      registry,
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
    });

    const echo = manifest.tools.find((t) => t.id === 'golden.echo');
    expect(echo).toBeDefined();
    expect(echo?.type).toBe('CAPABILITY');
    expect(echo?.data_classification).toBe('PUBLIC');
    expect(echo?.description).toContain('Echo');
    // Discovery metadata should be deterministic and derived from capability definition + ID.
    expect(echo?.domain).toBe('demo');
    expect(echo?.subdomain).toBe('echo');
    expect(echo?.tags).toEqual(expect.arrayContaining(['demo']));
    expect(echo?.maintainer).toBe('platform');
    expect(echo?.requiredScopes).toEqual([]);
    expect(echo?.allowOutbound).toEqual([]);
    expect(echo?.isIdempotent).toBe(true);
    expect(echo?.costFactor).toBe('LOW');

    // Basic schema expectations (stability contract).
    expect(echo?.json_schema).toMatchObject({
      type: 'object',
      properties: {
        x: { type: 'number' },
      },
      required: ['x'],
    });

    // Lock exact schema shape for determinism (TCS-001 style contract).
    expect(echo?.json_schema).toMatchSnapshot();
  });

  it('includes Jira issue search and count capabilities', () => {
    const registry = createCapabilityRegistry();
    const manifest = generateToolManifestFromCapabilities({
      registry,
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
    });

    const search = manifest.tools.find((t) => t.id === 'golden.jira.issue.search');
    expect(search).toBeDefined();
    expect(search?.type).toBe('CAPABILITY');
    expect(search?.data_classification).toBe('CONFIDENTIAL');
    expect(search?.json_schema).toMatchObject({
      type: 'object',
      properties: {
        jql: { type: 'string' },
      },
      required: ['jql'],
    });

    const count = manifest.tools.find((t) => t.id === 'golden.jira.issue.count');
    expect(count).toBeDefined();
    expect(count?.type).toBe('CAPABILITY');
    expect(count?.data_classification).toBe('CONFIDENTIAL');
    expect(count?.json_schema).toMatchObject({
      type: 'object',
      properties: {
        jql: { type: 'string' },
      },
      required: ['jql'],
    });
  });

  it('includes blueprints as tools (IDs/descriptions first)', () => {
    const registry = createCapabilityRegistry();
    const manifest = generateToolManifestFromCapabilities({
      registry,
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
      includeBlueprints: true,
    });

    const echoWf = manifest.tools.find((t) => t.id === 'workflows.echo');
    expect(echoWf).toBeDefined();
    expect(echoWf?.type).toBe('BLUEPRINT');
    expect(echoWf?.description).toContain('E2e workflow');
    expect(echoWf?.domain).toBe('workflows');
    expect(echoWf?.subdomain).toBe('echo');
  });
});

