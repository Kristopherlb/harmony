/**
 * packages/tools/mcp-server/src/manifest/tool-catalog.ts
 * Deterministic tool catalog artifact generation (no timestamps).
 */
import type { CapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities, type ToolManifestEntry } from './capabilities.js';

export interface ToolCatalog {
  version: string;
  tools: ToolManifestEntry[];
}

/**
 * Generate a deterministic tool catalog suitable for committing as an artifact.
 * - No timestamps
 * - Stable ordering
 */
export function generateToolCatalog(input: {
  registry: CapabilityRegistry;
  version: string;
  includeBlueprints?: boolean;
}): ToolCatalog {
  const manifest = generateToolManifestFromCapabilities({
    registry: input.registry,
    generated_at: '1970-01-01T00:00:00.000Z',
    version: input.version,
    includeBlueprints: input.includeBlueprints,
  });

  return { version: manifest.version, tools: manifest.tools };
}

export function serializeToolCatalog(catalog: ToolCatalog): string {
  // Deterministic: stable keys + stable ordering already guaranteed by generator.
  return JSON.stringify(catalog, null, 2) + '\n';
}

