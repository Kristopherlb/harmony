# Retrospective: Workbench UX Phase 4.2 – Enhanced Generative Iteration (Full)

**Date:** 2026-02-02  
**Scope:** Phase 4.2 (Prompt Engineering, Iterative Refinement, Agent Context Awareness, Testing)

## What shipped

- **4.2.1 Prompt Engineering Improvements:**
  - `packages/apps/console/server/agent/prompts/blueprint-generation.ts` – versioned system prompts (v1) with few-shot examples (incident response, CI/CD, notification), template awareness, iteration mode, and EXPLAIN MODE.
  - `packages/apps/console/server/services/template-catalog.ts` – `getTemplateSummaries()` loads template id/name/description for agent prompt context.
  - Chat router fetches templates and passes `currentDraft` + `templatesSummary` to `OpenAIAgentService.generateBlueprint`.
  - AgentChatPanel receives `currentDraft` prop; useChat `body` includes it for each request.
  - `explainStep` tool added; agent can call it when user asks "Why did you add this step?" instead of proposeWorkflow.

- **4.2.2 Iterative Refinement Flow:**
  - `packages/apps/console/client/src/features/workbench/draft-diff.ts` – `computeDraftDiff()` returns node/edge status (added, removed, changed, unchanged).
  - DraftingCanvas accepts `nodeDiffStatus`; BlueprintFlowNode renders green ring for added, amber for changed.
  - Workbench page computes diff when `pendingDraft` exists and passes it to canvas.

- **4.2.3 Agent Context Awareness:**
  - `packages/apps/console/client/src/features/workbench/node-explanation.ts` – `buildExplainStepMessage()` builds prompt for "Explain step" flow.
  - NodeInfoSheet "Explain step" button; `onRequestExplain` sends message to agent.
  - Chat utils `getExplainStepFromMessage()` extracts explainStep output; agent-chat-panel renders it.

- **4.2.4 Testing:**
  - Unit tests: `blueprint-generation.test.ts` (5 tests), `draft-diff.test.ts` (4 tests), `node-explanation.test.ts` (1 test), `chat-utils-explain.test.ts` (3 tests).
  - E2E: Playwright not configured; scenario documented in workbench-e2e-testing skill for "User iterates on draft 3x via chat."

- **4.2.5 Full Phase 4.2 Retrospective:** This document.

## What went well

- **workbench-prompt-patterns skill:** Clear guidance for system prompt, few-shot examples, template awareness, and iteration mode.
- **workbench-ir.schema.json:** EditIntent definitions were reference material; kept proposeWorkflow as full-draft output (model applies edits mentally) to avoid client-side EditIntent application complexity.
- **Template catalog reuse:** `getTemplateSummaries()` isolated from templates router; simple filesystem reads, no HTTP.
- **Diff visualization:** `computeDraftDiff()` is pure; BlueprintFlowNode styling minimal (ring colors); no layout changes.

## What could be better

- **E2E not added:** Plan called for "E2E test: User iterates on draft 3x via chat." Playwright not set up; add when configured per workbench-e2e-testing skill.
- **Template suggestion flow:** Agent prompt instructs "suggest template when intent matches" but client does not yet handle templateId in response (e.g. "Should I load it?" → load template). Manual confirmation flow deferred.
- **explainStep vs summarizer:** When agent calls explainStep, summarizer still runs. Could skip summarizer for explain-only responses to reduce latency/cost.

## Recommendations

- **Immediate:** When Playwright is configured, add `workbench-iterative-refinement.spec.ts` covering: start with draft → send "Rename step 2 to X" → assert label change; repeat for add/remove.
- **Near-term:** Implement template confirmation flow: agent suggests templateId → client shows "Load Incident Response template?" → on confirm, fetch and apply template.
- **Strategic:** Consider toolChoice: "auto" for planning step so agent can respond with text-only for simple clarification questions without forcing a tool call.

## Plan alignment

- Phase 4.2 items 4.2.1–4.2.4 implemented as specified. 4.2.4 E2E deferred until Playwright is configured.
- No plan file edits; this retro is the checkpoint for Phase 4.2.

## Key takeaway

Enhanced generative iteration (prompts, diff visualization, Explain step, template awareness) is in place. Unit tests cover new modules. Add E2E and template confirmation flow when tooling permits.
