/**
 * packages/core/src/ass/agent-spec.ts
 * ASS AgentSpec contract (ASS-001).
 */
import type { StateGraph } from '@langchain/langgraph';
import type { z } from '@golden/schema-registry';

export interface AgentSpec<State = unknown> {
  metadata: {
    id: string;
    version: string;
    description: string;
  };
  stateSchema: z.ZodSchema<State>;
  authorizedTools: string[];
  systemPrompt: string;
  graph: StateGraph<State>;
}
