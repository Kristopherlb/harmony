/**
 * packages/blueprints/src/workflows/traffic/progressive-rollout.workflow.ts
 * Progressive Rollout Blueprint (WCS-001)
 *
 * Staged rollout with automatic analysis and rollback.
 * Uses OpenFeature flags and canary metrics for decision-making.
 * Composes: openfeature-provider + auto-feature-flag + mesh-router + canary-analyzer.
 */
import { BaseBlueprint } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';

export interface ProgressiveRolloutInput {
  /** New version being rolled out */
  version: string;
  /** Baseline version to compare against */
  baselineVersion: string;
  /** Prometheus URL for metrics */
  prometheusUrl: string;
  /** Service name for mesh routing */
  service: string;
  /** Rollout stages (percentages), e.g., [10, 25, 50, 75, 100] */
  stages?: number[];
  /** Time window for canary analysis (seconds) */
  analysisWindowSeconds?: number;
  /** Error rate threshold for rollback decision */
  errorRateThreshold?: number;
  /** Whether to use mesh routing in addition to flags */
  useMeshRouting?: boolean;
  /** Kubernetes namespace */
  namespace?: string;
  /** Mesh type (istio or linkerd) */
  meshType?: 'istio' | 'linkerd';
}

export interface ProgressiveRolloutOutput {
  /** Final status */
  status: 'PROMOTED' | 'ROLLED_BACK' | 'FAILED';
  /** Final rollout percentage achieved */
  finalPercentage: number;
  /** Reason for decision (if rolled back) */
  reason?: string;
  /** Stage at which rollback occurred */
  stoppedAtPercentage?: number;
  /** Canary analysis results per stage */
  stageResults: Array<{
    percentage: number;
    decision: 'PROMOTE' | 'ROLLBACK' | 'CONTINUE';
    metrics: {
      baselineErrorRate?: number;
      canaryErrorRate?: number;
      latencyDelta?: number;
    };
  }>;
  /** Human-readable summary */
  message: string;
}

export interface ProgressiveRolloutConfig {
  /** Default Prometheus URL */
  defaultPrometheusUrl?: string;
  /** Default analysis window */
  defaultAnalysisWindowSeconds?: number;
  /** Default error threshold */
  defaultErrorRateThreshold?: number;
  /** Default stages */
  defaultStages?: number[];
  /** Default mesh type */
  defaultMeshType?: 'istio' | 'linkerd';
}

export class ProgressiveRolloutWorkflow extends BaseBlueprint<
  ProgressiveRolloutInput,
  ProgressiveRolloutOutput,
  ProgressiveRolloutConfig
> {
  readonly metadata = {
    id: 'blueprints.traffic.progressive-rollout',
    version: '1.0.0',
    name: 'Progressive Rollout',
    description:
      'Staged rollout with automatic analysis and rollback. Uses OpenFeature flags for feature gates and canary metrics for rollout decisions. Supports Istio/Linkerd mesh routing.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['traffic', 'rollout', 'canary', 'feature-flags', 'service-mesh'],
  };

  readonly security = {
    requiredRoles: ['traffic:rollout'],
    classification: 'INTERNAL' as const,
    oscalControlIds: ['CM-3', 'SI-4', 'CA-7'], // Change control, monitoring, continuous monitoring
  };

  readonly operations = {
    sla: { targetDuration: '30m', maxDuration: '2h' },
    alerting: { errorRateThreshold: 0.1 },
  };

  readonly inputSchema = z.object({
    version: z.string().describe('New version being rolled out'),
    baselineVersion: z.string().describe('Baseline version to compare against'),
    prometheusUrl: z.string().describe('Prometheus URL for metrics'),
    service: z.string().describe('Service name for mesh routing'),
    stages: z.array(z.number().min(0).max(100)).optional().describe('Rollout stages'),
    analysisWindowSeconds: z.number().positive().optional().describe('Analysis window'),
    errorRateThreshold: z.number().min(0).max(1).optional().describe('Error rate threshold'),
    useMeshRouting: z.boolean().optional().describe('Use mesh routing'),
    namespace: z.string().optional().describe('Kubernetes namespace'),
    meshType: z.enum(['istio', 'linkerd']).optional().describe('Mesh type'),
  }) as BaseBlueprint<ProgressiveRolloutInput, ProgressiveRolloutOutput, ProgressiveRolloutConfig>['inputSchema'];

  readonly configSchema = z.object({
    defaultPrometheusUrl: z.string().optional(),
    defaultAnalysisWindowSeconds: z.number().optional(),
    defaultErrorRateThreshold: z.number().optional(),
    defaultStages: z.array(z.number()).optional(),
    defaultMeshType: z.enum(['istio', 'linkerd']).optional(),
  }) as BaseBlueprint<ProgressiveRolloutInput, ProgressiveRolloutOutput, ProgressiveRolloutConfig>['configSchema'];

  protected async logic(
    input: ProgressiveRolloutInput,
    config: ProgressiveRolloutConfig
  ): Promise<ProgressiveRolloutOutput> {
    const stages = input.stages ?? config.defaultStages ?? [10, 25, 50, 75, 100];
    const analysisWindow = input.analysisWindowSeconds ?? config.defaultAnalysisWindowSeconds ?? 300;
    const errorThreshold = input.errorRateThreshold ?? config.defaultErrorRateThreshold ?? 0.05;
    const prometheusUrl = input.prometheusUrl ?? config.defaultPrometheusUrl;
    const namespace = input.namespace ?? 'default';
    const meshType = input.meshType ?? config.defaultMeshType ?? 'istio';
    const useMeshRouting = input.useMeshRouting ?? false;

    if (!prometheusUrl) {
      throw new Error('Prometheus URL is required for canary analysis');
    }

    const releaseFlag = `release-${input.version}-enabled`;
    const stageResults: ProgressiveRolloutOutput['stageResults'] = [];

    // Verify release flag exists (or create it if needed)
    try {
      await this.executeById<
        { operation: string; flagKey: string; defaultValue: boolean },
        { value: boolean; details: unknown }
      >('golden.flags.openfeature-provider', {
        operation: 'evaluateBoolean',
        flagKey: releaseFlag,
        defaultValue: false,
      });
    } catch {
      // Flag doesn't exist yet, generate it
      await this.executeById<
        { operation: string; releaseVersion: string },
        { flagsGenerated: unknown[] }
      >('golden.flags.auto-feature-flag', {
        operation: 'generateReleaseFlags',
        releaseVersion: input.version,
      });
    }

    // Iterate through rollout stages
    for (const percentage of stages) {
      // Step 1: Update flag rollout percentage
      await this.executeById<
        {
          operation: string;
          targetId: string;
          enabled: boolean;
          rolloutPercentage: number;
        },
        { flagsUpdated: string[]; message: string }
      >('golden.flags.auto-feature-flag', {
        operation: 'setFlagState',
        targetId: releaseFlag,
        enabled: true,
        rolloutPercentage: percentage,
      });

      // Step 2: Optionally adjust mesh traffic weights
      if (useMeshRouting) {
        await this.executeById<
          {
            operation: string;
            service: string;
            namespace?: string;
            meshType?: string;
            weights: { stable: number; canary: number };
          },
          { success: boolean; currentWeights: unknown }
        >('golden.traffic.mesh-router', {
          operation: 'set-weights',
          service: input.service,
          namespace,
          meshType,
          weights: {
            stable: 100 - percentage,
            canary: percentage,
          },
        });
      }

      // Step 3: Wait for analysis window
      // Use deterministic sleep from base class
      await this.sleep(analysisWindow * 1000);

      // Step 4: Analyze canary metrics
      const analysis = await this.executeById<
        {
          operation: string;
          baselineVersion: string;
          canaryVersion: string;
          prometheusUrl: string;
          analysisWindowSeconds: number;
          errorRateThreshold: number;
          service?: string;
          namespace?: string;
        },
        {
          decision: 'PROMOTE' | 'ROLLBACK' | 'CONTINUE';
          baselineMetrics: Record<string, number>;
          canaryMetrics: Record<string, number>;
          deltas: Record<string, number>;
          reason: string;
        }
      >('golden.traffic.canary-analyzer', {
        operation: 'analyze',
        baselineVersion: input.baselineVersion,
        canaryVersion: input.version,
        prometheusUrl,
        analysisWindowSeconds: analysisWindow,
        errorRateThreshold: errorThreshold,
        service: input.service,
        namespace,
      });

      // Record stage result
      stageResults.push({
        percentage,
        decision: analysis.decision,
        metrics: {
          baselineErrorRate: analysis.baselineMetrics.error_rate,
          canaryErrorRate: analysis.canaryMetrics.error_rate,
          latencyDelta: analysis.deltas.latency_p99,
        },
      });

      // Step 5: Handle rollback decision
      if (analysis.decision === 'ROLLBACK') {
        // Rollback: disable release flag
        await this.executeById('golden.flags.auto-feature-flag', {
          operation: 'rollbackRelease',
          releaseVersion: input.version,
        });

        // Reset mesh routing if used
        if (useMeshRouting) {
          await this.executeById('golden.traffic.mesh-router', {
            operation: 'set-weights',
            service: input.service,
            namespace,
            meshType,
            weights: { stable: 100, canary: 0 },
          });
        }

        return {
          status: 'ROLLED_BACK',
          finalPercentage: percentage,
          stoppedAtPercentage: percentage,
          reason: analysis.reason,
          stageResults,
          message: `Rollback triggered at ${percentage}%: ${analysis.reason}`,
        };
      }

      // If not rollback and not final stage, continue to next stage
      // Decision is either PROMOTE or CONTINUE
    }

    // All stages completed successfully - fully promoted
    // Ensure release flag is at 100%
    await this.executeById('golden.flags.auto-feature-flag', {
      operation: 'setFlagState',
      targetId: releaseFlag,
      enabled: true,
      rolloutPercentage: 100,
    });

    // Reset mesh to 100% canary (now stable)
    if (useMeshRouting) {
      await this.executeById('golden.traffic.mesh-router', {
        operation: 'reset',
        service: input.service,
        namespace,
        meshType,
      });
    }

    return {
      status: 'PROMOTED',
      finalPercentage: 100,
      stageResults,
      message: `Successfully promoted ${input.version} through all stages. Release is now at 100%.`,
    };
  }
}
