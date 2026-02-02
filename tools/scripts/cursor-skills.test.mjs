/**
 * tools/scripts/cursor-skills.test.mjs
 *
 * Purpose: deterministic unit tests for cursor-skills bootstrap logic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { __test } from './cursor-skills.mjs';

test('parseYamlFrontmatter returns null when missing', () => {
  assert.equal(__test.parseYamlFrontmatter('# hi\n'), null);
});

test('parseYamlFrontmatter parses name/description', () => {
  const md = `---
name: abc
description: hello
---

# Body
`;
  assert.deepEqual(__test.parseYamlFrontmatter(md), { name: 'abc', description: 'hello' });
});

test('verifyVendored enforces frontmatter correctness', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cursor-skills-'));

  // Create required skill folders, but make one malformed to ensure we see an error.
  for (const skill of ['test-driven-development', 'typescript-expert', 'clean-architecture', 'ui-ux-pro-max', 'shadcn-ui']) {
    const skillDir = path.join(dir, skill);
    await fs.mkdir(skillDir, { recursive: true });
    const body =
      skill === 'ui-ux-pro-max'
        ? `---
name: WRONG
description: ok
---
`
        : `---
name: ${skill}
description: ok
---
`;
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), body, 'utf8');
  }

  const errors = await __test.verifyVendored(dir);
  assert.ok(errors.some((e) => e.includes('does not match folder "ui-ux-pro-max"')));
});

