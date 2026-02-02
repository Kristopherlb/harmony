/**
 * tools/path/src/generators/sync/generator.test.ts
 * TDD: sync generator regenerates registries + workflow exports from filesystem.
 */
import { describe, it, expect } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import syncGenerator from './generator';

describe('@golden/path:sync', () => {
  function writeMinimalToolCatalog(tree: ReturnType<typeof createTreeWithEmptyWorkspace>, toolIds: string[]) {
    tree.write(
      'packages/tools/mcp-server/src/manifest/tool-catalog.json',
      JSON.stringify(
        {
          version: '1.0.0',
          tools: toolIds.map((id) => ({ id })),
        },
        null,
        2
      )
    );
  }

  it('regenerates capability registry + package barrel from discovered *.capability.ts files', async () => {
    const tree = createTreeWithEmptyWorkspace();

    writeMinimalToolCatalog(tree, ['golden.echo', 'golden.jira.get_issue']);

    tree.write(
      'packages/capabilities/src/demo/echo.capability.ts',
      `export const echoCapability = { metadata: { id: 'golden.echo' } } as any;\n`
    );

    tree.write(
      'packages/capabilities/src/connectors/jira-get-issue.capability.ts',
      `const impl = { metadata: { id: 'golden.jira.get_issue' } } as any;\nexport { impl as jiraGetIssueCapability };\n`
    );

    tree.write(
      'packages/capabilities/src/registry.ts',
      `/**
 * packages/capabilities/src/registry.ts
 */
import type { Capability } from '@golden/core';
export type CapabilityRegistry = Map<string, Capability<unknown, unknown, unknown, unknown>>;
export function createCapabilityRegistry(): CapabilityRegistry { return new Map(); }
export function getCapability(registry: CapabilityRegistry, capId: string) { return registry.get(capId) as any; }
`
    );

    tree.write(
      'packages/capabilities/index.ts',
      `/** @golden/capabilities */\nexport { createCapabilityRegistry, getCapability, type CapabilityRegistry } from './src/registry.js';\n`
    );

    await syncGenerator(tree, {});

    const registry = tree.read('packages/capabilities/src/registry.ts', 'utf-8')!;
    expect(registry).toContain("import { echoCapability } from './demo/echo.capability.js';");
    expect(registry).toContain("import { jiraGetIssueCapability } from './connectors/jira-get-issue.capability.js';");
    expect(registry).toContain('[echoCapability.metadata.id');
    expect(registry).toContain('[jiraGetIssueCapability.metadata.id');
    expect(registry.indexOf('[echoCapability.metadata.id')).toBeLessThan(
      registry.indexOf('[jiraGetIssueCapability.metadata.id')
    );

    const index = tree.read('packages/capabilities/index.ts', 'utf-8')!;
    expect(index).toContain("export { echoCapability } from './src/demo/echo.capability.js';");
    expect(index).toContain("export { jiraGetIssueCapability } from './src/connectors/jira-get-issue.capability.js';");
    expect(index).toContain("export { createCapabilityRegistry, getCapability, type CapabilityRegistry } from './src/registry.js';");
  });

  it('regenerates blueprint registry + workflows index from discovered descriptors and *.workflow-run.ts files', async () => {
    const tree = createTreeWithEmptyWorkspace();

    // Sync validates tool-catalog presence for deterministic MCP/Console discovery.
    writeMinimalToolCatalog(tree, ['workflows.echo', 'ops.demo']);

    tree.write(
      'packages/blueprints/src/descriptors/echo.descriptor.ts',
      `export const echoBlueprintDescriptor = { blueprintId: 'workflows.echo', workflowType: 'echoWorkflow' } as any;\n`
    );
    tree.write(
      'packages/blueprints/src/descriptors/ops-demo.descriptor.ts',
      `const impl = { blueprintId: 'ops.demo', workflowType: 'opsDemoWorkflow' } as any;\nexport { impl as opsDemoWorkflowDescriptor };\n`
    );

    tree.write(
      'packages/blueprints/src/workflows/echo.workflow-run.ts',
      `export async function echoWorkflow() { return { y: 1 }; }\n`
    );
    tree.write(
      'packages/blueprints/src/workflows/system/ops-demo.workflow-run.ts',
      `export async function opsDemoWorkflow() { return { ok: true }; }\n`
    );

    tree.write(
      'packages/blueprints/src/workflows/index.ts',
      `/** Workflow exports for Temporal worker bundle. */\n`
    );
    tree.write(
      'packages/blueprints/src/registry.ts',
      `import type { BlueprintDescriptor } from './descriptors/types.js';\nexport type BlueprintRegistry = Map<string, any>;\nexport function createBlueprintRegistry(): BlueprintRegistry { return new Map(); }\n`
    );

    await syncGenerator(tree, {});

    const workflowsIndex = tree.read('packages/blueprints/src/workflows/index.ts', 'utf-8')!;
    expect(workflowsIndex).toContain("export { echoWorkflow } from './echo.workflow-run';");
    expect(workflowsIndex).toContain("export { opsDemoWorkflow } from './system/ops-demo.workflow-run';");

    const blueprintRegistry = tree.read('packages/blueprints/src/registry.ts', 'utf-8')!;
    expect(blueprintRegistry).toContain("import { echoBlueprintDescriptor } from './descriptors/echo.descriptor.js';");
    expect(blueprintRegistry).toContain("import { opsDemoWorkflowDescriptor } from './descriptors/ops-demo.descriptor.js';");
    expect(blueprintRegistry).toContain("['ops.demo'");
    expect(blueprintRegistry).toContain("['workflows.echo'");
    expect(blueprintRegistry.indexOf("['ops.demo'")).toBeLessThan(blueprintRegistry.indexOf("['workflows.echo'"));
  });
});

