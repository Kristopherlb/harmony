/**
 * tools/scripts/cursor-skills.mjs
 *
 * Purpose: vendor + bootstrap Cursor "global skills" required by this repo.
 *
 * Commands:
 *   node tools/scripts/cursor-skills.mjs list [--json]
 *   node tools/scripts/cursor-skills.mjs verify [--vendored-only] [--vendored-dir <path>] [--home-dir <path>]
 *   node tools/scripts/cursor-skills.mjs install [--overwrite] [--vendored-dir <path>] [--home-dir <path>]
 *
 * Notes:
 * - CI should use `verify --vendored-only` (no reliance on a developer home directory).
 * - Local devs can use `verify` (vendored + home) and `install`.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIRED_SKILLS = [
  'test-driven-development',
  'typescript-expert',
  'clean-architecture',
  'ui-ux-pro-max',
  'shadcn-ui',
];

function usage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  node tools/scripts/cursor-skills.mjs list [--json]',
      '  node tools/scripts/cursor-skills.mjs verify [--vendored-only] [--vendored-dir <path>] [--home-dir <path>]',
      '  node tools/scripts/cursor-skills.mjs install [--overwrite] [--vendored-dir <path>] [--home-dir <path>]',
      '',
      'Examples:',
      '  node tools/scripts/cursor-skills.mjs list',
      '  node tools/scripts/cursor-skills.mjs list --json',
      '  node tools/scripts/cursor-skills.mjs verify',
      '  node tools/scripts/cursor-skills.mjs verify --vendored-only',
      '  node tools/scripts/cursor-skills.mjs install',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') {
      args.json = true;
      continue;
    }
    if (a === '--vendored-only') {
      args.vendoredOnly = true;
      continue;
    }
    if (a === '--overwrite') {
      args.overwrite = true;
      continue;
    }
    if (a === '--vendored-dir') {
      args.vendoredDir = argv[++i];
      continue;
    }
    if (a === '--home-dir') {
      args.homeDir = argv[++i];
      continue;
    }
    if (a.startsWith('-')) {
      throw new Error(`Unknown flag: ${a}`);
    }
    args._.push(a);
  }
  return args;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parseYamlFrontmatter(markdown) {
  if (!markdown.startsWith('---\n') && !markdown.startsWith('---\r\n')) return null;

  const idx = markdown.indexOf('\n---', 4);
  if (idx === -1) return null;

  const frontmatterBlock = markdown.slice(4, idx).trim();
  const lines = frontmatterBlock.split(/\r?\n/);

  /** @type {Record<string, string>} */
  const data = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (!key) continue;
    data[key] = value;
  }

  return data;
}

function getRepoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

function getDefaultVendoredDir() {
  return path.join(getRepoRoot(), '.cursor', 'skills-vendored');
}

function getDefaultHomeDir() {
  return path.join(os.homedir(), '.cursor', 'skills');
}

async function verifyVendored(vendoredDir) {
  const errors = [];

  for (const skill of REQUIRED_SKILLS) {
    const skillDir = path.join(vendoredDir, skill);
    const skillMd = path.join(skillDir, 'SKILL.md');
    if (!(await pathExists(skillDir))) {
      errors.push(`Missing vendored skill directory: ${skillDir}`);
      continue;
    }
    if (!(await pathExists(skillMd))) {
      errors.push(`Missing vendored SKILL.md: ${skillMd}`);
      continue;
    }

    const md = await fs.readFile(skillMd, 'utf8');
    const fm = parseYamlFrontmatter(md);
    if (!fm) {
      errors.push(`Vendored SKILL.md is missing YAML frontmatter: ${skillMd}`);
      continue;
    }
    if (!fm.name) {
      errors.push(`Vendored SKILL.md frontmatter missing "name": ${skillMd}`);
      continue;
    }
    if (fm.name !== skill) {
      errors.push(`Vendored SKILL.md frontmatter name "${fm.name}" does not match folder "${skill}": ${skillMd}`);
    }
    if (!fm.description) {
      errors.push(`Vendored SKILL.md frontmatter missing "description": ${skillMd}`);
    }
  }

  return errors;
}

async function verifyHome(homeDir) {
  const errors = [];

  for (const skill of REQUIRED_SKILLS) {
    const skillMd = path.join(homeDir, skill, 'SKILL.md');
    if (!(await pathExists(skillMd))) {
      errors.push(`Missing installed skill: ${skillMd}`);
    }
  }

  return errors;
}

async function installToHome({ vendoredDir, homeDir, overwrite }) {
  await fs.mkdir(homeDir, { recursive: true });

  const installed = [];
  const skipped = [];

  for (const skill of REQUIRED_SKILLS) {
    const src = path.join(vendoredDir, skill);
    const dst = path.join(homeDir, skill);

    if (!(await pathExists(src))) {
      throw new Error(`Cannot install missing vendored skill: ${src}`);
    }

    const dstExists = await pathExists(dst);
    if (dstExists && !overwrite) {
      skipped.push(skill);
      continue;
    }

    await fs.rm(dst, { recursive: true, force: true });
    await fs.cp(src, dst, { recursive: true });
    installed.push(skill);
  }

  return { installed, skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  const vendoredDir = path.resolve(args.vendoredDir ?? getDefaultVendoredDir());
  const homeDir = path.resolve(args.homeDir ?? getDefaultHomeDir());

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    usage();
    process.exit(0);
  }

  if (cmd === 'list') {
    if (args.json) {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            requiredSkills: REQUIRED_SKILLS,
            vendoredDir,
            homeDir,
          },
          null,
          2
        )
      );
      process.exit(0);
    }

    // eslint-disable-next-line no-console
    console.log(REQUIRED_SKILLS.join('\n'));
    process.exit(0);
  }

  if (cmd === 'verify') {
    const vendoredErrors = await verifyVendored(vendoredDir);
    const homeErrors = args.vendoredOnly ? [] : await verifyHome(homeDir);

    const errors = [...vendoredErrors, ...homeErrors];
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(errors.map((e) => `- ${e}`).join('\n'));
      if (!args.vendoredOnly) {
        // eslint-disable-next-line no-console
        console.error(
          '\nTo install required global skills into ~/.cursor/skills:\n  pnpm -w skills:install\n'
        );
      }
      process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log(
      args.vendoredOnly
        ? `OK: vendored Cursor skills present (${vendoredDir})`
        : `OK: vendored + installed Cursor skills present (${vendoredDir}, ${homeDir})`
    );
    process.exit(0);
  }

  if (cmd === 'install') {
    const vendoredErrors = await verifyVendored(vendoredDir);
    if (vendoredErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(vendoredErrors.map((e) => `- ${e}`).join('\n'));
      process.exit(1);
    }

    const { installed, skipped } = await installToHome({
      vendoredDir,
      homeDir,
      overwrite: Boolean(args.overwrite),
    });

    // eslint-disable-next-line no-console
    console.log(`Installed skills into: ${homeDir}`);
    if (installed.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`- installed: ${installed.join(', ')}`);
    }
    if (skipped.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`- skipped (already present): ${skipped.join(', ')}`);
      // eslint-disable-next-line no-console
      console.log('  Re-run with --overwrite to replace existing installs.');
    }
    process.exit(0);
  }

  throw new Error(`Unknown command: ${cmd}`);
}

export const __test = {
  parseArgs,
  parseYamlFrontmatter,
  verifyVendored,
};

function isMainModule() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : null;
  const self = path.resolve(fileURLToPath(import.meta.url));
  return Boolean(invoked && invoked === self);
}

if (isMainModule()) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.stack ?? String(err));
    process.exit(1);
  });
}

