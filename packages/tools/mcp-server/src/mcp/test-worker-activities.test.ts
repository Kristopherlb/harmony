/**
 * packages/tools/mcp-server/src/mcp/test-worker-activities.test.ts
 * TDD: integration worker activities are centralized and complete.
 */
import { describe, it, expect } from 'vitest';
import { createTestWorkerActivities } from './test-worker-activities.js';

describe('createTestWorkerActivities', () => {
  it('includes executeDaggerCapability and evaluateFlag', async () => {
    const acts = await createTestWorkerActivities();
    expect(typeof acts.executeDaggerCapability).toBe('function');
    expect(typeof acts.evaluateFlag).toBe('function');
  });
});

