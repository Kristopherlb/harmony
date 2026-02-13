# SPEC: Tool Catalog Intelligence V2

Status: Approved  
Scope: Workbench + Console server + MCP tool catalog surface

Skills used:

- `.cursor/skills/feature-golden-path/SKILL.md`
- `test-driven-development`
- `clean-architecture`

---

## 1. Objective

Improve agent grounding by exposing safe, deterministic, machine-usable tool metadata in the tool catalog, with explicit constraints that reduce unsafe or non-actionable tool selection.

---

## 2. Normative Requirements

### 2.1 Metadata Contract

- The catalog MUST support optional `ai_hints` metadata per tool.
- `ai_hints` MUST be additive and backward compatible.
- `ai_hints` MUST be deterministic in generated artifacts.

### 2.2 `ai_hints` Structure (v2)

`ai_hints` fields:

- `example_input` (optional, JSON)
- `example_output` (optional, JSON)
- `usage_notes` (optional, string)
- `constraints` (optional, array of strings)
- `negative_examples` (optional, array of strings)

### 2.3 Safety and Constraint Encoding

- If a tool has known unsafe contexts, they SHOULD be represented in `constraints`.
- If a misuse pattern is common, it SHOULD be represented in `negative_examples`.
- Agent prompt construction MUST include concise constraints/negative examples when present.

### 2.4 Determinism and Sync

- Any schema or metadata change MUST regenerate `tool-catalog.json`.
- Regeneration MUST follow repo deterministic sync order and existing catalog tests.

---

## 3. Implementation Touchpoints

- `packages/tools/mcp-server/src/manifest/capabilities.ts`
- `packages/tools/mcp-server/src/manifest/tool-catalog.json`
- `packages/apps/console/server/agent/services/harmony-mcp-tool-service.ts`
- `packages/apps/console/client/src/features/workbench/use-mcp-tools.ts`
- `packages/apps/console/server/services/openai-agent-service.ts`

---

## 4. Validation

Contract checks:

- Tool catalog generation test passes with additive `ai_hints`.
- Snapshot service exposes `aiHints` round-trip.
- Prompt summarization includes constraints when available.

Local smoke checks:

- `GET /api/mcp/tools` returns new metadata when present.
- Discovery/generation responses improve grounding (no regression in unknown-tool rate).

---

## 5. Test Vectors

1. Tool with `constraints` only:
   - Expected: constraints visible in catalog response and prompt summary.
2. Tool with `negative_examples` only:
   - Expected: negative examples visible in catalog response and prompt summary.
3. Tool with no `ai_hints`:
   - Expected: behavior unchanged, no validation failure.

