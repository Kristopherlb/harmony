/**
 * packages/apps/console/server/services/template-catalog.ts
 *
 * Loads workflow template catalog for prompt context (Phase 4.2.1 template awareness).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findWorkspaceRoot(startDir: string): Promise<string> {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 25; i++) {
    const pnpmWorkspace = path.join(dir, "pnpm-workspace.yaml");
    const gitDir = path.join(dir, ".git");
    if (await pathExists(pnpmWorkspace)) return dir;
    if (await pathExists(gitDir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir);
}

/**
 * Returns template summaries for agent prompt context.
 * Safe to call; returns [] on any error.
 */
export async function getTemplateSummaries(): Promise<TemplateSummary[]> {
  try {
    const root = await findWorkspaceRoot(process.cwd());
    const catalogDir = path.join(root, "packages", "core", "src", "templates", "catalog");
    if (!(await pathExists(catalogDir))) return [];

    const manifestPath = path.join(catalogDir, "manifest.json");
    if (!(await pathExists(manifestPath))) return [];

    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    const manifestJson = JSON.parse(manifestRaw) as { templateIds?: string[] };
    const ids = manifestJson.templateIds ?? [];

    const summaries: TemplateSummary[] = [];
    for (const id of ids) {
      const filePath = path.resolve(catalogDir, `${id}.json`);
      const base = path.resolve(catalogDir);
      if (!filePath.startsWith(base + path.sep) && filePath !== base) continue;
      if (!(await pathExists(filePath))) continue;

      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as { id?: string; name?: string; title?: string; description?: string };
      summaries.push({
        id: parsed.id ?? id,
        name: parsed.name ?? parsed.title ?? id,
        description: typeof parsed.description === "string" ? parsed.description : undefined,
      });
    }
    return summaries;
  } catch {
    return [];
  }
}
