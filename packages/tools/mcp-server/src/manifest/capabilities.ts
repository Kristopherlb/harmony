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
  /**
   * Discovery metadata (additive, deterministic).
   * These fields are safe to ship to the UI for browsing/filtering.
   */
  domain?: string;
  subdomain?: string;
  tags?: string[];
  maintainer?: string;
  requiredScopes?: string[];
  allowOutbound?: string[];
  isIdempotent?: boolean;
  costFactor?: 'LOW' | 'MEDIUM' | 'HIGH';
  ai_hints?: {
    example_input?: unknown;
    example_output?: unknown;
    usage_notes?: string;
    constraints?: string[];
    negative_examples?: string[];
  };
}

export interface ToolManifest {
  generated_at: string;
  version: string;
  tools: ToolManifestEntry[];
}

type ZodToJsonSchemaFn = (schema: unknown, options: {
  target: string;
  $refStrategy: 'none';
  nameStrategy: 'title';
}) => Record<string, unknown>;

const toJsonSchema = zodToJsonSchema as unknown as ZodToJsonSchemaFn;

function deriveDomainParts(toolId: string): { domain: string; subdomain: string } {
  const parts = toolId.split('.').filter((p) => p.trim().length > 0);
  if (parts.length === 0) return { domain: 'other', subdomain: '' };

  // Convention: OCS capabilities use `golden.<domain>.<subdomain...>`.
  if (parts[0] === 'golden') {
    // Handle legacy/demo IDs like `golden.echo`.
    if (parts.length === 2) return { domain: 'demo', subdomain: parts[1] };
    if (parts.length >= 3) return { domain: parts[1], subdomain: parts.slice(2).join('.') };
    return { domain: 'other', subdomain: parts.slice(1).join('.') };
  }

  // Blueprints and other tool families use their own prefix, e.g. `workflows.echo`.
  return { domain: parts[0], subdomain: parts.slice(1).join('.') };
}

function normalizeDataClassification(value: unknown): ToolManifestEntry['data_classification'] {
  const v = typeof value === 'string' ? value.toUpperCase() : '';
  if (v === 'PUBLIC' || v === 'INTERNAL' || v === 'CONFIDENTIAL' || v === 'RESTRICTED') return v;
  return 'INTERNAL';
}

function uniqStrings(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of input) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function normalizeTags(input: unknown, domain: string): string[] | undefined {
  const tags = Array.isArray(input) ? input.filter((x): x is string => typeof x === 'string') : [];
  const merged = uniqStrings([domain, ...tags]);
  return merged.length > 0 ? merged : undefined;
}

function normalizeHintStrings(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const values = input.filter((x): x is string => typeof x === 'string');
  const unique = uniqStrings(values);
  return unique.length > 0 ? unique : undefined;
}

function normalizeAiHints(input: unknown): ToolManifestEntry['ai_hints'] | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const hints = input as {
    exampleInput?: unknown;
    exampleOutput?: unknown;
    usageNotes?: unknown;
    constraints?: unknown;
    negativeExamples?: unknown;
  };
  const normalized: ToolManifestEntry['ai_hints'] = {
    example_input: hints.exampleInput,
    example_output: hints.exampleOutput,
    usage_notes: typeof hints.usageNotes === 'string' ? hints.usageNotes : undefined,
    constraints: normalizeHintStrings(hints.constraints),
    negative_examples: normalizeHintStrings(hints.negativeExamples),
  };
  if (
    normalized.example_input === undefined &&
    normalized.example_output === undefined &&
    normalized.usage_notes === undefined &&
    normalized.constraints === undefined &&
    normalized.negative_examples === undefined
  ) {
    return undefined;
  }
  return normalized;
}

export function generateToolManifestFromCapabilities(input: {
  registry: CapabilityRegistry;
  generated_at: string;
  version: string;
  includeBlueprints?: boolean;
}): ToolManifest {
  const tools: ToolManifestEntry[] = [];
  for (const cap of input.registry.values()) {
    const { domain, subdomain } = deriveDomainParts(cap.metadata.id);
    const explicitDomain = cap.metadata.domain;
    const explicitSubdomain = cap.metadata.subdomain;
    if (explicitDomain && explicitDomain !== domain) {
      throw new Error(
        `Capability metadata.domain mismatch for ${cap.metadata.id}: ${explicitDomain} != ${domain}`
      );
    }
    if (explicitSubdomain && explicitSubdomain !== subdomain) {
      throw new Error(
        `Capability metadata.subdomain mismatch for ${cap.metadata.id}: ${explicitSubdomain} != ${subdomain}`
      );
    }
    const jsonSchema = toJsonSchema(cap.schemas.input, {
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
      domain,
      subdomain,
      tags: normalizeTags(cap.metadata.tags, domain),
      maintainer: cap.metadata.maintainer,
      requiredScopes: cap.security.requiredScopes,
      allowOutbound: cap.security.networkAccess.allowOutbound,
      isIdempotent: cap.operations.isIdempotent,
      costFactor: cap.operations.costFactor,
      ai_hints: normalizeAiHints((cap as any).aiHints),
    });
  }

  if (input.includeBlueprints === true) {
    const registry = createBlueprintRegistry();
    for (const entry of registry.values()) {
      const { domain, subdomain } = deriveDomainParts(entry.blueprintId);
      const d = entry.descriptor as unknown as {
        metadata?: { id?: string; description: string; domain?: string; subdomain?: string; tags?: string[] };
        inputSchema: unknown;
        security?: { classification?: string };
      };
      if (entry.blueprintId !== d.metadata?.id) {
        throw new Error(
          `Blueprint registry blueprintId does not match workflow metadata.id: ${String(entry.blueprintId)} != ${String(
            d.metadata?.id
          )}`
        );
      }
      const jsonSchema = toJsonSchema(d.inputSchema, {
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
        domain,
        subdomain,
        tags: normalizeTags(d.metadata?.tags, domain),
      });
    }
  }

  tools.sort((a, b) => {
    const ad = a.domain ?? '';
    const bd = b.domain ?? '';
    const c1 = ad.localeCompare(bd);
    if (c1 !== 0) return c1;

    // CDM-001: undefined last
    const as = a.subdomain && a.subdomain.length > 0 ? a.subdomain : '\uffff';
    const bs = b.subdomain && b.subdomain.length > 0 ? b.subdomain : '\uffff';
    const c2 = as.localeCompare(bs);
    if (c2 !== 0) return c2;

    return a.id.localeCompare(b.id);
  });

  return {
    generated_at: input.generated_at,
    version: input.version,
    tools,
  };
}

