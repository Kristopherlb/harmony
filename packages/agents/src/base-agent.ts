/**
 * packages/agents/src/base-agent.ts
 * BaseAgent: composes AgentSpec, GoldenPathState, discoverTools(), and guardrails (ASS-001).
 */
import {
  GoldenPathState,
  type GoldenPathStateType,
  discoverTools,
  checkIterationGuardrail,
  checkTokenGuardrail,
  checkRestrictedToolGuardrail,
  type AgentSpec,
  type ToolRegistry,
  type ToolId,
  type GuardrailOptions,
  type GuardrailResult,
} from '@golden/core';

export interface BaseAgentOptions {
  metadata: AgentSpec<GoldenPathStateType>['metadata'];
  authorizedTools: ToolId[];
  systemPrompt: string;
  guardrails: GuardrailOptions;
}

/**
 * Base agent: wires GoldenPathState, discoverTools(), and guardrails.
 * Subclasses or callers build the graph and invoke guardrail checks each cycle.
 */
export class BaseAgent {
  readonly metadata: BaseAgentOptions['metadata'];
  readonly authorizedTools: ToolId[];
  readonly systemPrompt: string;
  readonly guardrails: GuardrailOptions;

  constructor(options: BaseAgentOptions) {
    this.metadata = options.metadata;
    this.authorizedTools = options.authorizedTools;
    this.systemPrompt = options.systemPrompt;
    this.guardrails = options.guardrails;
  }

  /** Resolve authorized tool IDs to callable tools from registry (AIP-001). */
  getTools(registry: ToolRegistry): ReturnType<typeof discoverTools> {
    return discoverTools(registry, this.authorizedTools);
  }

  /** Enforce max_iterations (ASS 2.3.2). */
  checkIteration(currentIterations: number): GuardrailResult {
    return checkIterationGuardrail(currentIterations, this.guardrails);
  }

  /** Enforce token_limit when set (ASS 2.3.2). */
  checkTokens(currentTokens: number): GuardrailResult {
    return checkTokenGuardrail(currentTokens, this.guardrails);
  }

  /** RESTRICTED tool → requires HITL (ASS 2.3.3); caller should set pending_actions and interrupt. */
  checkRestrictedTool(dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'): GuardrailResult {
    return checkRestrictedToolGuardrail(dataClassification);
  }
}

export { GoldenPathState, type GoldenPathStateType };
