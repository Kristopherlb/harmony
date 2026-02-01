/**
 * packages/tools/mcp-server/src/manifest/capabilities.ts
 * Deterministic Tool Manifest generation for OCS capabilities.
 */
import type { CapabilityRegistry } from '@golden/capabilities';
import { createBlueprintRegistry } from '@golden/blueprints';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';

export interface ToolManifestEntry {
  id: string;
  type: 'CAPABILITY' | 'BLUEPRINT';
  description: string;
  data_classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  json_schema: unknown;
}

export interface ToolManifest {
  generated_at: string;
  version: string;
  tools: ToolManifestEntry[];
}

function normalizeDataClassification(value: unknown): ToolManifestEntry['data_classification'] {
  const v = typeof value === 'string' ? value.toUpperCase() : '';
  if (v === 'PUBLIC' || v === 'INTERNAL' || v === 'CONFIDENTIAL' || v === 'RESTRICTED') return v;
  return 'INTERNAL';
}

export function generateToolManifestFromCapabilities(input: {
  registry: CapabilityRegistry;
  generated_at: string;
  version: string;
  includeBlueprints?: boolean;
}): ToolManifest {
  const tools: ToolManifestEntry[] = [];
  for (const cap of input.registry.values()) {
    const jsonSchema = zodToJsonSchema(cap.schemas.input as unknown as ZodTypeAny, {
      target: 'jsonSchema2019-09',
      $refStrategy: 'none',
      nameStrategy: 'title',
    }) as Record<string, unknown>;

    // Ajv2020 expects 2020-12 meta-schema; the produced schema is compatible for our subset.
    jsonSchema.$schema = 'https://json-schema.org/draft/2020-12/schema#';

    tools.push({
      id: cap.metadata.id,
      type: 'CAPABILITY',
      description: cap.metadata.description,
      data_classification: cap.security.dataClassification,
      json_schema: jsonSchema,
    });
  }

  if (input.includeBlueprints === true) {
    const registry = createBlueprintRegistry();
    for (const entry of registry.values()) {
      const d = entry.descriptor as unknown as {
        metadata?: { id?: string; description: string };
        inputSchema: ZodTypeAny;
        security?: { classification?: string };
      };
      if (entry.blueprintId !== d.metadata?.id) {
        throw new Error(
          `Blueprint registry blueprintId does not match workflow metadata.id: ${String(entry.blueprintId)} != ${String(
            d.metadata?.id
          )}`
        );
      }
      const jsonSchema = zodToJsonSchema(d.inputSchema, {
        target: 'jsonSchema2019-09',
        $refStrategy: 'none',
        nameStrategy: 'title',
      }) as Record<string, unknown>;
      jsonSchema.$schema = 'https://json-schema.org/draft/2020-12/schema#';

      tools.push({
        id: entry.blueprintId,
        type: 'BLUEPRINT',
        description: d.metadata?.description ?? '',
        data_classification: normalizeDataClassification(d.security?.classification),
        json_schema: jsonSchema,
      });
    }
  }

  tools.sort((a, b) => a.id.localeCompare(b.id));

  return {
    generated_at: input.generated_at,
    version: input.version,
    tools,
  };
}

