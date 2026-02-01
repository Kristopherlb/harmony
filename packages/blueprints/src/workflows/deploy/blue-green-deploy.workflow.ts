/**
 * packages/blueprints/src/workflows/deploy/blue-green-deploy.workflow.ts
 * Blue/Green Deploy Blueprint (WCS-001)
 *
 * Zero-downtime blue/green deployment with Temporal worker versioning.
 * Composes: container-builder + k8s.apply + version-manager + flags.
 */
import { BaseBlueprint } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';

export interface BlueGreenDeployInput {
  /** Release version / Build ID (e.g., "2.0.0") */
  version: string;
  /** Container registry address */
  registry: string;
  /** Build context path for container image */
  contextPath: string;
  /** Temporal task queue name */
  taskQueue?: string;
  /** Previous Build ID to drain (optional) */
  previousBuildId?: string;
  /** Kubernetes namespace */
  namespace?: string;
  /** Path to K8s manifests */
  manifestPath?: string;
  /** Dockerfile path relative to context */
  dockerfile?: string;
  /** Additional build args */
  buildArgs?: Record<string, string>;
  /** Skip flag generation */
  skipFlags?: boolean;
  /** Wait for drain before completing */
  waitForDrain?: boolean;
  /** Drain timeout in seconds */
  drainTimeoutSeconds?: number;
}

export interface BlueGreenDeployOutput {
  /** Overall status */
  success: boolean;
  /** Built image reference */
  imageRef: string;
  /** Image digest (sha256) */
  digest?: string;
  /** Build ID registered with Temporal */
  buildId: string;
  /** K8s resources affected */
  resourcesAffected: number;
  /** Flag sync status */
  flagSyncStatus?: 'SYNCED' | 'PENDING' | 'FAILED' | 'SKIPPED';
  /** Drain status (if previous build was drained) */
  drainStatus?: 'DRAINED' | 'SKIPPED' | 'TIMEOUT';
  /** Human-readable summary */
  message: string;
}

export interface BlueGreenDeployConfig {
  /** Default registry if not specified */
  defaultRegistry?: string;
  /** Default namespace */
  defaultNamespace?: string;
  /** Default manifest path */
  defaultManifestPath?: string;
  /** Default drain timeout */
  defaultDrainTimeoutSeconds?: number;
}

export class BlueGreenDeployWorkflow extends BaseBlueprint<
  BlueGreenDeployInput,
  BlueGreenDeployOutput,
  BlueGreenDeployConfig
> {
  readonly metadata = {
    id: 'blueprints.deploy.blue-green',
    version: '1.0.0',
    name: 'Blue/Green Deploy',
    description:
      'Zero-downtime blue/green deployment with Temporal worker versioning. Builds container image, deploys to K8s, registers Build ID, and optionally drains old version.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['deploy', 'blue-green', 'temporal', 'kubernetes', 'containers'],
  };

  readonly security = {
    requiredRoles: ['deploy:blue-green'],
    classification: 'INTERNAL' as const,
    oscalControlIds: ['CM-2', 'CM-3', 'SA-10'], // Baseline config, change control, dev config mgmt
  };

  readonly operations = {
    sla: { targetDuration: '15m', maxDuration: '45m' },
    alerting: { errorRateThreshold: 0.05 },
  };

  readonly inputSchema = z.object({
    version: z.string().describe('Release version / Build ID'),
    registry: z.string().describe('Container registry address'),
    contextPath: z.string().describe('Build context path'),
    taskQueue: z.string().optional().default('golden-tools').describe('Temporal task queue'),
    previousBuildId: z.string().optional().describe('Previous Build ID to drain'),
    namespace: z.string().optional().describe('Kubernetes namespace'),
    manifestPath: z.string().optional().describe('Path to K8s manifests'),
    dockerfile: z.string().optional().describe('Dockerfile path'),
    buildArgs: z.record(z.string()).optional().describe('Additional build args'),
    skipFlags: z.boolean().optional().describe('Skip flag generation'),
    waitForDrain: z.boolean().optional().default(true).describe('Wait for old version drain'),
    drainTimeoutSeconds: z.number().optional().describe('Drain timeout'),
  }) as BaseBlueprint<BlueGreenDeployInput, BlueGreenDeployOutput, BlueGreenDeployConfig>['inputSchema'];

  readonly configSchema = z.object({
    defaultRegistry: z.string().optional(),
    defaultNamespace: z.string().optional(),
    defaultManifestPath: z.string().optional(),
    defaultDrainTimeoutSeconds: z.number().optional(),
  }) as BaseBlueprint<BlueGreenDeployInput, BlueGreenDeployOutput, BlueGreenDeployConfig>['configSchema'];

  protected async logic(
    input: BlueGreenDeployInput,
    config: BlueGreenDeployConfig
  ): Promise<BlueGreenDeployOutput> {
    const registry = input.registry || config.defaultRegistry;
    if (!registry) {
      throw new Error('Registry is required (provide in input or config)');
    }

    const namespace = input.namespace ?? config.defaultNamespace ?? 'default';
    const manifestPath = input.manifestPath ?? config.defaultManifestPath ?? 'deploy/k8s/workers';
    const taskQueue = input.taskQueue ?? 'golden-tools';
    const drainTimeout = input.drainTimeoutSeconds ?? config.defaultDrainTimeoutSeconds ?? 600;

    // Step 1: Build and push container image
    const imageTag = `${registry}/harmony-worker:${input.version}`;
    const buildArgs: Record<string, string> = {
      WORKER_BUILD_ID: input.version,
      ...input.buildArgs,
    };

    const buildResult = await this.executeById<
      {
        operation: string;
        context: string;
        dockerfile?: string;
        tags: string[];
        registry?: string;
        buildArgs?: Record<string, string>;
      },
      {
        imageRef: string;
        digest?: string;
        pushed: boolean;
        buildDuration: number;
      }
    >('golden.ci.container-builder', {
      operation: 'build-and-push',
      context: input.contextPath,
      dockerfile: input.dockerfile,
      tags: [imageTag],
      registry,
      buildArgs,
    });

    // Register compensation: can't easily "unpush" but we can note it
    this.addCompensation(async () => {
      // Log compensation - actual image deletion would require registry-delete capability
      console.log(`Compensation: Image ${buildResult.imageRef} was pushed but deploy failed`);
    });

    // Step 2: Generate and sync feature flags (unless skipped)
    let flagSyncStatus: 'SYNCED' | 'PENDING' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
    if (!input.skipFlags) {
      // Generate release flags
      await this.executeById<
        { operation: string; releaseVersion: string },
        { flagdConfigPath: string; flagsGenerated: unknown[] }
      >('golden.flags.auto-feature-flag', {
        operation: 'generateReleaseFlags',
        releaseVersion: input.version,
      });

      // Sync flags to flagd ConfigMap
      const syncResult = await this.executeById<
        { operation: string; version: string; namespace: string },
        { status: string; flagsCount: number }
      >('golden.flags.flagd-sync', {
        operation: 'sync',
        version: input.version,
        namespace,
      });

      flagSyncStatus = syncResult.status as 'SYNCED' | 'PENDING' | 'FAILED';

      // Compensation: rollback flags if deployment fails
      this.addCompensation(async () => {
        await this.executeById('golden.flags.auto-feature-flag', {
          operation: 'rollbackRelease',
          releaseVersion: input.version,
        });
      });
    }

    // Step 3: Deploy new workers to Kubernetes
    const k8sResult = await this.executeById<
      {
        operation: string;
        manifestPath: string;
        namespace: string;
        substitutions: Record<string, string>;
        wait: boolean;
      },
      {
        success: boolean;
        resourcesAffected: number;
        message: string;
      }
    >('golden.k8s.apply', {
      operation: 'apply',
      manifestPath,
      namespace,
      substitutions: {
        BUILD_ID: input.version,
        IMAGE_TAG: input.version,
        IMAGE_REF: imageTag,
      },
      wait: true,
    });

    if (!k8sResult.success) {
      throw new Error(`K8s apply failed: ${k8sResult.message}`);
    }

    // Compensation: rollout-restart to previous state
    this.addCompensation(async () => {
      await this.executeById('golden.k8s.apply', {
        operation: 'rollout-restart',
        namespace,
        resourceType: 'deployment',
      });
    });

    // Step 4: Register new Build ID as default with Temporal
    await this.executeById<
      { operation: string; buildId: string; taskQueue: string },
      { success: boolean; message: string }
    >('golden.temporal.version-manager', {
      operation: 'registerBuildAsDefault',
      buildId: input.version,
      taskQueue,
    });

    // Step 5: Wait for old version to drain (if specified)
    let drainStatus: 'DRAINED' | 'SKIPPED' | 'TIMEOUT' = 'SKIPPED';
    if (input.previousBuildId && input.waitForDrain !== false) {
      try {
        const drainResult = await this.executeById<
          {
            operation: string;
            buildId: string;
            taskQueue: string;
            timeoutSeconds: number;
          },
          {
            success: boolean;
            activeExecutions: number;
            drainDurationMs?: number;
          }
        >('golden.temporal.version-manager', {
          operation: 'waitForDrain',
          buildId: input.previousBuildId,
          taskQueue,
          timeoutSeconds: drainTimeout,
        });

        drainStatus = drainResult.success ? 'DRAINED' : 'TIMEOUT';
      } catch (error) {
        // Drain timeout is not fatal - old workflows will complete eventually
        drainStatus = 'TIMEOUT';
        console.warn(`Drain timeout for ${input.previousBuildId}: ${error}`);
      }
    }

    return {
      success: true,
      imageRef: buildResult.imageRef,
      digest: buildResult.digest,
      buildId: input.version,
      resourcesAffected: k8sResult.resourcesAffected,
      flagSyncStatus,
      drainStatus,
      message: `Successfully deployed ${input.version} to ${namespace}. Image: ${buildResult.imageRef}. Build ID registered. ${drainStatus === 'DRAINED' ? 'Previous version drained.' : ''}`,
    };
  }
}
