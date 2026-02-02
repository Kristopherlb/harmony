/**
 * packages/tools/mcp-server/src/mcp/test-worker-activities.ts
 *
 * Purpose: Centralize Temporal worker activity registration for integration tests.
 * Prevents drift where workflows call activities the test worker didn't register.
 */
export type TestWorkerActivities = {
  executeDaggerCapability: (input: unknown) => Promise<unknown>;
  evaluateFlag: (input: { flagKey: string; defaultValue: boolean; context?: Record<string, unknown> }) => Promise<boolean>;
};

export async function createTestWorkerActivities(): Promise<TestWorkerActivities> {
  const activitiesModule = await import('@golden/blueprints/src/activities/execute-capability-activity.js');
  const { createFlagActivities } = await import('@golden/blueprints/src/activities/flag-activities.js');
  const flagActivities = createFlagActivities({ useEnvProvider: true });

  return {
    executeDaggerCapability: activitiesModule.executeDaggerCapability as unknown as (
      input: unknown
    ) => Promise<unknown>,
    evaluateFlag: flagActivities.evaluateFlag as unknown as TestWorkerActivities['evaluateFlag'],
  };
}

