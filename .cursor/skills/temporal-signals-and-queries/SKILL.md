---
name: temporal-signals-and-queries
description: Temporal signal/query patterns for HITL and external triggers (typed payloads, deterministic waiting, and tests).
---

# Temporal Signals & Queries (TSQ-001)

Use this skill when implementing **approval gates**, **external triggers**, **workflow state inspection**, or any pattern that needs **event-driven** progress in a Temporal workflow (instead of polling).

## When to Use

- Blueprints that wait for **HITL approval** (console/slack/api) before continuing
- Workflows that must accept external updates (e.g., “cancel”, “retry”, “set-config”)
- Integrations needing **queries** for real-time UI state (e.g., approval status)
- Replacing polling loops with **signals + `condition()`**

## Instructions (do this in order)

1. **Define typed signal and query**
   - Use `defineSignal<[Payload]>(name)` and `defineQuery<State>(name)`.
   - Keep payloads JSON-serializable (plain objects, arrays, strings, numbers, booleans).
   - Example reference: `packages/core/src/wcs/approval-signal.ts`.

2. **Model workflow state**
   - Maintain a single state object (e.g., `status`, `requestedAt`, `decision`) that can be returned by the query.
   - Prefer discriminated unions for state transitions (pending → approved/rejected/timeout/cancelled).

3. **Register handlers early**
   - In workflow logic, call `setHandler(signal, handlerFn)` before waiting.
   - Handler functions MUST be deterministic and MUST only mutate workflow-local state.

4. **Wait deterministically**
   - Use `condition(() => predicateOnState, timeout)` to wait for state transitions.
   - Avoid busy waits/poll loops. Do not use `Date.now()` or `setTimeout` in workflow code.

5. **Expose a query for UI and automation**
   - Use `setHandler(query, () => state)` so Console/Slack handlers can inspect state.
   - Query results MUST be derived from workflow-local state only (no network).

6. **Test with Temporal test utilities**
   - Write tests that drive a workflow forward by sending signals and inspecting queries.
   - For unit-level signal/query contract tests (no Temporal env), assert payload shapes and helper outputs (see `approval-signal.test.ts`).

## Determinism Rules (non-negotiable)

- Handlers MUST NOT call network, filesystem, randomness, or real time.
- Use BaseBlueprint wrappers for time/uuid/sleep (see WCS-001 + DGS-001).
- Signal/query names are part of the workflow contract: keep them stable once shipped.

## References

- `references/temporal-signals-and-queries.md`
- `packages/core/src/wcs/approval-signal.ts`
- `packages/core/src/wcs/approval-signal.test.ts`

