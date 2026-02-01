import { createBlueprintRegistry } from '@golden/blueprints';
import { createCapabilityRegistry } from '@golden/capabilities';
import { createHash } from 'node:crypto';
import { stableStringify } from './stable-stringify.js';

export type OscalComponentEntry = {
  id: string;
  title: string;
  description: string;
  type: 'CAPABILITY' | 'BLUEPRINT';
  oscalControlIds: string[];
};

export type OscalComponentDefinition = {
  'component-definition': {
    uuid: string;
    metadata: {
      title: string;
      last_modified: string;
      version: string;
      oscal_version: string;
    };
    components: Array<{
      uuid: string;
      type: string;
      title: string;
      description: string;
      control_implementations: Array<{
        uuid: string;
        source: string;
        implemented_requirements: Array<{
          uuid: string;
          control_id: string;
          description: string;
        }>;
      }>;
    }>;
  };
};

export function generateOscalComponentDefinition(options?: {
  version?: string;
  title?: string;
  oscalVersion?: string;
}): OscalComponentDefinition {
  const entries = collectOscalEntries();
  return buildOscalComponentDefinition(entries, options);
}

export function buildOscalComponentDefinition(
  entries: OscalComponentEntry[],
  options?: {
    version?: string;
    title?: string;
    oscalVersion?: string;
  }
): OscalComponentDefinition {
  const title = options?.title ?? 'Harmony Component Definition';
  const version = options?.version ?? '1.0.0';
  const oscalVersion = options?.oscalVersion ?? '1.1.2';
  const stableTime = new Date(0).toISOString();

  const components = entries
    .filter((entry) => entry.oscalControlIds.length > 0)
    .map((entry) => {
      const implementedRequirements = entry.oscalControlIds.map((controlId) => ({
        uuid: deterministicUuid(`${entry.id}:${controlId}`),
        control_id: controlId,
        description: `${entry.title} satisfies ${controlId}.`,
      }));

      return {
        uuid: deterministicUuid(entry.id),
        type: entry.type === 'CAPABILITY' ? 'service' : 'system',
        title: entry.title,
        description: entry.description,
        control_implementations: [
          {
            uuid: deterministicUuid(`${entry.id}:implementation`),
            source: 'OCS/WCS metadata',
            implemented_requirements: implementedRequirements,
          },
        ],
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    'component-definition': {
      uuid: deterministicUuid(`component-definition:${title}`),
      metadata: {
        title,
        last_modified: stableTime,
        version,
        oscal_version: oscalVersion,
      },
      components,
    },
  };
}

function collectOscalEntries(): OscalComponentEntry[] {
  const entries: OscalComponentEntry[] = [];
  const capabilityRegistry = createCapabilityRegistry();
  for (const cap of capabilityRegistry.values()) {
    entries.push({
      id: cap.metadata.id,
      title: cap.metadata.name,
      description: cap.metadata.description,
      type: 'CAPABILITY',
      oscalControlIds: cap.security.oscalControlIds ?? [],
    });
  }

  const blueprintRegistry = createBlueprintRegistry();
  for (const entry of blueprintRegistry.values()) {
    const descriptor = entry.descriptor as { metadata?: { id?: string; description?: string }; security?: { oscalControlIds?: string[] } };
    entries.push({
      id: entry.blueprintId,
      title: descriptor.metadata?.id ?? entry.blueprintId,
      description: descriptor.metadata?.description ?? 'Blueprint',
      type: 'BLUEPRINT',
      oscalControlIds: descriptor.security?.oscalControlIds ?? [],
    });
  }

  return entries;
}

function deterministicUuid(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  const parts = [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)];
  const versioned = `${parts[0]}-${parts[1]}-5${parts[2].slice(1)}-${applyVariant(parts[3])}-${parts[4]}`;
  return versioned;
}

function applyVariant(block: string): string {
  const first = parseInt(block[0], 16);
  const variant = (first & 0x3) | 0x8;
  return `${variant.toString(16)}${block.slice(1)}`;
}

export function stableOscalString(definition: OscalComponentDefinition): string {
  return stableStringify(definition);
}
