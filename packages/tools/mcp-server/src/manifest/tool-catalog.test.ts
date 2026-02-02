/**
 * packages/tools/mcp-server/src/manifest/tool-catalog.test.ts
 * CI gate: tool catalog artifact must be deterministic and up to date.
 */
import { describe, it, expect } from 'vitest';
import { createCapabilityRegistry } from '@golden/capabilities';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateToolCatalog } from './tool-catalog.js';

function readArtifact(): unknown {
  const dir = dirname(fileURLToPath(import.meta.url));
  const p = resolve(dir, 'tool-catalog.json');
  const raw = readFileSync(p, 'utf-8');
  return JSON.parse(raw) as unknown;
}

describe('tool-catalog.json (artifact)', () => {
  it('matches generated catalog exactly (no timestamps)', () => {
    const registry = createCapabilityRegistry();
    const generated = generateToolCatalog({ registry, version: '1', includeBlueprints: true });
    const artifact = readArtifact();
    expect(artifact).toEqual(generated);
  });
});

