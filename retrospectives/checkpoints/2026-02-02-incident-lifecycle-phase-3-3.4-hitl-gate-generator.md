## Progress
- [x] Todo completed: Phase 3.4 — `@golden/path:hitl-gate` generator is present, registered in `tools/path/generators.json`, and its tests pass (`pnpm nx test path`).

## Learnings
- Generating both the signal/query contract and the notification activity scaffolding reduces copy/paste drift between gates.
- Idempotent generator behavior (run twice → identical output) is a strong guardrail for determinism and repeatability.

## Friction
- Gate naming choices implicitly become workflow contracts (signal/query names, Slack action IDs); generator defaults help, but the naming decision is still “forever”.
- Slack-specific notification behavior can encourage mixing concerns unless the generator keeps workflow contracts separate from handler/runtime code.

## Opportunities
- Add an option to scaffold a “console-only” notification path (no Slack blocks) while keeping the same signal/query contract.
- Add a follow-up generator to wire the new gate into an example blueprint step (without introducing nondeterministic code).

