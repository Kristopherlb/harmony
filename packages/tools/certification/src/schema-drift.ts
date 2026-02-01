import { createCapabilityRegistry } from '@golden/capabilities';
import type { CapabilityRegistry } from '@golden/capabilities';
import { createBlueprintRegistry } from '@golden/blueprints';
import type { Capability } from '@golden/core';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableStringify } from './stable-stringify.js';
import type { z } from '@golden/schema-registry';

export type SchemaSnapshot = {
  version: string;
  generatedAt: string;
  capabilities: Array<{
    id: string;
    inputSchema: unknown;
    outputSchema: unknown;
  }>;
  blueprints: Array<{
    id: string;
    inputSchema: unknown;
  }>;
};

export type SchemaDriftEntry = {
  id: string;
  kind: 'CAPABILITY' | 'BLUEPRINT';
  change: 'added' | 'removed' | 'input-changed' | 'output-changed';
};

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASELINE_PATH = resolve(CURRENT_DIR, '..', '..', 'schema-baselines', 'capabilities.json');

export function generateSchemaSnapshot(options?: {
  registry?: CapabilityRegistry;
  version?: string;
  generatedAt?: string;
}): SchemaSnapshot {
  const registry = options?.registry ?? createCapabilityRegistry();
  const capabilities = Array.from(registry.values()).map((capValue) => {
    const cap = capValue as Capability;
    const inputSchema = schemaSignature(cap.schemas.input as z.ZodTypeAny);
    const outputSchema = schemaSignature(cap.schemas.output as z.ZodTypeAny);
    return {
      id: cap.metadata.id,
      inputSchema,
      outputSchema,
    };
  });

  capabilities.sort((a, b) => a.id.localeCompare(b.id));

  const blueprints = Array.from(createBlueprintRegistry().values()).map((entry) => {
    const descriptor = entry.descriptor as { inputSchema: z.ZodSchema<unknown> };
    return {
      id: entry.blueprintId,
      inputSchema: schemaSignature(descriptor.inputSchema as z.ZodTypeAny),
    };
  });

  blueprints.sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: options?.version ?? '0.0.0',
    generatedAt: options?.generatedAt ?? new Date(0).toISOString(),
    capabilities,
    blueprints,
  };
}

export async function loadSchemaBaseline(path = DEFAULT_BASELINE_PATH): Promise<SchemaSnapshot> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as SchemaSnapshot;
}

export async function writeSchemaBaseline(
  snapshot: SchemaSnapshot,
  path = DEFAULT_BASELINE_PATH
): Promise<void> {
  const payload = `${stableStringify(snapshot)}\n`;
  await writeFile(path, payload, 'utf-8');
}

export function detectSchemaDrift(
  snapshot: SchemaSnapshot,
  baseline: SchemaSnapshot
): SchemaDriftEntry[] {
  const drift: SchemaDriftEntry[] = [];
  const baselineById = new Map(baseline.capabilities.map((cap) => [cap.id, cap]));
  const currentById = new Map(snapshot.capabilities.map((cap) => [cap.id, cap]));

  for (const [id, current] of currentById) {
    const prior = baselineById.get(id);
    if (!prior) {
      drift.push({ id, kind: 'CAPABILITY', change: 'added' });
      continue;
    }
    if (stableStringify(current.inputSchema) !== stableStringify(prior.inputSchema)) {
      drift.push({ id, kind: 'CAPABILITY', change: 'input-changed' });
    }
    if (stableStringify(current.outputSchema) !== stableStringify(prior.outputSchema)) {
      drift.push({ id, kind: 'CAPABILITY', change: 'output-changed' });
    }
  }

  for (const [id] of baselineById) {
    if (!currentById.has(id)) {
      drift.push({ id, kind: 'CAPABILITY', change: 'removed' });
    }
  }

  const baselineBlueprintsById = new Map(baseline.blueprints.map((bp) => [bp.id, bp]));
  const currentBlueprintsById = new Map(snapshot.blueprints.map((bp) => [bp.id, bp]));

  for (const [id, current] of currentBlueprintsById) {
    const prior = baselineBlueprintsById.get(id);
    if (!prior) {
      drift.push({ id, kind: 'BLUEPRINT', change: 'added' });
      continue;
    }
    if (stableStringify(current.inputSchema) !== stableStringify(prior.inputSchema)) {
      drift.push({ id, kind: 'BLUEPRINT', change: 'input-changed' });
    }
  }

  for (const [id] of baselineBlueprintsById) {
    if (!currentBlueprintsById.has(id)) {
      drift.push({ id, kind: 'BLUEPRINT', change: 'removed' });
    }
  }

  return drift;
}

function schemaSignature(schema: z.ZodTypeAny): unknown {
  const def: any = (schema as any)._def;
  const typeName = def?.typeName ?? 'unknown';

  switch (typeName) {
    case 'ZodString':
      return { type: 'string', checks: def.checks ?? [] };
    case 'ZodNumber':
      return { type: 'number', checks: def.checks ?? [] };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum':
      return { type: 'enum', values: def.values ?? [] };
    case 'ZodLiteral':
      return { type: 'literal', value: def.value };
    case 'ZodOptional':
      return { type: 'optional', inner: schemaSignature(def.innerType) };
    case 'ZodDefault':
      return { type: 'default', inner: schemaSignature(def.innerType), value: def.defaultValue() };
    case 'ZodArray':
      return { type: 'array', element: schemaSignature(def.type) };
    case 'ZodUnion':
      return { type: 'union', options: (def.options ?? []).map(schemaSignature) };
    case 'ZodObject': {
      const shape = typeof def.shape === 'function' ? def.shape() : def.shape ?? {};
      const properties: Record<string, unknown> = {};
      for (const key of Object.keys(shape).sort()) {
        properties[key] = schemaSignature(shape[key]);
      }
      return { type: 'object', unknownKeys: def.unknownKeys, properties };
    }
    case 'ZodRecord':
      return { type: 'record', key: schemaSignature(def.keyType), value: schemaSignature(def.valueType) };
    case 'ZodTuple':
      return { type: 'tuple', items: (def.items ?? []).map(schemaSignature) };
    case 'ZodEffects':
      return { type: 'effects', inner: schemaSignature(def.schema) };
    default:
      return { type: typeName };
  }
}
