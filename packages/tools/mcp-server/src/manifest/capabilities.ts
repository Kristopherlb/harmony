/**
 * packages/tools/mcp-server/src/manifest/capabilities.ts
 * Deterministic Tool Manifest generation for OCS capabilities.
 */
import type { CapabilityRegistry } from '@golden/capabilities';
import { createBlueprintRegistry } from '@golden/blueprints';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

export function generateToolManifestFromCapabilities(input: {
  registry: CapabilityRegistry;
  generated_at: string;
  version: string;
  includeBlueprints?: boolean;
}): ToolManifest {
  const tools: ToolManifestEntry[] = [];
  for (const cap of input.registry.values()) {
    const jsonSchema = zodToJsonSchema(cap.schemas.input as any, {
      target: 'jsonSchema2019-09',
      $refStrategy: 'none',
      nameStrategy: 'title',
    }) as any;

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
      const d = entry.descriptor as any;
      if (entry.blueprintId !== d.metadata?.id) {
        throw new Error(
          `Blueprint registry blueprintId does not match workflow metadata.id: ${String(entry.blueprintId)} != ${String(
            d.metadata?.id
          )}`
        );
      }
      const jsonSchema = zodToJsonSchema(d.inputSchema as any, {
        target: 'jsonSchema2019-09',
        $refStrategy: 'none',
        nameStrategy: 'title',
      }) as any;
      jsonSchema.$schema = 'https://json-schema.org/draft/2020-12/schema#';

      tools.push({
        id: entry.blueprintId,
        type: 'BLUEPRINT',
        description: d.metadata.description,
        data_classification: ((d.security?.classification as string | undefined) ?? 'INTERNAL') as any,
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

