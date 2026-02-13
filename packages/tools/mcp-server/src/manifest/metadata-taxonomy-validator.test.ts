/**
 * packages/tools/mcp-server/src/manifest/metadata-taxonomy-validator.test.ts
 * Focused taxonomy checks for capability metadata.domain/subdomain.
 */
import { describe, it, expect } from 'vitest';
import { z } from '@golden/schema-registry';
import { generateToolManifestFromCapabilities } from './capabilities.js';

describe('capability metadata taxonomy validator', () => {
  function buildRegistryWithCap(meta: { id: string; domain?: string; subdomain?: string; tags?: string[] }) {
    const cap = {
      metadata: {
        id: meta.id,
        version: '1.0.0',
        name: 'testCapability',
        description: 'test',
        maintainer: 'platform',
        domain: meta.domain,
        subdomain: meta.subdomain,
        tags: meta.tags ?? [],
      },
      schemas: {
        input: z.object({}),
      },
      security: {
        dataClassification: 'INTERNAL',
        requiredScopes: [],
        networkAccess: { allowOutbound: [] },
      },
      operations: {
        isIdempotent: true,
        costFactor: 'LOW',
      },
    } as any;

    return new Map([[cap.metadata.id, cap]]) as any;
  }

  it('fails early when metadata.domain does not match ID-derived domain', () => {
    const registry = buildRegistryWithCap({
      id: 'golden.echo',
      domain: 'echo', // expected: demo
      tags: ['echo'],
    });

    expect(() =>
      generateToolManifestFromCapabilities({
        registry,
        generated_at: '2026-02-10T00:00:00.000Z',
        version: '1',
      })
    ).toThrow(/metadata\.domain mismatch/i);
  });

  it('fails early when metadata.subdomain does not match ID-derived subdomain', () => {
    const registry = buildRegistryWithCap({
      id: 'golden.github.rest.request',
      domain: 'github',
      subdomain: 'rest-query', // expected: rest.request
      tags: ['github'],
    });

    expect(() =>
      generateToolManifestFromCapabilities({
        registry,
        generated_at: '2026-02-10T00:00:00.000Z',
        version: '1',
      })
    ).toThrow(/metadata\.subdomain mismatch/i);
  });
});

