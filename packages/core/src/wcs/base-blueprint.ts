/**
 * packages/core/src/wcs/base-blueprint.ts
 * WCS BaseBlueprint: determinism wrappers, saga LIFO, executeCapability integration.
 * This file is intended to be bundled as Temporal workflow code.
 * In workflow code use this.now(), this.uuid(), this.sleep() only; no raw Date/Math.random/setTimeout.
 */
import * as wf from '@temporalio/workflow';
import type { z } from '@golden/schema-registry';
import type { Capability } from '../ocs/capability.js';
import type { GoldenContext } from '../context/golden-context.js';
import type { CompensationFn } from '../types.js';
import type { SecurityContext } from './security-context.js';
import type { ExecuteCapabilityActivityInput } from './execute-capability-activity.js';
import { createSagaManager } from './saga-manager.js';
import {
  approvalSignal,
  approvalStateQuery,
  type ApprovalSignalPayload,
  type ApprovalState,
  type ApprovalRequestParams,
  type ApprovalResult,
  ApprovalTimeoutError,
  ApprovalRejectedError,
} from './approval-signal.js';

/** Memo key for SecurityContext (platform passes this when starting the workflow). */
export const SECURITY_CONTEXT_MEMO_KEY = 'golden.securityContext';
/** Memo key for GoldenContext (preferred for trace + golden.* attributes). */
export const GOLDEN_CONTEXT_MEMO_KEY = 'golden.context';

/**
 * Input for flag evaluation activity.
 * Used by checkFlag() to evaluate OpenFeature flags deterministically.
 */
export interface EvaluateFlagActivityInput {
  /** Feature flag key to evaluate */
  flagKey: string;
  /** Default value if flag cannot be evaluated */
  defaultValue: boolean;
  /** Evaluation context for targeting */
  context?: Record<string, unknown>;
}

/**
 * Error thrown when a capability is disabled via feature flag.
 * Allows callers to handle disabled capabilities gracefully.
 */
export class CapabilityDisabledError extends Error {
  constructor(
    public readonly capabilityId: string,
    public readonly flagKey: string
  ) {
    super(`Capability '${capabilityId}' is disabled via feature flag '${flagKey}'`);
    this.name = 'CapabilityDisabledError';
  }
}

/** Activity interface for ExecuteCapability; worker implements and registers. */
export interface ExecuteCapabilityActivity {
  executeDaggerCapability<In, Out>(input: ExecuteCapabilityActivityInput<In>): Promise<Out>;
}

/** Activity interface for flag evaluation; worker implements and registers. */
export interface FlagActivity {
  evaluateFlag(input: EvaluateFlagActivityInput): Promise<boolean>;
}

/** Activity interface for approval notifications; worker implements and registers. */
export interface ApprovalNotificationActivity {
  /** Send approval request to Slack channel with Block Kit buttons. */
  sendApprovalRequestToSlack(params: {
    channel: string;
    workflowId: string;
    reason: string;
    requiredRoles: string[];
    timeout: string;
    requestedBy: string;
    incidentId?: string;
    incidentSeverity?: string;
  }): Promise<{ messageTs: string }>;

  /** Update Slack message after approval decision. */
  updateApprovalMessage(params: {
    channel: string;
    messageTs: string;
    originalReason: string;
    decision: ApprovalSignalPayload;
    durationMs: number;
  }): Promise<void>;
}

/**
 * BaseBlueprint contract (WCS). Use this.now(), this.uuid(), this.sleep() only; no Date/Math.random/setTimeout.
 */
export abstract class BaseBlueprint<Input, Output, Config> {
  private readonly _saga = createSagaManager();
  
  // Approval state tracking
  private _approvalState: ApprovalState | null = null;
  private _approvalDecision: ApprovalSignalPayload | null = null;

  abstract readonly metadata: {
    id: string;
    version: string;
    name: string;
    description: string;
    owner: string;
    costCenter: string;
    tags: string[];
  };

  abstract readonly security: {
    requiredRoles: string[];
    classification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    oscalControlIds?: string[];
  };

  abstract readonly operations: {
    /** Human-readable durations (e.g. '15m', '1h'). Passed to Temporal activity timeouts. */
    sla: { targetDuration: string; maxDuration: string };
    alerting?: { errorRateThreshold: number };
  };

  abstract readonly inputSchema: z.ZodSchema<Input>;
  abstract readonly configSchema: z.ZodSchema<Config>;
  protected abstract logic(input: Input, config: Config): Promise<Output>;

  /** Security context from workflow memo (injected by platform at start). */
  protected get securityContext(): SecurityContext {
    const memo = wf.workflowInfo().memo;
    const ctx = memo?.[SECURITY_CONTEXT_MEMO_KEY] as SecurityContext | undefined;
    if (!ctx?.initiatorId) throw new Error('SecurityContext not set in workflow memo');
    return ctx;
  }

  /** GoldenContext from workflow memo (preferred). */
  protected get goldenContext(): GoldenContext | undefined {
    const memo = wf.workflowInfo().memo;
    return memo?.[GOLDEN_CONTEXT_MEMO_KEY] as GoldenContext | undefined;
  }

  /** Safe deterministic time (WCS 2.1.2). Temporal patches Date in workflow bundle. */
  // eslint-disable-next-line no-restricted-syntax -- Only sanctioned use of Date in workflow code; Temporal provides deterministic Date.now() in bundle.
  protected get now(): number {
    return Date.now();
  }

  protected uuid(): string {
    return wf.uuid4();
  }

  protected async sleep(ms: number): Promise<void> {
    return wf.sleep(ms);
  }

  /**
   * Execute a capability by ID via the platform activity (preferred; aligns with Metric 1).
   * Checks the cap-{capId}-enabled feature flag before execution unless skipFlagCheck is true.
   *
   * @param capId - Capability ID to execute
   * @param input - Input for the capability
   * @param options - Optional config, secretRefs, and flag check settings
   * @throws CapabilityDisabledError if capability is disabled via feature flag
   */
  protected async executeById<In, Out>(
    capId: string,
    input: In,
    options?: {
      config?: unknown;
      secretRefs?: unknown;
      /**
       * Skip the feature flag check for this capability execution.
       * Use for flag-related capabilities to avoid circular dependencies,
       * or when you've already verified the flag state.
       */
      skipFlagCheck?: boolean;
      /** Optional correlation metadata for UI mapping (e.g. Workbench node id). */
      correlation?: { nodeId: string };
    }
  ): Promise<Out> {
    // Check capability feature flag unless explicitly skipped
    // Skip flag check for flag-related capabilities to avoid circular dependencies
    const isFlagCapability = capId.startsWith('golden.flags.');
    const shouldCheckFlag = !options?.skipFlagCheck && !isFlagCapability;

    if (shouldCheckFlag) {
      const flagKey = `cap-${capId}-enabled`;
      const isEnabled = await this.checkFlag(flagKey, true);

      if (!isEnabled) {
        throw new CapabilityDisabledError(capId, flagKey);
      }
    }

    const activities = wf.proxyActivities<ExecuteCapabilityActivity>({
      // Temporal accepts string for activity timeouts (e.g. '5m', '1h')
      startToCloseTimeout: this.operations.sla.maxDuration as Parameters<typeof wf.proxyActivities>[0]['startToCloseTimeout'],
    });
    const ctx = this.goldenContext;
    if (!ctx) {
      throw new Error('GoldenContext not set in workflow memo (required for capability execution)');
    }
    const payload: ExecuteCapabilityActivityInput<In> = {
      capId,
      input,
      config: options?.config,
      secretRefs: options?.secretRefs,
      correlation: options?.correlation,
      runAs: this.securityContext.initiatorId,
      traceId: this.securityContext.traceId ?? ctx?.trace_id ?? wf.workflowInfo().workflowId,
      ctx,
    };
    return activities.executeDaggerCapability<In, Out>(payload);
  }

  /**
   * Evaluate a feature flag via activity to maintain workflow determinism.
   * Uses OpenFeature evaluation with the current security/golden context.
   *
   * If the security context is not available, returns the default value
   * to avoid blocking workflows that don't have proper memo set.
   *
   * @param flagKey - The feature flag key to evaluate
   * @param defaultValue - Default value if flag cannot be evaluated
   * @returns The evaluated flag value
   */
  protected async checkFlag(flagKey: string, defaultValue: boolean): Promise<boolean> {
    // Try to get security context, but don't fail if not available
    // This allows workflows to run without strict memo requirements
    let initiatorId: string | undefined;
    try {
      initiatorId = this.securityContext.initiatorId;
    } catch {
      // Security context not set - return default value
      // This is expected when workflows are started without memo
      return defaultValue;
    }

    const flagActivities = wf.proxyActivities<FlagActivity>({
      startToCloseTimeout: '30s',
      retry: {
        maximumAttempts: 3,
        initialInterval: '1s',
        backoffCoefficient: 2,
      },
    });

    const ctx = this.goldenContext;

    return flagActivities.evaluateFlag({
      flagKey,
      defaultValue,
      context: {
        // Include context for flag targeting
        initiatorId,
        appId: ctx?.app_id,
        environment: ctx?.environment,
        workflowId: wf.workflowInfo().workflowId,
      },
    });
  }

  /**
   * Wait for human approval before proceeding with sensitive operations.
   * Implements AIP/AECS HITL pattern with configurable notifications and timeout.
   *
   * @param params - Approval request parameters
   * @returns ApprovalResult with decision details
   * @throws ApprovalTimeoutError if approval times out
   * @throws ApprovalRejectedError if approval is rejected
   *
   * @example
   * ```typescript
   * const result = await this.waitForApproval({
   *   reason: 'Deploy to production requires approval',
   *   requiredRoles: ['ops-lead', 'sre'],
   *   timeout: '30m',
   *   notifySlackChannel: '#deployments',
   * });
   * if (result.approved) {
   *   // Proceed with deployment
   * }
   * ```
   */
  protected async waitForApproval(params: ApprovalRequestParams): Promise<ApprovalResult> {
    const workflowId = wf.workflowInfo().workflowId;
    const timeout = params.timeout ?? '1h';
    const requiredRoles = params.requiredRoles ?? [];
    const requestedAt = new Date(this.now).toISOString();
    const startTime = this.now;

    // Initialize approval state
    this._approvalState = {
      status: 'pending',
      requestedAt,
      requestReason: params.reason,
      requiredRoles,
      timeout,
      workflowId,
    };
    this._approvalDecision = null;

    // Set up signal handler for approval
    wf.setHandler(approvalSignal, (payload: ApprovalSignalPayload) => {
      // Validate approver has required role (if roles specified)
      if (requiredRoles.length > 0) {
        const hasRequiredRole = payload.approverRoles.some((role) =>
          requiredRoles.includes(role)
        );
        if (!hasRequiredRole) {
          // Ignore approval from unauthorized user
          return;
        }
      }

      this._approvalDecision = payload;
      this._approvalState = {
        ...this._approvalState!,
        status: payload.decision === 'approved' ? 'approved' : 'rejected',
        decision: payload,
      };
    });

    // Set up query handler for approval state
    wf.setHandler(approvalStateQuery, () => this._approvalState!);

    // Send Slack notification if channel specified
    let slackMessageTs: string | undefined;
    if (params.notifySlackChannel) {
      try {
        const ctx = this.goldenContext;
        const notificationActivities = wf.proxyActivities<ApprovalNotificationActivity>({
          startToCloseTimeout: '30s',
          retry: { maximumAttempts: 3, initialInterval: '1s', backoffCoefficient: 2 },
        });

        const requestedBy = ctx?.initiator_id ?? this.securityContext.initiatorId;
        
        const result = await notificationActivities.sendApprovalRequestToSlack({
          channel: params.notifySlackChannel,
          workflowId,
          reason: params.notifyMessage ?? params.reason,
          requiredRoles,
          timeout,
          requestedBy,
          incidentId: ctx?.incident_id,
          incidentSeverity: ctx?.incident_severity,
        });

        slackMessageTs = result.messageTs;
        this._approvalState = {
          ...this._approvalState!,
          slackMessageTs,
          slackChannel: params.notifySlackChannel,
        };
      } catch (err) {
        // Log but don't fail if Slack notification fails
        // The workflow can still be approved via console
        console.warn('Failed to send Slack approval notification:', err);
      }
    }

    // Parse timeout duration to milliseconds
    const timeoutMs = parseDurationToMs(timeout);

    // Wait for approval signal or timeout
    const gotDecision = await wf.condition(
      () => this._approvalDecision !== null,
      timeoutMs
    );

    const durationMs = this.now - startTime;

    // Handle timeout
    if (!gotDecision) {
      this._approvalState = {
        ...this._approvalState!,
        status: 'timeout',
      };

      // Update Slack message to show timeout
      if (slackMessageTs && params.notifySlackChannel) {
        try {
          const notificationActivities = wf.proxyActivities<ApprovalNotificationActivity>({
            startToCloseTimeout: '30s',
          });
          await notificationActivities.updateApprovalMessage({
            channel: params.notifySlackChannel,
            messageTs: slackMessageTs,
            originalReason: params.reason,
            decision: {
              decision: 'rejected',
              approverId: 'system',
              approverRoles: [],
              reason: 'Approval request timed out',
              timestamp: new Date(this.now).toISOString(),
              source: 'api',
            },
            durationMs,
          });
        } catch {
          // Ignore update failure
        }
      }

      throw new ApprovalTimeoutError(workflowId, timeout, params.reason);
    }

    const decision = this._approvalDecision!;

    // Update Slack message with decision
    if (slackMessageTs && params.notifySlackChannel) {
      try {
        const notificationActivities = wf.proxyActivities<ApprovalNotificationActivity>({
          startToCloseTimeout: '30s',
        });
        await notificationActivities.updateApprovalMessage({
          channel: params.notifySlackChannel,
          messageTs: slackMessageTs,
          originalReason: params.reason,
          decision,
          durationMs,
        });
      } catch {
        // Ignore update failure
      }
    }

    // Handle rejection
    if (decision.decision === 'rejected') {
      throw new ApprovalRejectedError(decision);
    }

    return {
      approved: true,
      decision,
      durationMs,
    };
  }

  /** Execute capability via platform activity; no custom activity code (WCS 2.1.3). */
  protected async execute<In, Out>(capability: Capability<In, Out, unknown, unknown>, input: In): Promise<Out> {
    return this.executeById<In, Out>(capability.metadata.id, input);
  }

  protected addCompensation(fn: CompensationFn): void {
    this._saga.addCompensation(fn);
  }

  /** Main entry: validate input/config, run logic, on failure run compensations (LIFO) then rethrow. */
  public async main(input: Input, config: Config): Promise<Output> {
    const parsedInput = this.inputSchema.parse(input) as Input;
    const parsedConfig = this.configSchema.parse(config) as Config;
    try {
      return await this.logic(parsedInput, parsedConfig);
    } catch (err) {
      await this._saga.runCompensations();
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a duration string (e.g., '30m', '1h', '2d') to milliseconds.
 * Supports: s (seconds), m (minutes), h (hours), d (days)
 */
function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i);
  if (!match) {
    // Default to 1 hour if format not recognized
    return 60 * 60 * 1000;
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000; // Default to 1 hour
  }
}
