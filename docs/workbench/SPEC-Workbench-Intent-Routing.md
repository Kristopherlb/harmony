# SPEC: Workbench Intent Routing

Status: Approved  
Scope: Chat request classification and routing in Workbench agent service

Skills used:

- `.cursor/skills/workbench-prompt-patterns/SKILL.md`
- `.cursor/skills/feature-golden-path/SKILL.md`
- `test-driven-development`

---

## 1. Objective

Route user chat turns to the correct path:

- discovery path for capability/tool browsing intent
- generation path for workflow creation/refinement intent

This prevents false workflow generation when users ask exploration questions.

---

## 2. Normative Requirements

### 2.1 Intent Classes

Router MUST classify at least:

- `capability_discovery`
- `workflow_generation`
- `default` (falls back to generation unless explicitly configured otherwise)

### 2.2 Classifier Strategy

- Initial implementation SHOULD use a few-shot classifier prompt with 3-5 examples per class.
- Keyword-only routing MAY be used as fallback but SHOULD NOT be primary path once few-shot classifier is available.

### 2.3 Ambiguity Resolution

- If intent is ambiguous, router SHOULD ask a concise clarifying question or route via conservative default.
- Discovery prompts MUST NOT auto-generate a draft unless user confirms generation intent.

### 2.4 Execution-Monitor Compatibility

- Existing status/cancel query handling MUST continue to work with routing in place.
- Fixture mode behavior MUST remain stable.

---

## 3. Few-Shot Examples (Minimum Set)

Discovery examples:

- "What can you do?"
- "List tools for incident response."
- "What integrations are available?"

Generation examples:

- "Create a workflow that verifies rollout health and pages on failure."
- "Add an approval step before deploy."
- "Refine this draft to include rollback."

Ambiguous examples:

- "How do I investigate a failed deploy?"
- "Can you help with incidents?"

---

## 4. Implementation Touchpoints

- `packages/apps/console/server/services/openai-agent-service.ts`
- `packages/apps/console/server/agent/prompts/blueprint-generation.ts`
- `packages/apps/console/server/agent/execution-monitor.ts`
- `packages/apps/console/server/routers/chat-router.ts`

---

## 5. Validation

Contract checks:

- Intent router unit tests for all classes and ambiguity cases.
- Service tests proving discovery path does not force draft generation.

Local smoke checks:

- Discovery asks return capability-oriented guidance.
- Generation asks continue producing/refining valid drafts.

---

## 6. Success Metric

- `hallucination_rate_tool_miss` declines after Milestones 2-3.
- Discovery sessions with unintended draft generation trend toward zero.

