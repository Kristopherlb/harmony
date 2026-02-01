/**
 * packages/core/src/ass/golden-path-state.ts
 * AIP shared state schema for multi-agent systems (GoldenPathState).
 */
import { Annotation } from '@langchain/langgraph';
import { z } from '@golden/schema-registry';

/** Artifact entry in state (AIP). */
export interface ArtifactEntry {
  content: string;
  type: 'CAPABILITY' | 'BLUEPRINT' | 'EVAL' | 'TEST';
  status: 'DRAFT' | 'AUDITED' | 'CERTIFIED' | 'REJECTED';
}

/** Pending HITL action (AIP). */
export interface PendingAction {
  type: 'CLARIFICATION' | 'OAUTH' | 'SECRET' | 'APPROVAL';
  message: string;
  resolved: boolean;
}

/** Zod schemas for ASS stateSchema requirement (ASS-001). */
export const artifactEntrySchema = z.object({
  content: z.string(),
  type: z.enum(['CAPABILITY', 'BLUEPRINT', 'EVAL', 'TEST']),
  status: z.enum(['DRAFT', 'AUDITED', 'CERTIFIED', 'REJECTED']),
});

export const pendingActionSchema = z.object({
  type: z.enum(['CLARIFICATION', 'OAUTH', 'SECRET', 'APPROVAL']),
  message: z.string(),
  resolved: z.boolean(),
});

/** Zod schema matching the AIP GoldenPathState shape. */
export const goldenPathStateSchema = z.object({
  intent: z.string(),
  active_task_id: z.string(),
  artifacts: z.record(artifactEntrySchema),
  reasoning_history: z.array(z.string()),
  pending_actions: z.array(pendingActionSchema),
  trace_id: z.string(),
});

/** Normative state schema for Golden Path agents (AIP-001). */
export const GoldenPathState = Annotation.Root({
  intent: Annotation<string>,
  active_task_id: Annotation<string>,
  artifacts: Annotation<Record<string, ArtifactEntry>>,
  reasoning_history: Annotation<string[]>,
  pending_actions: Annotation<PendingAction[]>,
  trace_id: Annotation<string>,
});

export type GoldenPathStateType = typeof GoldenPathState.State;
