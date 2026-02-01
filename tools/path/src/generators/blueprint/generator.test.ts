import { describe, it, expect } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import blueprintGenerator from './generator';

function minimalWorkflowsIndexSource() {
  return `/**
 * Workflow exports for Temporal worker bundle.
 */
export { echoWorkflow } from './echo.workflow-run';
`;
}

function minimalBlueprintRegistrySource() {
  return `/**
 * packages/blueprints/src/registry.ts
 * In-process registry for WCS blueprints by ID (deterministic discovery).
 */
import { echoBlueprintDescriptor } from './descriptors/echo.descriptor.js';
import type { BlueprintDescriptor } from './descriptors/types.js';

export interface BlueprintRegistryEntry {
  blueprintId: string;
  workflowType: string;
  descriptor: BlueprintDescriptor;
}

export type BlueprintRegistry = Map<string, BlueprintRegistryEntry>;

export function createBlueprintRegistry(): BlueprintRegistry {
  // Deterministic ordering: sorted by blueprintId.
  return new Map<string, BlueprintRegistryEntry>([
    [
      'workflows.echo',
      {
        blueprintId: 'workflows.echo',
        workflowType: 'echoWorkflow',
        descriptor: echoBlueprintDescriptor,
      },
    ],
  ]);
}

export function getBlueprint(registry: BlueprintRegistry, blueprintId: string): BlueprintRegistryEntry {
  const bp = registry.get(blueprintId);
  if (!bp) throw new Error(\`Blueprint not found: \${blueprintId}\`);
  return bp;
}
`;
}

function minimalBlueprintDescriptorTypesSource() {
  return `/**
 * packages/blueprints/src/descriptors/types.ts
 * Blueprint descriptor types (safe to import from Node-land).
 */
import type { z } from '@golden/schema-registry';

export interface BlueprintDescriptor {
  blueprintId: string;
  workflowType: string;
  metadata: {
    id: string;
    version: string;
    description: string;
  };
  inputSchema: z.ZodSchema<unknown>;
  security?: {
    classification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  };
}
`;
}

function minimalEchoDescriptorSource() {
  return `/**
 * packages/blueprints/src/descriptors/echo.descriptor.ts
 * Blueprint descriptor for workflows.echo.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const echoBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'workflows.echo',
  workflowType: 'echoWorkflow',
  metadata: {
    id: 'workflows.echo',
    version: '1.0.0',
    description: 'E2e workflow',
  },
  inputSchema: z.object({ x: z.number() }),
  security: { classification: 'INTERNAL' },
};
`;
}

describe('@golden/path:blueprint', () => {
  it('generates workflow + run entrypoint and updates workflow exports deterministically', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('packages/blueprints/src/workflows/index.ts', minimalWorkflowsIndexSource());
    tree.write('packages/blueprints/src/workflows/echo.workflow-run.ts', 'export async function echoWorkflow() { return { y: 1 }; }\n');
    tree.write('packages/blueprints/src/descriptors/types.ts', minimalBlueprintDescriptorTypesSource());
    tree.write('packages/blueprints/src/descriptors/echo.descriptor.ts', minimalEchoDescriptorSource());
    tree.write('packages/blueprints/src/registry.ts', minimalBlueprintRegistrySource());

    tree.write(
      'tmp/architecture_plan.json',
      JSON.stringify(
        {
          blueprint_metadata: {
            id: 'ops.incident.enrich_and_page',
            version: '1.0.0',
            security_classification: 'INTERNAL',
          },
          acceptance_tests: [{ scenario: 'Happy Path', expected_outcome: 'ok' }],
          hitl_requirements: { clarification_questions: [], developer_actions: [], runtime_approvals: [] },
          security_logic: { required_roles: [], hitl_points: [] },
          dag: {
            steps: [
              {
                id: 'fetch_incident',
                capability: 'golden.echo',
                input_mapping: { x: 'context.x' },
                is_parallel: false,
              },
            ],
          },
          temporal_tuning: { aps_strategy: 'sequential', retry_policy_overrides: {} },
        },
        null,
        2
      )
    );

    await expect(blueprintGenerator(tree, { plan: 'tmp/architecture_plan.json' })).resolves.toBeDefined();

    expect(tree.exists('packages/blueprints/src/workflows/ops-incident-enrich-and-page.workflow.ts')).toBe(true);
    expect(tree.exists('packages/blueprints/src/workflows/ops-incident-enrich-and-page.workflow-run.ts')).toBe(true);

    const idx = tree.read('packages/blueprints/src/workflows/index.ts', 'utf-8')!;
    expect(idx).toContain("export { opsIncidentEnrichAndPageWorkflow } from './ops-incident-enrich-and-page.workflow-run';");

    // Deterministic ordering: echo first, then ops.* (lexicographic by export name).
    const echoIndex = idx.indexOf("export { echoWorkflow }");
    const newIndex = idx.indexOf("export { opsIncidentEnrichAndPageWorkflow }");
    expect(echoIndex).toBeGreaterThanOrEqual(0);
    expect(newIndex).toBeGreaterThanOrEqual(0);
    expect(echoIndex).toBeLessThan(newIndex);
  });

  it('upserts blueprint registry entries deterministically', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('packages/blueprints/src/workflows/index.ts', minimalWorkflowsIndexSource());
    tree.write('packages/blueprints/src/workflows/echo.workflow-run.ts', 'export async function echoWorkflow() { return { y: 1 }; }\n');
    tree.write('packages/blueprints/src/descriptors/types.ts', minimalBlueprintDescriptorTypesSource());
    tree.write('packages/blueprints/src/descriptors/echo.descriptor.ts', minimalEchoDescriptorSource());
    tree.write('packages/blueprints/src/registry.ts', minimalBlueprintRegistrySource());

    tree.write(
      'tmp/architecture_plan.json',
      JSON.stringify(
        {
          blueprint_metadata: {
            id: 'ops.incident.enrich_and_page',
            version: '1.0.0',
            security_classification: 'INTERNAL',
          },
          acceptance_tests: [{ scenario: 'Happy Path', expected_outcome: 'ok' }],
          hitl_requirements: { clarification_questions: [], developer_actions: [], runtime_approvals: [] },
          security_logic: { required_roles: [], hitl_points: [] },
          dag: {
            steps: [
              {
                id: 'fetch_incident',
                capability: 'golden.echo',
                input_mapping: { x: 'context.x' },
                is_parallel: false,
              },
            ],
          },
          temporal_tuning: { aps_strategy: 'sequential', retry_policy_overrides: {} },
        },
        null,
        2
      )
    );

    await expect(blueprintGenerator(tree, { plan: 'tmp/architecture_plan.json' })).resolves.toBeDefined();

    expect(tree.exists('packages/blueprints/src/descriptors/ops-incident-enrich-and-page.descriptor.ts')).toBe(true);

    const reg = tree.read('packages/blueprints/src/registry.ts', 'utf-8')!;
    expect(reg).toContain("import { echoBlueprintDescriptor } from './descriptors/echo.descriptor.js';");
    expect(reg).toContain(
      "import { opsIncidentEnrichAndPageWorkflowDescriptor } from './descriptors/ops-incident-enrich-and-page.descriptor.js';"
    );
    expect(reg).toContain("blueprintId: 'ops.incident.enrich_and_page'");
    expect(reg).toContain("workflowType: 'opsIncidentEnrichAndPageWorkflow'");
    expect(reg).toContain('descriptor: opsIncidentEnrichAndPageWorkflowDescriptor');

    // Deterministic ordering: sorted by blueprintId.
    const opsIndex = reg.indexOf("blueprintId: 'ops.incident.enrich_and_page'");
    const echoIndex = reg.indexOf("blueprintId: 'workflows.echo'");
    expect(opsIndex).toBeGreaterThanOrEqual(0);
    expect(echoIndex).toBeGreaterThanOrEqual(0);
    expect(opsIndex).toBeLessThan(echoIndex);
  });

  it('rejects plans that reference capabilities missing from the registry (when registry exists)', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('packages/blueprints/src/workflows/index.ts', minimalWorkflowsIndexSource());
    tree.write('packages/blueprints/src/workflows/echo.workflow-run.ts', 'export async function echoWorkflow() { return { y: 1 }; }\n');

    tree.write(
      'packages/capabilities/src/demo/echo.capability.ts',
      'export const echoCapability = { metadata: { id: "golden.echo" } } as any;\n'
    );
    tree.write(
      'packages/capabilities/src/registry.ts',
      `import type { Capability } from '@golden/core';
import { echoCapability } from './demo/echo.capability.js';
export type CapabilityRegistry = Map<string, Capability<unknown, unknown, unknown, unknown>>;
export function createCapabilityRegistry(): CapabilityRegistry {
  return new Map([
    [echoCapability.metadata.id, echoCapability as unknown as Capability<unknown, unknown, unknown, unknown>],
  ]);
}
`
    );

    tree.write(
      'tmp/architecture_plan.json',
      JSON.stringify(
        {
          blueprint_metadata: { id: 'ops.demo.missing_cap', version: '1.0.0', security_classification: 'INTERNAL' },
          acceptance_tests: [{ scenario: 'Happy Path', expected_outcome: 'ok' }],
          hitl_requirements: { clarification_questions: [], developer_actions: [], runtime_approvals: [] },
          security_logic: { required_roles: [], hitl_points: [] },
          dag: {
            steps: [
              {
                id: 'step_1',
                capability: 'golden.missing',
                input_mapping: {},
                is_parallel: false,
              },
            ],
          },
          temporal_tuning: { aps_strategy: 'sequential', retry_policy_overrides: {} },
        },
        null,
        2
      )
    );

    await expect(blueprintGenerator(tree, { plan: 'tmp/architecture_plan.json' })).rejects.toThrow(
      /Unknown capability referenced: golden\.missing/
    );
  });
});

