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

/** Memo key for SecurityContext (platform passes this when starting the workflow). */
export const SECURITY_CONTEXT_MEMO_KEY = 'golden.securityContext';
/** Memo key for GoldenContext (preferred for trace + golden.* attributes). */
export const GOLDEN_CONTEXT_MEMO_KEY = 'golden.context';

/** Activity interface for ExecuteCapability; worker implements and registers. */
export interface ExecuteCapabilityActivity {
  executeDaggerCapability<In, Out>(input: ExecuteCapabilityActivityInput<In>): Promise<Out>;
}

/**
 * BaseBlueprint contract (WCS). Use this.now(), this.uuid(), this.sleep() only; no Date/Math.random/setTimeout.
 */
export abstract class BaseBlueprint<Input, Output, Config> {
  private readonly _saga = createSagaManager();

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

  /** Execute a capability by ID via the platform activity (preferred; aligns with Metric 1). */
  protected async executeById<In, Out>(
    capId: string,
    input: In,
    options?: { config?: unknown; secretRefs?: unknown }
  ): Promise<Out> {
    const activities = wf.proxyActivities<ExecuteCapabilityActivity>({
      startToCloseTimeout: this.operations.sla.maxDuration,
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
      runAs: this.securityContext.initiatorId,
      traceId: this.securityContext.traceId ?? ctx?.trace_id ?? wf.workflowInfo().workflowId,
      ctx,
    };
    return activities.executeDaggerCapability<In, Out>(payload);
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
