## Progress
- [x] Todo completed: Phase 3.2 — `slack-block-kit-patterns` skill exists and is usable (skill + reference doc).

## Learnings
- Keeping `action_id` and context encoding stable is as important as API stability; handlers and workflows depend on it.
- The “ack fast, update async” pattern reduces Slack timeout risk and keeps workflows as the source of truth.

## Friction
- Block Kit templates are easy to diverge across features unless there’s a single canonical builder/helper surface.
- Slack UX details (ephemeral vs update) can leak into workflow design if not clearly separated (handler vs workflow concerns).

## Opportunities
- Centralize/expand reusable builders for common patterns (approval request/result/error) so new features don’t hand-roll JSON.
- Add an explicit “safety” checklist to the handler implementation docs (signature verification, <3s ack, idempotency).

