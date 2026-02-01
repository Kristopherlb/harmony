# Phase 4: Agentic Integration (The Reasoner)

| Metadata | Value |
| --- | --- |
| Status | DRAFT |
| Last updated | 2026-01-28 |
| Goal | Turn the platform from “tool library” → agentic system with planning, HITL, and self-correction. |

## 1. Executive Summary

Phase 4 introduces the **Reasoner** layer: probabilistic agents (LangGraph) that can interpret ambiguous natural language, plan multi-step work, and invoke deterministic platform tools (OCS Capabilities + WCS Blueprints) via MCP.

This phase formalizes the “Builder → Ops” handoff graph (AIP-001), runtime tool discovery (MCP), and context hydration (“Environment Brain”) to reduce hallucination surface area and increase execution success.

## 2. Scope (Agent-Execution Focused)

### 2.1 In Scope (MVP)

- AIP-001 compliant “Builder → Ops” LangGraph with HITL breakpoints.
- A protocol-compliant MCP Registry service exposing Capabilities/Blueprints as callable tools (no hardcoded API clients in agents).
- A Context Binder that hydrates the initial graph state with:
  - Identity attributes (Keycloak claims)
  - Knowledge snippets (RAG over internal docs)
  - Runtime health context (Golden Signals / dependency health)
- Guardrails enforced per reasoning cycle:
  - `max_iterations` / `token_limit`
  - RESTRICTED tool → HITL interrupt
- Observability + audit trail (without leaking sensitive reasoning content).

### 2.2 Out of Scope (Defer)

- Autonomous production deployment without explicit approval gates.
- Cross-tenant multi-org federation (assume single Keycloak realm / org boundary).
- “Self-healing” remediation agents operating on infra without human approval.

## 3. Glossary

- **OCS Capability (Contract/Executable):** Deterministic action with Zod schemas and security metadata.
- **WCS Blueprint (Orchestrator):** Deterministic Temporal workflow orchestrating capabilities.
- **Reasoner (Agent):** Probabilistic LangGraph graph that plans, asks questions, and delegates to tools.
- **MCP Registry:** Server that exposes Capabilities/Blueprints as tools to agents.
- **AIP-001:** Multi-agent shared state + handoff protocol.
- **ASS-001:** Agent requirements (guardrails, tool binding, observability).

See `ecosystem-patterns-nd-primitives.mdx` for the “Runtime Tetrad” framing.

## 4. Architecture Overview

### 4.1 Runtime Tetrad (Why This Works)

- **Reasoner (LangGraph):** resolves ambiguity, selects tools, asks clarifying questions, coordinates handoffs.
- **Contract (OCS):** enforces schemas + metadata; defines allowed actions and classifications.
- **Executable (Dagger container / runtime module):** runs the real side-effecting code.
- **Orchestrator (Temporal / WCS):** ensures deterministic, durable execution and compensation (Saga).

### 4.2 Dependency Direction (Clean Architecture / Hexagonal)

To maximize agent reliability and testability:

- Core agent orchestration depends on **ports** (interfaces), not concrete transports.
- MCP (SSE/stdio), Postgres, Keycloak, Vector DB are **adapters**.
- Keep “graph logic” swappable (LLM/provider, prompting strategy) without changing core contracts.

## 5. Contracts (Agent-Friendly, Deterministic Interfaces)

### 5.1 Shared State Schema (AIP-001 / GoldenPathState)

All nodes MUST share the same base state shape (see:
`standards/agent/agent-interaction-protocol.mdx` and `packages/core/src/ass/golden-path-state.ts`).

**Execution note:** Use this state as “short-term memory”. Do not store large blobs; store references and compact summaries.

### 5.2 Tool Discovery + Invocation (MCP + AIP)

Agents MUST interact with the world only via MCP-exposed tools (ASS-001).

**Normative contract:**

- Tool identifiers are `ToolId` strings (see `packages/core/src/types.ts`).
- Discovery returns a list of tool IDs and their JSON Schemas.
- Invocation MUST return a structured response containing `trace_id` for correlation (see `packages/core/src/ass/discover-tools.ts`).

**Important reliability requirement:**
Agents should never “guess” a tool’s arguments. If schema-required fields are missing, the agent MUST create a `pending_action` of type `CLARIFICATION` and interrupt (AIP-001 HITL protocol).

### 5.3 Guardrails + HITL Breakpoints (ASS-001)

Every reasoning cycle MUST enforce:

- **Recursion/loop safety:** `max_iterations` (default 25).
- **Cost safety:** optional `token_limit`.
- **Restricted safety:** any tool call with `data_classification === 'RESTRICTED'` MUST interrupt for human approval before execution.

Reference implementations:
`packages/core/src/ass/guardrails.ts` and `packages/agents/src/base-agent.ts`.

### 5.4 Context Binder (Identity + Knowledge + Runtime Health)

The Context Binder is a deterministic service that hydrates the initial state for the Reasoner.

**Inputs:**

- User request text
- Keycloak JWT (or token reference)
- Environment (dev/stg/prd)

**Outputs (minimum):**

- `GoldenContext` (see `packages/core/src/context/golden-context.ts`)
- Enriched state fields:
  - `trace_id` (OTel correlation)
  - `pending_actions` when required claims/secrets are missing

**Token-efficiency rule:** RAG output MUST be summarized and bounded (e.g., top-N snippets + short summaries), otherwise agents will fail via token pressure rather than logic.

## 6. Components (What We Actually Build)

### 6.1 MCP Registry Service

Purpose: Expose the monorepo’s Capabilities/Blueprints as MCP tools.

#### 6.1.1 Do We Actually Need MCP for MVP?

Not always. MCP becomes “required” when you need **tool discovery/invocation across process boundaries** (agent runner ↔ registry ↔ workers), or when you want multiple agent implementations (LangGraph, other runtimes) to consume the same tool surface.

For MVP, you can keep the **tool contract** (ASS-001/AIP-001) without the full MCP transport by using an in-process `ToolRegistry` adapter (see `packages/core/src/ass/discover-tools.ts`):

- **Option A (MVP, recommended): Manifest + in-process ToolRegistry**
  - CI (TCS-001) generates a deterministic “tools manifest”.
  - Reasoners load the manifest and bind implementations locally (no SSE/stdio, no JSON-RPC).
  - Benefits: fewer moving parts, less nondeterminism, easier testability, faster iteration.
  - Still compliant with the intent of ASS-001 (“no hardcoded API clients”) because the agent only sees tools via a registry abstraction, not bespoke integrations.

- **Option B (Phase 4+): Full MCP Registry server**
  - Implement MCP transport (stdio for local, SSE for remote) and JSON-RPC semantics.
  - Benefits: language/runtime neutrality, remote agents, better multi-service boundaries.
  - Cost: authN/Z, transport edge cases, versioning and schema compatibility guarantees.

**Decision trigger:** If your Phase 4 success criteria requires “any LLM can connect and call tools remotely,” do Option B. If Phase 4 success criteria is “agents can discover and invoke tools reliably,” Option A is sufficient and de-risks the whole program.

**Migration path (A → B):** keep the manifest as the server’s source of truth. `tools/list` becomes a thin wrapper over the manifest; `tools/call` becomes a transport adapter over the same `ToolRegistry` interface.

#### 6.1.2 If We Build MCP: Minimal “Worth It” Subset

If you choose Option B, keep the first cut intentionally small and strongly validated:

- **Methods:** implement `tools/list` + `tools/call` (or the equivalent MCP primitives you standardize on).
- **Schema enforcement:** validate `tools/call` args against the exported JSON Schema before invoking.
- **Correlation:** every tool result MUST include `trace_id` (AIP-001) and emit OTel spans/logs with required `golden.*` fields (GOS-001).
- **Versioning:** include a server + manifest version so agents can detect incompatible schema changes.
- **Transport:** start with **stdio** (local dev/CI), add **SSE** only after authN/Z is defined (Keycloak service accounts per UIM-001).

**Discovery sources (prefer deterministic):**

- Nx project graph / workspace metadata (preferred), falling back to filesystem scan of `packages/capabilities` and `packages/blueprints` if needed.

**Tool mapping:**

- `metadata.id` → MCP tool name/id
- Zod `inputSchema` → JSON Schema tool parameters (conversion must be stable and testable)

**Zod → JSON Schema conversion guidance (agent reliability):**

- Target a specific JSON Schema dialect (recommend 2020-12) and treat it as a compatibility contract.
- Define and enforce a “tool-parameters-safe” Zod subset:
  - OK: `z.object`, primitives, `z.array`, `z.enum`, `z.literal`, simple `z.union`, `z.record` (with caution).
  - Avoid/ban for tool parameter export: `z.preprocess`, `z.transform`, `z.refine`/effects, non-serializable validators, and anything that can’t be represented in JSON Schema deterministically.
- Require field-level descriptions + examples in schemas (improves tool argument accuracy and reduces clarification loops).
- Add TCS-001 tests that round-trip: Zod → JSON Schema → sample validation for `aiHints.exampleInput`.

**Refresh strategy (pick one for MVP):**

- CI generates a tool manifest during TCS-001 certification; the server serves the manifest.
  - (Avoid filesystem watchers in MVP; they create nondeterministic drift in long-running agents.)

**Manifest schema (minimum):**

```json
{
  "generated_at": "2026-01-28T00:00:00.000Z",
  "version": "1",
  "tools": [
    {
      "id": "capabilities.jira.create_issue",
      "type": "CAPABILITY",
      "description": "Create a Jira issue in a project.",
      "data_classification": "INTERNAL",
      "json_schema": { "type": "object", "properties": {}, "required": [] }
    }
  ]
}
```

Keep `json_schema` stable across releases; treat breaking schema changes like API breaks (TCS-001 gate).

**Transport:**

- Support stdio for local agent/dev usage; add SSE for remote deployment when auth is ready.

### 6.2 AIP-001 Builder → Ops Handoff Graph

Graph nodes (minimum):

- **Intent Classifier:** determines whether a Capability, Blueprint, or both are needed.
- **Builder (Architect):** produces a DRAFT artifact and required developer actions (secrets/OAuth/inputs).
  - Uses `architect-workflow-logic.mdx` as the normative output format for blueprint architecture JSON.
- **Ops (Auditor):** evaluates draft artifacts for security/compliance and either:
  - marks them `AUDITED`/`CERTIFIED`, or
  - creates `pending_actions` + interrupts for HITL.
- **Assembly Trigger:** on `CERTIFIED`, invokes Phase 3 Assembly Engine.

Persistence:

- MUST use a deterministic checkpointer to survive long-running cycles + HITL pauses (ASS-001).
- Key state identity should be `trace_id` + `active_task_id`.

### 6.3 Stage Definitions (Operational “What Happens When”)

This section makes the Phase 4 flow executable by removing ambiguity. Each stage has:

- **Inputs:** what must already exist (state/context/tools)
- **Outputs:** what must be written back (state/artifacts/pending actions)
- **Stop conditions:** when the stage MUST interrupt for HITL (AIP-001) or abort for guardrails (ASS-001)
- **Verification:** how we know it’s correct (TCS-001 + evals)

#### Stage 0 — Request Intake (Bootstrap)

- **Inputs:** raw user request + environment (`dev|stg|prd`)
- **Outputs:**
  - `GoldenPathState.intent` set
  - `GoldenPathState.trace_id` created (OTel parent; see GOS-001 + `packages/core/src/context/golden-context.ts`)
  - `GoldenPathState.active_task_id` created
- **Stop conditions:** none (bootstrap is deterministic)
- **Verification:** schema validation of initial state (ASS-001 state schema; see `packages/core/src/ass/golden-path-state.ts`)

#### Stage 1 — Context Bind (Identity + Runtime Context + Knowledge Budget)

- **Inputs:** Keycloak JWT/claims (UIM-001) + RAG sources + runtime health data (GOS-001)
- **Outputs:**
  - Context object stored in state or attached to node execution context
  - `pending_actions` created when required claims/inputs are missing (AIP-001 HITL protocol)

**Design note (token + schema safety):** `GoldenPathState` is intentionally small and strictly typed; prefer attaching `GoldenContext` and raw RAG snippets to node-local execution context and only persisting compact summaries + references in `reasoning_history`/artifacts.
- **Stop conditions:**
  - Missing required identity claims (`division`, `clearance_level`, `cost_center`) → `pending_actions += { type: 'CLARIFICATION' }` and interrupt
  - RAG budget exceeded → truncate + summarize (do not proceed with unbounded context)
- **Verification:**
  - Unit tests for claim extraction and bounded RAG summarization
  - Observability: logs/metrics include required `golden.*` attributes (GOS-001)

#### Stage 2 — Tool Surface Load (Registry Binding)

- **Inputs:** tool manifest (or MCP tools/list) + authorization policy for tool IDs (ASS-001 authorizedTools)
- **Outputs:**
  - `ToolRegistry` populated and filtered to `authorizedTools` (see `packages/agents/src/base-agent.ts`)
- **Stop conditions:**
  - Missing required tool(s) for the user’s intent → `pending_actions += { type: 'CLARIFICATION', message: 'Missing dependency…' }` and interrupt
- **Verification:**
  - TCS-001 contract tests: tool IDs unique + schemas parseable
  - Determinism tests: manifest generation is stable for same inputs

#### Stage 3 — Intent Classification (What Artifact Do We Need?)

- **Inputs:** `intent` + available tools
- **Outputs:** decision record + `active_task_id` set to the next stage’s task
- **Stop conditions:** ambiguous intent → `pending_actions += { type: 'CLARIFICATION' }` and interrupt (see `architect-workflow-logic.mdx` “Proactive Clarification”)
- **Verification:** eval score on intent routing (ASS-001 operational baseline)

#### Stage 4 — Builder (Architect) Produces DRAFT

- **Inputs:** intent + tool list + security policy context + bounded RAG summary
- **Outputs:**
  - `artifacts[<id>] = { type: 'BLUEPRINT'|'CAPABILITY', status: 'DRAFT', content: ... }`
  - `pending_actions` for required secrets/OAuth approvals/inputs (AIP-001 types: `SECRET|OAUTH|CLARIFICATION`)
- **Stop conditions:**
  - Missing required secrets or OAuth approvals → interrupt (HITL)
  - Guardrails: `max_iterations` / `token_limit` reached (ASS-001; see `packages/core/src/ass/guardrails.ts`)
- **Verification:**
  - Output adheres to the JSON structure in `architect-workflow-logic.mdx`
  - Zod validation of produced artifacts where schemas exist

#### Stage 5 — Ops Audit (Security/Compliance Gate)

- **Inputs:** DRAFT artifact + standards context (WCS-001/UIM-001/GOS-001/TCS-001)
- **Outputs:**
  - Artifact status set to `AUDITED` or `CERTIFIED`
  - `pending_actions += { type: 'APPROVAL' }` when human review is mandatory

**Standards mismatch to resolve:** AIP-001 text describes `REJECTED` as a possible audit outcome, but the current state schema only supports `DRAFT|AUDITED|CERTIFIED` (`packages/core/src/ass/golden-path-state.ts`). Until reconciled, represent “rejection” as:

- keep the artifact `status: 'DRAFT'`
- add an `EVAL` artifact containing machine-checkable audit failures + required remediation steps
- add `pending_actions` for the specific remediation/HITL items
- **Stop conditions:**
  - Any planned tool call or artifact marked `RESTRICTED` → interrupt before execution (ASS-001 HITL requirement)
  - Policy violations → interrupt with explicit remediation checklist
- **Verification:**
  - Audit output is structured (machine-checkable) and stored as an `EVAL` artifact
  - If `CERTIFIED`, ensure required tests/evals gates are satisfied (TCS-001)

#### Stage 6 — HITL Resolution (Breakpoint Resume)

- **Inputs:** human-provided answers/approvals + updated secrets/OAuth readiness
- **Outputs:** `pending_actions[].resolved = true` for addressed items; state updated with provided values
- **Stop conditions:** unresolved required actions remain → stay paused
- **Verification:** state remains schema-valid; decisions logged without leaking sensitive reasoning text (ASS-001 + GOS-001)

#### Stage 7 — Assembly Trigger (Phase 3 Hand-off)

- **Inputs:** `CERTIFIED` artifact + Assembly Engine entrypoint (Phase 3)
- **Outputs:** scaffolding/codegen invocation + generated code artifacts
- **Stop conditions:** assembly prerequisites missing → `pending_actions += { type: 'CLARIFICATION' }` and interrupt
- **Verification:** Phase 3’s deterministic build artifacts + TCS-001 pipeline passes

### 6.4 Reasoning Audit Trail (Without Leaking “Chain-of-Thought”)

Store and emit:

- tool calls + arguments (redacted via SecretSchema)
- tool results (bounded and redacted)
- decisions as short “decision records” (not raw model reasoning)
- `pending_actions` lifecycle (created → resolved)

Observability requirements MUST match `standards/observability/golden-observability.mdx` (GOS-001).

### 6.5 External Guidance (Only Where It Adds Execution Reliability)

Use these as implementation references when you cross process boundaries or need stable interoperability:

- **JSON-RPC 2.0:** request/response envelope semantics (relevant if your MCP transport uses JSON-RPC). https://www.jsonrpc.org/specification
- **JSON Schema (2020-12):** schema versioning expectations for tool parameter definitions (critical for Zod → JSON Schema mapping stability). https://json-schema.org/
- **W3C Trace Context:** trace propagation format; makes `trace_id` portable across services. https://www.w3.org/TR/trace-context/
- **OpenTelemetry:** tracing/logging/metrics APIs and correlation patterns (aligns with GOS-001). https://opentelemetry.io/docs/
- **OAuth 2.0 + OpenID Connect:** service accounts + short-lived tokens + claims mapping (aligns to UIM-001). https://www.rfc-editor.org/rfc/rfc6749 and https://openid.net/specs/openid-connect-core-1_0.html
- **SSE (Server-Sent Events):** reconnect/backoff, heartbeat, and timeout expectations if you ship SSE transport. https://html.spec.whatwg.org/multipage/server-sent-events.html

## 7. Implementation Roadmap (Concrete Deliverables)

### Task 4.1 — MCP Server

- Create `@golden/mcp-server` (location MUST match GSS-001; reconcile `tools/` vs `packages/tools/`).
- Implement:
  - `tools/list` over discovered artifacts
  - tool invocation routing → capability/blueprint runners
- Add TCS-001 tests verifying stable tool schemas and unique IDs.

### Task 4.2 — State Schema

- Adopt `GoldenPathState` as the shared LangGraph state (AIP-001).
- Ensure Zod validation is enforced at graph boundaries (ASS-001 stateSchema rule).

### Task 4.3 — Graph Nodes (Builder/Ops)

- Implement Builder and Ops as versioned “skills” with prompts treated as code (ASS-001 prompt governance).
- Add eval harness + score gate per ASS-001 operational baselines.

### Task 4.4 — Context Binder

- Implement a deterministic binder that maps Keycloak claims → `GoldenContext` fields:
  - `division`, `clearance_level`, `cost_center` (UIM-001)
- Implement RAG query + summarization with bounded output size.

### MVP Decisions (Resolve Early to Prevent Agent Thrash)

- **MCP vs ToolRegistry-first:** choose Option A (manifest + in-process registry) vs Option B (full MCP) and define the migration path.
- **Registry source of truth:** Nx project graph vs filesystem scan (prefer Nx for determinism).
- **Registry refresh:** CI-produced manifest vs filesystem watcher (prefer CI manifest for MVP).
- **Zod → JSON Schema:** pick and lock a converter + define unsupported Zod features (and test them).
- **MCP transport:** stdio-only for MVP vs stdio+SSE; if SSE, define authN/Z (Keycloak service accounts).
- **Checkpointer:** Postgres schema + retention policy for long-running/HITL graphs (ASS-001).
- **RAG budget:** max snippets + max tokens + redaction strategy (to avoid token-pressure failures).
- **Audit trail policy:** store decision records/events, not raw model reasoning; define retention and access controls.
- **Audit outcomes:** reconcile AIP’s mention of `REJECTED` with the current `GoldenPathState` status enum.

## 8. Success Criteria (Executable)

- **Metric 1:** An agent lists all “Connector” capabilities via a registry surface (MCP `tools/list` or the CI-generated manifest loaded into `ToolRegistry`).
- **Metric 2:** The graph hits a breakpoint when Ops detects a RESTRICTED egress/tool usage without whitelisting.
- **Metric 3:** Builder includes the user `cost_center` in produced Blueprint metadata without manual input.

## 9. References (Platform Standards + Code)

- ASS-001: `standards/agent/agent-specification-standard.md`
- AIP-001: `standards/agent/agent-interaction-protocol.mdx`
- WCS-001: `standards/workflow/workflow-composition-standard.mdx`
- UIM-001: `unified-identity-model.mdx`
- GOS-001: `standards/observability/golden-observability.mdx`
- TCS-001: `testing-and-certification-standard.mdx`
- GSS-001: `generator-and-scaffolding-standard.mdx`
- Runtime tetrad / primitives: `ecosystem-patterns-nd-primitives.mdx`
- Agent base wiring: `packages/agents/src/base-agent.ts`
- Shared state (Zod + Annotation): `packages/core/src/ass/golden-path-state.ts`
- AgentSpec contract: `packages/core/src/ass/agent-spec.ts`
- Tool discovery contract: `packages/core/src/ass/discover-tools.ts`
- Guardrails: `packages/core/src/ass/guardrails.ts`
- Golden context: `packages/core/src/context/golden-context.ts`
- Blueprint architecture output format: `architect-workflow-logic.mdx`
