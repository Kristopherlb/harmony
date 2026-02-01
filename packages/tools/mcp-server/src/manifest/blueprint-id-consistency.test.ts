/**
 * packages/tools/mcp-server/src/manifest/blueprint-id-consistency.test.ts
 * TDD: manifest generation enforces blueprint registry IDs match workflow metadata.id.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from '@golden/schema-registry';

vi.mock('@golden/blueprints', () => {
  return {
    createBlueprintRegistry: () =>
      new Map([
        [
          'workflows.echo',
          {
            blueprintId: 'workflows.echo',
            workflowType: 'echoWorkflow',
            descriptor: {
              blueprintId: 'workflows.echo',
              workflowType: 'echoWorkflow',
              metadata: { id: 'workflows.DIFFERENT', version: '1.0.0', description: 'mismatch' },
              inputSchema: z.object({}),
              security: { classification: 'INTERNAL' },
            } as unknown,
          },
        ],
      ]),
  };
});

// Import after mock hoisting.
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from './capabilities.js';

describe('Blueprint id consistency', () => {
  it('throws when blueprintId != workflow.metadata.id', () => {
    expect(() =>
      generateToolManifestFromCapabilities({
        registry: createCapabilityRegistry(),
        generated_at: '2026-01-28T00:00:00.000Z',
        version: '1',
        includeBlueprints: true,
      })
    ).toThrow(/blueprintId.*does not match workflow metadata\.id/i);
  });
});

