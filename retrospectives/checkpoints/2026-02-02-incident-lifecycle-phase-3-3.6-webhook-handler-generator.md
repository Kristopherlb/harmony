## Progress
- [x] Todo completed: Phase 3.6 — `@golden/path:webhook-handler` generator is present, registered in `tools/path/generators.json`, and its tests pass (`pnpm nx test path`).

## Learnings
- Shipping a “verified-by-default” handler skeleton makes it much harder to accidentally expose unauthenticated webhooks.
- Normalizing common sources (GitHub/GitLab/Slack/etc.) into a consistent middleware shape makes router wiring simpler and more reviewable.

## Friction
- Correct verification often depends on having the raw body available; that requirement needs to be called out early to avoid subtle signature bugs.
- Slack has a distinct verification scheme (timestamp + signing secret); generic HMAC helpers can mislead if used blindly.

## Opportunities
- Add a generator option to scaffold the Express raw-body middleware wiring required for signature verification.
- Add a “source-specific best practice” note in the generated file header for Slack/GitHub/GitLab to steer implementers to correct schemes.

