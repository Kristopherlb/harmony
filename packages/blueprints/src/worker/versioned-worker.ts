/**
 * packages/blueprints/src/worker/versioned-worker.ts
 * Versioned Temporal Worker with Build ID support for blue/green deployments.
 *
 * This worker supports Worker Versioning (Build IDs) which enables:
 * - Zero-downtime deployments
 * - Blue/green traffic shifting
 * - Safe workflow draining
 *
 * Environment variables:
 * - WORKER_BUILD_ID: Build ID for this worker (defaults to package version)
 * - WORKER_VERSIONING: Set to 'true' to enable versioning (defaults to false)
 * - TEMPORAL_ADDRESS: Temporal server address (defaults to localhost:7233)
 * - TEMPORAL_NAMESPACE: Temporal namespace (defaults to default)
 * - TASK_QUEUE: Task queue name (defaults to golden-tools)
 * - FLAGD_HOST: flagd host for flag evaluation (defaults to localhost)
 * - FLAGD_PORT: flagd port for flag evaluation (defaults to 8013)
 */
import { Worker, NativeConnection } from '@temporalio/worker';
import { executeDaggerCapability } from './execute-dagger-capability.js';
import { createFlagActivities } from '../activities/flag-activities.js';

/** Package version used as default Build ID */
const packageVersion = '1.0.0'; // TODO: Load from package.json at runtime

/**
 * Configuration for the versioned worker.
 */
export interface VersionedWorkerConfig {
  /** Temporal server address */
  temporalAddress?: string;
  /** Temporal namespace */
  namespace?: string;
  /** Task queue name */
  taskQueue?: string;
  /** Build ID for this worker */
  buildId?: string;
  /** Enable worker versioning */
  useVersioning?: boolean;
  /** Path to workflow bundle */
  bundlePath?: string;
  /** flagd configuration */
  flagd?: {
    host?: string;
    port?: number;
  };
}

/**
 * Create and start a versioned Temporal worker.
 *
 * @param config - Worker configuration
 * @returns The running worker instance
 */
export async function createVersionedWorker(
  config?: VersionedWorkerConfig
): Promise<Worker> {
  // Load configuration from environment with fallbacks
  const temporalAddress =
    config?.temporalAddress ??
    process.env.TEMPORAL_ADDRESS ??
    'localhost:7233';

  const namespace =
    config?.namespace ??
    process.env.TEMPORAL_NAMESPACE ??
    'default';

  const taskQueue =
    config?.taskQueue ??
    process.env.TASK_QUEUE ??
    'golden-tools';

  const buildId =
    config?.buildId ??
    process.env.WORKER_BUILD_ID ??
    `v${packageVersion}`;

  const useVersioning =
    config?.useVersioning ??
    process.env.WORKER_VERSIONING === 'true';

  const bundlePath =
    config?.bundlePath ??
    process.env.WORKFLOW_BUNDLE_PATH ??
    './dist/workflow-bundle.js';

  // Create flag activities with configuration
  const flagActivities = createFlagActivities({
    flagdHost: config?.flagd?.host ?? process.env.FLAGD_HOST,
    flagdPort: config?.flagd?.port
      ? config.flagd.port
      : process.env.FLAGD_PORT
        ? parseInt(process.env.FLAGD_PORT, 10)
        : undefined,
    useEnvProvider: process.env.FLAG_PROVIDER === 'env',
  });

  // Connect to Temporal
  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });

  console.log(
    `[VersionedWorker] Connecting to Temporal at ${temporalAddress}, ` +
    `namespace=${namespace}, taskQueue=${taskQueue}, ` +
    `buildId=${buildId}, versioning=${useVersioning}`
  );

  // Create worker with versioning configuration
  const workerOptions: Parameters<typeof Worker.create>[0] = {
    connection,
    namespace,
    taskQueue,
    workflowsPath: undefined, // Use bundle instead
    workflowBundle: { codePath: bundlePath },
    activities: {
      // Capability execution activity
      executeDaggerCapability,
      // Flag evaluation activity (for checkFlag in workflows)
      evaluateFlag: flagActivities.evaluateFlag,
    },
  };

  // Add Build ID configuration if versioning is enabled
  if (useVersioning) {
    Object.assign(workerOptions, {
      buildId,
      useVersioning: true,
    });
  }

  const worker = await Worker.create(workerOptions);

  console.log(
    `[VersionedWorker] Worker started. ` +
    `BuildId=${useVersioning ? buildId : '(versioning disabled)'}`
  );

  return worker;
}

/**
 * Run the versioned worker until shutdown signal.
 * Handles graceful shutdown on SIGINT/SIGTERM.
 */
export async function runVersionedWorker(
  config?: VersionedWorkerConfig
): Promise<void> {
  const worker = await createVersionedWorker(config);

  // Handle shutdown signals
  const shutdown = async () => {
    console.log('[VersionedWorker] Shutting down...');
    worker.shutdown();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await worker.run();
    console.log('[VersionedWorker] Worker stopped.');
  } catch (error) {
    console.error('[VersionedWorker] Worker error:', error);
    throw error;
  }
}

// Allow running directly as a script
const isMain =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  (require as unknown as { main?: unknown }).main === module;

if (isMain) {
  runVersionedWorker().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
  });
}
