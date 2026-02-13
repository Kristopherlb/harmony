/**
 * packages/apps/console/client/src/features/workbench/node-explanation.ts
 *
 * Builds the "Explain step" message for the agent (Phase 4.2.3).
 * When the user clicks "Explain" on a node, this message is sent to the chat
 * so the agent can call explainStep with a clear explanation.
 */

import type { BlueprintNode } from "./types";

/**
 * Builds the prompt text for asking the agent to explain why a step was added.
 */
export function buildExplainStepMessage(input: {
  node: BlueprintNode;
}): string {
  const { node } = input;
  return `Explain why you added the step "${node.label}" (id: ${node.id}) in this workflow.`;
}
