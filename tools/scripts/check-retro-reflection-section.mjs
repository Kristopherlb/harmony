/**
 * tools/scripts/check-retro-reflection-section.mjs
 *
 * CI docs check: ensure changed retrospective session files include
 * "## Reflection-to-Action" section.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function parseChangedFilesOutput(stdout) {
  return String(stdout)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasReflectionSection(markdown) {
  return /^##\s+Reflection-to-Action\b/m.test(String(markdown));
}

function resolveDiffRange() {
  if (process.env.RETRO_DIFF_RANGE && process.env.RETRO_DIFF_RANGE.trim().length > 0) {
    return process.env.RETRO_DIFF_RANGE.trim();
  }

  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}...HEAD`;
  }

  const before = process.env.GITHUB_EVENT_BEFORE;
  if (before && !/^0+$/.test(before)) {
    return `${before}...HEAD`;
  }

  return 'HEAD~1...HEAD';
}

function listChangedRetroFiles(diffRange) {
  const cmd = `git diff --name-only ${diffRange} -- "retrospectives/sessions/*.md"`;
  const out = execSync(cmd, { encoding: 'utf8' });
  return parseChangedFilesOutput(out);
}

function main() {
  const cwd = process.cwd();
  const diffRange = resolveDiffRange();
  const files = listChangedRetroFiles(diffRange);

  if (files.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`[retro-check] no changed retrospective session files for range ${diffRange}`);
    return;
  }

  const missing = [];
  for (const rel of files) {
    const abs = path.resolve(cwd, rel);
    const content = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
    if (!hasReflectionSection(content)) {
      missing.push(rel);
    }
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error('[retro-check] missing required "## Reflection-to-Action" section in:');
    for (const file of missing) {
      // eslint-disable-next-line no-console
      console.error(`- ${file}`);
    }
    // eslint-disable-next-line no-console
    console.error(
      '\nAdd a "## Reflection-to-Action" section with the mandatory reflection prompts and a Do Now action snippet.'
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`[retro-check] validated Reflection-to-Action section in ${files.length} file(s).`);
}

export const __test = {
  parseChangedFilesOutput,
  hasReflectionSection,
  resolveDiffRange,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
