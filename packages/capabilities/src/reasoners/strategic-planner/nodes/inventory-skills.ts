/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/inventory-skills.ts
 *
 * Purpose: deterministically inventory skills (project + global) and repo generators.
 *
 * Notes:
 * - Keep this pure and deterministic: filesystem reads only, stable ordering.
 * - Minimal frontmatter parsing (YAML-like) without external deps.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export type SkillInfo = {
  name: string;
  description: string;
  skillPath: string;
  source: 'project' | 'global';
};

export type GeneratorInfo = {
  name: string;
  description: string;
  schema: string;
  factory: string;
};

export type InventorySkillsInput = {
  projectSkillsDir: string;
  globalSkillsDir?: string;
  generatorsJsonPath: string;
};

export type InventorySkillsOutput = {
  skills: SkillInfo[];
  generators: GeneratorInfo[];
};

export async function inventorySkills(input: InventorySkillsInput): Promise<InventorySkillsOutput> {
  const globalSkillsDir = input.globalSkillsDir ?? join(homedir(), '.cursor', 'skills');

  const [projectSkills, globalSkills, generators] = await Promise.all([
    listSkillsInDir(input.projectSkillsDir, 'project'),
    listSkillsInDir(globalSkillsDir, 'global'),
    loadGenerators(input.generatorsJsonPath),
  ]);

  // Stable ordering (CDM-001 style determinism): source, name, path.
  const skills = [...projectSkills, ...globalSkills].sort((a, b) => {
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.skillPath.localeCompare(b.skillPath);
  });

  const gens = generators.sort((a, b) => a.name.localeCompare(b.name));

  return { skills, generators: gens };
}

async function listSkillsInDir(dir: string, source: SkillInfo['source']): Promise<SkillInfo[]> {
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const candidates = entries.filter((e) => e.isDirectory()).map((e) => join(dir, e.name, 'SKILL.md'));

  const results: SkillInfo[] = [];
  for (const skillPath of candidates) {
    if (!existsSync(skillPath)) continue;
    const raw = await readFile(skillPath, 'utf8');
    const { frontmatter } = extractFrontmatter(raw);
    const name = frontmatter.name ?? inferSkillNameFromPath(skillPath);
    const description = frontmatter.description ?? '';
    results.push({ name, description, skillPath, source });
  }

  return results;
}

function inferSkillNameFromPath(skillPath: string): string {
  const parts = skillPath.split('/');
  const idx = parts.lastIndexOf('SKILL.md');
  if (idx > 0) return parts[idx - 1] ?? 'unknown-skill';
  return 'unknown-skill';
}

async function loadGenerators(generatorsJsonPath: string): Promise<GeneratorInfo[]> {
  const raw = await readFile(generatorsJsonPath, 'utf8');
  const parsed = JSON.parse(raw) as { generators?: Record<string, { factory?: string; schema?: string; description?: string }> };
  const gens = parsed.generators ?? {};
  return Object.keys(gens).map((name) => ({
    name,
    description: gens[name]?.description ?? '',
    schema: gens[name]?.schema ?? '',
    factory: gens[name]?.factory ?? '',
  }));
}

function extractFrontmatter(content: string): { frontmatter: Record<string, string> } {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') return { frontmatter: {} };
  const fm: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---') break;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, '$1');
    if (key) fm[key] = value;
  }
  return { frontmatter: fm };
}

