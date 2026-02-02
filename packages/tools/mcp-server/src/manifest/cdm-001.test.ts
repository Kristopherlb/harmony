/**
 * packages/tools/mcp-server/src/manifest/cdm-001.test.ts
 * CI gate: catalog entries must satisfy CDM-001 discovery invariants.
 */
import { describe, it, expect } from 'vitest';
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from './capabilities.js';

describe('CDM-001 discovery invariants', () => {
  it('ensures tags include domain for all catalog tools', () => {
    const manifest = generateToolManifestFromCapabilities({
      registry: createCapabilityRegistry(),
      generated_at: '1970-01-01T00:00:00.000Z',
      version: '1',
      includeBlueprints: true,
    });

    for (const t of manifest.tools) {
      expect(typeof t.domain).toBe('string');
      expect((t.domain ?? '').length).toBeGreaterThan(0);
      if (t.type === 'CAPABILITY') {
        expect(Array.isArray(t.tags)).toBe(true);
        expect(t.tags).toContain(t.domain);
      }
      if (t.type === 'BLUEPRINT' && Array.isArray(t.tags)) {
        expect(t.tags).toContain(t.domain);
      }
    }
  });
});

