## Progress
- [x] Todo completed: Phase 3.7 — `slack-interactive` capability exists, is registered/exported, and tests pass (`pnpm nx test capabilities`).

## Learnings
- Keeping Slack interactive concerns in a dedicated capability makes workflows and activities easier to keep deterministic (workflows only signal/query; side-effects live in capabilities/activities).
- Explicit outbound allowlists (`slack.com`, `api.slack.com`) and secret mounting patterns are a good compliance baseline.

## Friction
- Slack APIs span multiple “interaction” styles (chat.postMessage, chat.update, views.open, response_url); it’s easy for handlers to diverge without a single contract surface.
- Local testing is mostly contract-level unless we introduce a mock Slack API or recorded fixtures.

## Opportunities
- Add a lightweight “Slack client shim” layer (or reusable helper functions) so capability operations share consistent error handling and response parsing.
- Add a small suite of unit tests around payload shaping for each operation (beyond schema validation) to catch regressions earlier.

