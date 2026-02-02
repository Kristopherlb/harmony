/**
 * packages/blueprints/src/activities/flag-activities.ts
 * Flag evaluation activities for Temporal workflow determinism.
 *
 * These activities wrap OpenFeature flag evaluation so that flag checks
 * within workflows remain deterministic. The activity result is recorded
 * in Temporal history, ensuring replay consistency.
 */
export interface EvaluateFlagActivityInput {
  flagKey: string;
  defaultValue: boolean;
  /**
   * OpenFeature evaluation context (kept minimal to avoid runtime coupling in worker code).
   * Values should be primitives to align with OpenFeature EvaluationContextValue.
   */
  context?: Record<string, string | number | boolean>;
}

/**
 * Flag activities interface for Temporal worker registration.
 * Workers must implement and register these activities.
 */
export interface FlagActivities {
  /**
   * Evaluate a boolean feature flag using OpenFeature.
   * Uses flagd as the default provider.
   */
  evaluateFlag(input: EvaluateFlagActivityInput): Promise<boolean>;
}

/**
 * Create flag activities with the specified configuration.
 * Returns activity implementations ready for worker registration.
 *
 * @param config - Configuration for flag evaluation
 * @returns Flag activities object
 */
export function createFlagActivities(config?: {
  /** flagd host address */
  flagdHost?: string;
  /** flagd port */
  flagdPort?: number;
  /** Use environment variables for flags (testing/local) */
  useEnvProvider?: boolean;
}): FlagActivities {
  const flagdHost = config?.flagdHost ?? process.env.FLAGD_HOST ?? 'localhost';
  const flagdPort = config?.flagdPort ?? parseInt(process.env.FLAGD_PORT ?? '8013', 10);
  const useEnvProvider = config?.useEnvProvider ?? process.env.FLAG_PROVIDER === 'env';

  return {
    async evaluateFlag(input: EvaluateFlagActivityInput): Promise<boolean> {
      const { flagKey, defaultValue, context } = input;

      // If using environment provider (for testing/local dev)
      if (useEnvProvider) {
        const envKey = `FLAG_${flagKey.toUpperCase().replace(/[-.]/g, '_')}`;
        const envValue = process.env[envKey];

        if (envValue === 'true') return true;
        if (envValue === 'false') return false;
        return defaultValue;
      }

      // Use OpenFeature with flagd provider
      try {
        // Dynamic imports to avoid bundling issues in workflow code
        const { OpenFeature } = await import('@openfeature/server-sdk');
        const { FlagdProvider } = await import('@openfeature/flagd-provider');

        // Configure flagd provider
        const provider = new FlagdProvider({
          host: flagdHost,
          port: flagdPort,
        });

        await OpenFeature.setProviderAndWait(provider);
        const client = OpenFeature.getClient();

        // Evaluate the flag with context
        const result = await client.getBooleanValue(
          flagKey,
          defaultValue,
        context
        );

        // Clean up provider connection
        await OpenFeature.close();

        return result;
      } catch (error) {
        // Log error but return default value to avoid breaking workflows
        console.warn(
          `Flag evaluation failed for '${flagKey}', using default value ${defaultValue}:`,
          error instanceof Error ? error.message : error
        );
        return defaultValue;
      }
    },
  };
}

/**
 * Default flag activities instance using environment configuration.
 * Workers can use this directly or create custom instances.
 */
export const flagActivities = createFlagActivities();
