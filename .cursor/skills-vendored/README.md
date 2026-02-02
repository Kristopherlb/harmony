## Vendored Cursor Skills (IMP-033)

This directory contains a **repo-owned** copy of the Cursor “global skills” that Harmony expects to be available at:

`~/.cursor/skills/<skill-name>/SKILL.md`

### Why this exists

- Local developer machines may not have the required global skills installed.
- CI should be able to **validate** that the required skills are present in the repo.

### Install / verify

- Verify vendored skills (CI-safe):
  - `pnpm -w skills:verify:vendored`
- Verify vendored + local `~/.cursor/skills` installation:
  - `pnpm -w skills:verify`
- Install into `~/.cursor/skills` (copies missing skills by default):
  - `pnpm -w skills:install`
  - To overwrite existing installs: `pnpm -w skills:install -- --overwrite`

