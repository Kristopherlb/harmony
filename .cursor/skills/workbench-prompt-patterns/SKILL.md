---
name: workbench-prompt-patterns
description: Prompt engineering patterns for blueprint generation, iteration, template suggestion, and error recovery in the Workbench chat-canvas UX. Use when implementing Phase 4.2 (generative iteration) and refining agent prompts.
---

# Workbench Prompt Patterns

Use this skill when designing or updating LLM prompts for the Workbench: blueprint generation from natural language, iterative refinement, template suggestion, and error recovery.

## When to Use

- Implementing or tuning the system prompt for workflow/blueprint generation
- Adding few-shot examples for common workflow types
- Supporting multi-turn iteration (“change step 3”, “add error handling”)
- Enabling template awareness (“I can use the Incident Response template for this”)
- Handling errors and invalid IR from the model

## Instructions

### 1. System Prompt for Blueprint Generation

- **Role and output format:** Instruct the model to act as a workflow assistant that produces a **BlueprintDraft** (or a sequence of **EditIntent**s). Require structured output (JSON) that conforms to `spec/workbench-ir.schema.json`.
- **Tool contract:** If using a tool (e.g. `proposeWorkflow`), state that the model MUST call it with a valid BlueprintDraft object; include a short schema summary (title, summary, nodes with id/label/type, edges with source/target).
- **Constraints:** Only suggest steps that map to existing capabilities or to placeholders (“Configure Slack”, “Run script”) when no capability exists; prefer known tool IDs from the tool catalog when available.
- **Context:** Include the current draft (if any) in the context so the model can produce incremental edits (EditIntent) instead of full replace when the user asks for a change.

### 2. Few-Shot Examples for Common Workflows

- **Incident response:** “Create a workflow that: 1) receives an alert, 2) creates a Jira ticket, 3) sends a Slack notification.” → Example BlueprintDraft with 3 nodes and 2 edges.
- **CI/CD:** “Create a workflow that runs tests, then deploys to staging if tests pass.” → Example with conditional or linear steps.
- **Notification:** “Create a workflow that sends an email and posts to Slack when X happens.” → Example with 2 action nodes.

Keep examples short (3–5 steps) and schema-valid. Store in versioned prompt files (e.g. `packages/apps/console/server/agent/prompts/blueprint-generation.ts` or `.md`) so they can be updated without code changes.

### 3. Iteration / Refinement Prompt Patterns

- **Reference by position or label:** “Change step 3 to …” or “Rename the ‘Send Email’ step to …”. In the system prompt, tell the model to output an **EditIntent** (e.g. `rename`, `configure`) with the correct `nodeId` (infer from current draft).
- **Add/remove:** “Add a step after X that does Y” → EditIntent `add` with `afterNodeId`; “Remove the Slack step” → EditIntent `remove` with `nodeId`.
- **Reorder:** “Make the email step last” → EditIntent `reorder` with the desired `nodeIds` order.
- **Explain:** When the user asks “Why did you add this step?”, the model should respond in natural language using the draft and step metadata; no IR change.

### 4. Template Suggestion Prompt Patterns

- **When to suggest:** If the user’s intent matches a known template (e.g. “I need to handle incidents”), the model can respond: “I can use the **Incident Response** template for this. Should I load it?” and then, on confirmation, call a tool or return a reference to `templateId` so the client loads that template as the draft.
- **Template awareness:** Include a short list of template names and descriptions (or template IDs) in the system prompt or in a retrieved context so the model can suggest them by name. Prefer suggesting one template over generating from scratch when there’s a close match.
- **Metric:** Track “template suggested” vs “full draft generated” for Phase 5 (e.g. 30% of chats suggest a template).

### 5. Error Recovery Prompt Patterns

- **Invalid or incomplete IR:** If the model returns JSON that fails validation (schema or referential integrity), do not apply it. Respond to the user with a short, friendly message: “I couldn’t apply that change. Please try rephrasing or edit the step manually on the canvas.” Log the raw output server-side for debugging.
- **Ambiguous intent:** If the user’s request is ambiguous (e.g. “change the second step” when there are two “second” candidates), the model should ask a clarifying question: “Do you mean the ‘Send Slack’ step or the ‘Create Jira’ step?”
- **Unknown action:** If the user asks for an action that has no matching capability or template, the model should say so and suggest the closest available option or suggest adding a placeholder step.

### 6. Version Control for Prompts

- **Location:** Keep prompts in versioned files under `packages/apps/console/server/agent/prompts/` (or similar). Use a simple version comment or filename (e.g. `blueprint-generation.v2.md`) when making breaking changes.
- **Review:** Treat prompt changes as code: review for safety (no injection of user content into system prompt without sanitization), clarity, and alignment with schema. Consider an ADR for prompt versioning strategy if prompts evolve frequently.
- **Testing:** Where possible, run prompt tests with fixed inputs and assert that the output is valid IR (schema + referential integrity) or that the model asks a clarifying question.

## Related

- Chat→IR Contract: `spec/workbench-ir.schema.json` – schema for BlueprintDraft and EditIntent
- Workbench IR Validation: `docs/workbench-ir-validation.md` – validation rules and error surfacing
- Template Schema: `packages/core/src/templates/template-schema.ts` – TemplateDraft, TemplateManifest
- Workbench UX Implementation Plan – Phase 4.2 Enhanced Generative Iteration
