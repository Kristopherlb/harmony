import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from './scaffold-improvement-entries.mjs';

test('parseArgs reads required flags', () => {
  const args = __test.parseArgs([
    '--retro',
    'retrospectives/sessions/example.md',
    '--source',
    'WORKBENCH-2026-02-10',
    '--start-id',
    '60',
  ]);
  assert.equal(args.retroPath, 'retrospectives/sessions/example.md');
  assert.equal(args.source, 'WORKBENCH-2026-02-10');
  assert.equal(args.startId, 60);
});

test('parseRecommendationActions extracts recommendation table actions', () => {
  const md = `
## Recommendations
### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add fast test script | 1h | Faster loops |
| Add async flush helper | 30m | Less flake |
`;
  const actions = __test.parseRecommendationActions(md);
  assert.deepEqual(actions, ['Add fast test script', 'Add async flush helper']);
});

test('scaffoldRows emits deterministic IMP table rows', () => {
  const md = `
## Recommendations
### Immediate (This Sprint)
| Action | Effort | Impact |
|--------|--------|--------|
| Add fast test script | 1h | Faster loops |
| Add async flush helper | 30m | Less flake |
`;
  const out = __test.scaffoldRows({
    markdown: md,
    source: 'WORKBENCH-2026-02-10',
    startId: 60,
  });
  assert.equal(out.count, 2);
  assert.equal(
    out.immediateRows[0],
    '| IMP-060 | Add fast test script | WORKBENCH-2026-02-10 | ⬜ |  |'
  );
  assert.equal(out.impactRows[1], '| IMP-061 | Add async flush helper | _(pending)_ | ⬜ |');
});

test('parseRecommendationActions ignores non-recommendation tables', () => {
  const md = `
## Recommendations
### Immediate (This Sprint)
| Action | Effort | Impact |
|--------|--------|--------|
| Add fast test script | 1h | Faster loops |

## Metrics
| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | 10 | <20 | note |
`;
  const actions = __test.parseRecommendationActions(md);
  assert.deepEqual(actions, ['Add fast test script']);
});
