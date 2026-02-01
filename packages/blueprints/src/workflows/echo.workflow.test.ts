/**
 * packages/blueprints/src/workflows/echo.workflow.test.ts
 * Metric 1: BaseBlueprint executes OCS capability by ID with shared activity only.
 * EchoWorkflow extends BaseBlueprint and calls this.execute(cap, input); no custom activity.
 * This test verifies the shared activity stub; full e2e runs via worker + workflow bundle.
 */
import { describe, it, expect } from 'vitest';
import { executeDaggerCapability } from '../activities/execute-capability-activity';

describe('EchoWorkflow / executeCapability (Metric 1)', () => {
  it('shared executeDaggerCapability activity returns result for capability by ID', async () => {
    const result = await executeDaggerCapability({
      capId: 'golden.echo',
      input: { x: 42 },
      runAs: 'user:test',
      traceId: 'trace-1',
    });
    expect(result).toEqual({ y: 42 });
  });
});

