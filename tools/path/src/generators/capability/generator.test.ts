import { describe, it, expect } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import capabilityGenerator from './generator';

function minimalCapabilitiesRegistrySource() {
  return `/**
 * packages/capabilities/src/registry.ts
 * In-process registry for OCS capabilities by ID.
 */
import type { Capability } from '@golden/core';
import { echoCapability } from './demo/echo.capability.js';

export type CapabilityRegistry = Map<string, Capability<unknown, unknown, unknown, unknown>>;

export function createCapabilityRegistry(): CapabilityRegistry {
  return new Map([
    [echoCapability.metadata.id, echoCapability as unknown as Capability<unknown, unknown, unknown, unknown>],
  ]);
}

export function getCapability(
  registry: CapabilityRegistry,
  capId: string
): Capability<unknown, unknown, unknown, unknown> {
  const cap = registry.get(capId);
  if (!cap) throw new Error(\`Capability not found: \${capId}\`);
  return cap;
}
`;
}

describe('@golden/path:capability', () => {
  it('creates a capability module and registers it in the capability registry deterministically', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'packages/capabilities/src/demo/echo.capability.ts',
      'export const echoCapability = { metadata: { id: \"golden.echo\" } } as any;'
    );
    tree.write('packages/capabilities/src/registry.ts', minimalCapabilitiesRegistrySource());

    await expect(
      capabilityGenerator(tree, {
        name: 'jira-get-issue',
        pattern: 'connector',
        classification: 'INTERNAL',
      })
    ).resolves.toBeDefined();

    expect(tree.exists('packages/capabilities/src/connectors/jira-get-issue.capability.ts')).toBe(true);

    const registry = tree.read('packages/capabilities/src/registry.ts', 'utf-8')!;
    expect(registry).toContain("import { jiraGetIssueCapability } from './connectors/jira-get-issue.capability.js';");
    expect(registry).toContain('[jiraGetIssueCapability.metadata.id');

    // Deterministic ordering: echo first, then jira.* (lexicographic by metadata.id).
    const echoIndex = registry.indexOf('[echoCapability.metadata.id');
    const jiraIndex = registry.indexOf('[jiraGetIssueCapability.metadata.id');
    expect(echoIndex).toBeGreaterThanOrEqual(0);
    expect(jiraIndex).toBeGreaterThanOrEqual(0);
    expect(echoIndex).toBeLessThan(jiraIndex);
  });

  it('is idempotent (running twice yields identical registry output)', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'packages/capabilities/src/demo/echo.capability.ts',
      'export const echoCapability = { metadata: { id: \"golden.echo\" } } as any;'
    );
    tree.write('packages/capabilities/src/registry.ts', minimalCapabilitiesRegistrySource());

    await capabilityGenerator(tree, {
      name: 'jira-get-issue',
      pattern: 'connector',
      classification: 'INTERNAL',
    });
    const once = tree.read('packages/capabilities/src/registry.ts', 'utf-8')!;

    await capabilityGenerator(tree, {
      name: 'jira-get-issue',
      pattern: 'connector',
      classification: 'INTERNAL',
    });
    const twice = tree.read('packages/capabilities/src/registry.ts', 'utf-8')!;

    expect(twice).toBe(once);
  });

  it('updates registry even if formatting differs (AST-based, not regex fragile)', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'packages/capabilities/src/demo/echo.capability.ts',
      'export const echoCapability = { metadata: { id: "golden.echo" } } as any;'
    );
    tree.write(
      'packages/capabilities/src/registry.ts',
      `import   type { Capability }   from "@golden/core";
import {echoCapability} from "./demo/echo.capability.js";

export type CapabilityRegistry = Map<string, Capability<unknown, unknown, unknown, unknown>>;

export function createCapabilityRegistry(): CapabilityRegistry {return new Map([[echoCapability.metadata.id, echoCapability as unknown as Capability<unknown, unknown, unknown, unknown>]]);}

export function getCapability(registry: CapabilityRegistry, capId: string): Capability<unknown, unknown, unknown, unknown> {
  const cap = registry.get(capId);
  if (!cap) throw new Error(\`Capability not found: \${capId}\`);
  return cap;
}
`
    );

    await capabilityGenerator(tree, {
      name: 'jira-get-issue',
      pattern: 'connector',
      classification: 'INTERNAL',
    });

    const registry = tree.read('packages/capabilities/src/registry.ts', 'utf-8')!;
    expect(registry).toContain("import type { Capability }");
    expect(registry).toContain("import { echoCapability } from './demo/echo.capability.js';");
    expect(registry).toContain("import { jiraGetIssueCapability } from './connectors/jira-get-issue.capability.js';");
    expect(registry).toContain('export function createCapabilityRegistry');
    expect(registry).toContain('[echoCapability.metadata.id');
    expect(registry).toContain('[jiraGetIssueCapability.metadata.id');
  });
});

