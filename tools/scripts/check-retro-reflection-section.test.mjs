import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from './check-retro-reflection-section.mjs';

test('hasReflectionSection detects required heading', () => {
  assert.equal(__test.hasReflectionSection('## Reflection-to-Action\n\ntext'), true);
  assert.equal(__test.hasReflectionSection('## Plan Alignment\n\ntext'), false);
});

test('parseChangedFilesOutput returns trimmed file list', () => {
  const files = __test.parseChangedFilesOutput('\nretrospectives/sessions/a.md\n\nretrospectives/sessions/b.md\n');
  assert.deepEqual(files, ['retrospectives/sessions/a.md', 'retrospectives/sessions/b.md']);
});

test('resolveDiffRange prefers explicit env override', () => {
  const original = process.env.RETRO_DIFF_RANGE;
  process.env.RETRO_DIFF_RANGE = 'origin/main...HEAD';
  try {
    assert.equal(__test.resolveDiffRange(), 'origin/main...HEAD');
  } finally {
    if (original === undefined) delete process.env.RETRO_DIFF_RANGE;
    else process.env.RETRO_DIFF_RANGE = original;
  }
});
