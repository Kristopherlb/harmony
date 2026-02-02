/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/inventory-skills.test.ts
 *
 * Purpose: TDD for skill/generator inventory scanning.
 */
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { inventorySkills } from './inventory-skills.js';

function repoRoot(): string {
  // nodes/ -> strategic-planner/ -> reasoners/ -> src/ -> capabilities/ -> packages/ -> repo root
  return fileURLToPath(new URL('../../../../../..', import.meta.url));
}

describe('inventorySkills', () => {
  it('discovers project skills and parses basic metadata', async () => {
    const result = await inventorySkills({
      projectSkillsDir: `${repoRoot()}/.cursor/skills`,
      generatorsJsonPath: `${repoRoot()}/tools/path/generators.json`,
    });

    expect(result.skills.length).toBeGreaterThan(10);

    const spp = result.skills.find((s) => s.name === 'strategic-planning-protocol');
    expect(spp).toBeTruthy();
    expect(spp?.source).toBe('project');
    expect(typeof spp?.description).toBe('string');
    expect(spp?.description.length).toBeGreaterThan(0);

    const tcs = result.skills.find((s) => s.name === 'testing-certification-standard');
    expect(tcs).toBeTruthy();
  });

  it('loads Nx generators metadata from tools/path/generators.json', async () => {
    const result = await inventorySkills({
      projectSkillsDir: `${repoRoot()}/.cursor/skills`,
      generatorsJsonPath: `${repoRoot()}/tools/path/generators.json`,
    });

    expect(result.generators.length).toBeGreaterThan(0);
    expect(result.generators.map((g) => g.name)).toContain('capability');
    expect(result.generators.map((g) => g.name)).toContain('sync');
  });

  it('does not throw if global skills directory is missing or empty', async () => {
    const result = await inventorySkills({
      projectSkillsDir: `${repoRoot()}/.cursor/skills`,
      globalSkillsDir: `${repoRoot()}/__does_not_exist__`,
      generatorsJsonPath: `${repoRoot()}/tools/path/generators.json`,
    });

    expect(Array.isArray(result.skills)).toBe(true);
  });
});

