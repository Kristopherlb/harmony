---
name: langgraph-reasoner-patterns
description: Patterns for implementing OCS Reasoner capabilities using LangGraph.js (state, nodes, tools, testing, determinism boundaries).
---

# LangGraph Reasoner Patterns (LRP-001)

Use this skill when implementing an OCS **Reasoner** capability (ASS-001) backed by **LangGraph.js**. The intent is predictable, testable reasoning that composes with Harmony’s Capability Registry + MCP tool discovery, while keeping determinism concerns isolated to the right layer.

## What this skill optimizes for

- **Deterministic orchestration**: nodes are small, mostly pure, and unit-testable.
- **Governable prompting**: prompts are versioned as code and structured per PES-001.
- **Tool hygiene**: no hard-coded API clients; bind tools via MCP/registry (ASS-001).
- **Fast feedback**: fixtures + TDD-friendly seams.

## Non-goals

- Temporal workflow bundle determinism linting rules (see `determinism-guardrails`).
- Full OCS authoring and security posture (see `open-capability-standard` and `pattern-catalog-capabilities`).

---

## Canonical layout (recommended)

Keep Reasoners shallow and discoverable:

- `packages/capabilities/src/reasoners/<reasoner>.capability.ts`
- `packages/capabilities/src/reasoners/<reasoner>.capability.test.ts`
- `packages/capabilities/src/reasoners/<reasoner>/`
  - `schemas.ts` (zod input/output)
  - `types.ts` (internal types; derive from zod where possible)
  - `graph.ts` (LangGraph wiring only)
  - `nodes/` (each node in its own file)
  - `prompts/` (prompt assets, versioned)
  - `__fixtures__/` (deterministic test inputs)

---

## State schema pattern (ASS-001 compatible)

### Rules

- **Use Zod** for state shape and all externally-visible I/O.
- Keep state **JSON-serializable**.
- Prefer explicit control fields: `phase`, `errors`, `warnings`.
- Arrays should be **append-only** by reducer semantics (accumulate outputs deterministically).
- Singletons should be **overwrite** semantics (e.g., current phase).

### Example (state schema)

```ts
import { z } from 'zod';

export const ReasonerPhase = z.enum([
  'parse',
  'inventory',
  'evaluate',
  'analyze',
  'finalize',
]);

export const ReasonerStateSchema = z.object({
  // Normalized inputs
  planContent: z.string(),
  projectContext: z.record(z.any()),
  options: z.record(z.any()).default({}),

  // Intermediate inventory
  skills: z.array(z.object({ name: z.string(), path: z.string() })).default([]),

  // Outputs (accumulate)
  personaEvaluations: z.array(z.any()).default([]),
  gaps: z.array(z.any()).default([]),
  preWork: z.array(z.any()).default([]),
  successMetrics: z.array(z.any()).default([]),

  // Control / diagnostics
  phase: ReasonerPhase.default('parse'),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type ReasonerState = z.infer<typeof ReasonerStateSchema>;
```

### Don’t put these in state

- Live network clients (OpenAI SDK, Slack SDK, etc.)
- File handles / streams
- Non-serializable classes

Inject those via node dependencies (or tool binding layers) instead.

---

## Node design pattern (small, mostly pure)

### Rules

- Each node is \(State \rightarrow Partial<State>\) and returns a **patch**.
- Validate inputs at the boundary; collect deterministic errors into `errors[]`.
- Avoid hidden side effects. If I/O is necessary, isolate it behind a tiny adapter.
- Keep nodes single-purpose; prefer additional nodes over “do everything” nodes.

### Example node signature

```ts
export type ReasonerNode<S> = (state: S) => Promise<Partial<S>> | Partial<S>;
```

### Example node implementation

```ts
import type { ReasonerNode } from './types';
import type { ReasonerState } from './schemas';

export const setPhase =
  (phase: ReasonerState['phase']): ReasonerNode<ReasonerState> =>
  async () => ({ phase });
```

### Error handling guidance

- Prefer **structured, deterministic strings** in `errors[]` and keep going to a finalizer that emits a valid output payload.
- Throw only for invariant violations (e.g., schema mismatch) where the caller wraps into a known error output.

---

## Graph assembly pattern (wiring only)

### Rules

- Keep `graph.ts` as wiring: nodes + edges. No business logic.
- Start linear: `parse → inventory → evaluate → analyze → finalize`.
- Add branches only with tests and clear state transitions.

### Example (wiring skeleton)

```ts
import { END, START, StateGraph } from '@langchain/langgraph';
import { ReasonerStateSchema } from './schemas';

import { parsePlan } from './nodes/parse-plan';
import { inventorySkills } from './nodes/inventory-skills';
import { evaluatePersonas } from './nodes/evaluate-personas';
import { analyzeGaps } from './nodes/analyze-gaps';
import { finalizeOutput } from './nodes/finalize-output';

export function buildGraph() {
  return new StateGraph(ReasonerStateSchema)
    .addNode('parse', parsePlan)
    .addNode('inventory', inventorySkills)
    .addNode('evaluate', evaluatePersonas)
    .addNode('analyze', analyzeGaps)
    .addNode('finalize', finalizeOutput)
    .addEdge(START, 'parse')
    .addEdge('parse', 'inventory')
    .addEdge('inventory', 'evaluate')
    .addEdge('evaluate', 'analyze')
    .addEdge('analyze', 'finalize')
    .addEdge('finalize', END)
    .compile();
}
```

---

## Tool binding (ASS-001)

### Rules

- Do **not** hardcode API clients inside nodes.
- Prefer binding tools via:
  - MCP tool discovery, or
  - Harmony capability registry (factory exports) and a thin adapter layer.
- Nodes should accept a narrow “tool surface” interface, not a kitchen-sink SDK.

### Example (tool surface injection)

```ts
export interface ReasonerTools {
  listSkills(): Promise<Array<{ name: string; path: string }>>;
}

export const inventorySkills =
  (tools: ReasonerTools) =>
  async () => ({
    phase: 'inventory' as const,
    skills: await tools.listSkills(),
  });
```

This design is:
- Easy to unit test (inject a fake implementation)
- Easy to wire to MCP/capabilities later without changing node logic

---

## Prompt engineering for Reasoner nodes (PES-001)

If a node uses an LLM, treat the prompt as code:
- Store it in `prompts/*.md`
- Version with the capability
- Add regression tests where feasible (golden outputs or schema validation)

### System prompt block template (PES-001)

Use this structure inside prompt files when you want governance-friendly parsing:

```xml
<system_role>
You are a Harmony Reasoner node. Produce output strictly matching the provided JSON schema.
</system_role>

<engineering_principles>
- Deterministic structure: stable keys, stable ordering where possible
- No tool calls: reasoning only (tools are invoked outside the model)
- If uncertain: emit explicit unknowns rather than hallucinating
</engineering_principles>

<instructions>
1) Read the plan/context.
2) Perform the requested analysis.
3) Output JSON only (no markdown) matching the schema exactly.
</instructions>

<reference_example>
INPUT: ...
OUTPUT: { "..." : "..." }
</reference_example>

<hitl_protocol>
If required info is missing, return a gap with priority P1 and propose pre-work; do not invent.
</hitl_protocol>
```

---

## Testing patterns (TDD-first)

### What to test first

- **Schema tests**: input variants validate; defaults apply.
- **Node unit tests**: node returns expected patch for a given state (no I/O).
- **Graph smoke test**: graph runs end-to-end with fully mocked tool surface + fixed fixtures.

### Fixture rules

- Fixtures must be deterministic and small.
- Prefer three fixtures for plan input variants: `file`, `content`, `intent`.
- Keep fixtures in `__fixtures__/` and avoid reading the real repo in unit tests.

---

## Determinism boundaries (practical guidance)

- LangGraph Reasoners can be probabilistic (LLM), but your *orchestration* should stay deterministic.
- Never import non-deterministic helpers into Temporal workflow bundles.
- Keep Reasoner code in the **capabilities layer**, and invoke it from workflows via stable interfaces (when needed).

