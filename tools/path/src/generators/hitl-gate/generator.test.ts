import { describe, it, expect } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import hitlGateGenerator from './generator';

function minimalCoreWorkflowIndexSource() {
  return `/**
 * Workflow-only entry point for Temporal bundle (no LangGraph/OTel/Node-heavy deps).
 */
export const __placeholder = true;
`;
}

describe('@golden/path:hitl-gate', () => {
  it('generates gate signal + activities modules and upserts workflow exports deterministically', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('packages/core/src/wcs/workflow.ts', minimalCoreWorkflowIndexSource());

    await expect(
      hitlGateGenerator(tree, {
        name: 'deployment-approval',
        notificationChannel: 'slack',
        timeout: '30m',
      })
    ).resolves.toBeDefined();

    expect(tree.exists('packages/core/src/wcs/deployment-approval-signal.ts')).toBe(true);
    expect(tree.exists('packages/core/src/wcs/deployment-approval-signal.test.ts')).toBe(true);
    expect(tree.exists('packages/blueprints/src/activities/deployment-approval-activities.ts')).toBe(true);
    expect(tree.exists('packages/blueprints/src/activities/deployment-approval-activities.test.ts')).toBe(true);

    const workflowExports = tree.read('packages/core/src/wcs/workflow.ts', 'utf-8')!;
    expect(workflowExports).toContain(
      "export { deploymentApprovalSignal, deploymentApprovalStateQuery } from './deployment-approval-signal.js';"
    );
  });

  it('is idempotent (running twice yields identical outputs)', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('packages/core/src/wcs/workflow.ts', minimalCoreWorkflowIndexSource());

    await hitlGateGenerator(tree, {
      name: 'deployment-approval',
      notificationChannel: 'slack',
      timeout: '30m',
    });
    const onceWorkflow = tree.read('packages/core/src/wcs/workflow.ts', 'utf-8')!;

    await hitlGateGenerator(tree, {
      name: 'deployment-approval',
      notificationChannel: 'slack',
      timeout: '30m',
    });
    const twiceWorkflow = tree.read('packages/core/src/wcs/workflow.ts', 'utf-8')!;

    expect(twiceWorkflow).toBe(onceWorkflow);
  });
});

