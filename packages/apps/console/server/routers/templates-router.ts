// packages/apps/console/server/routers/templates-router.ts
// Serves workflow template catalog from packages/core/src/templates/catalog (repo-local).

import type { Request, Response } from "express";
import { Router } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  templateDraftSchema,
  templateManifestSchema,
  type TemplateDraft,
  type TemplateManifest,
} from "@golden/core";

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

function safeTemplatePath(catalogDir: string, id: string): string {
  const filename = `${id}.json`;
  const candidate = path.resolve(catalogDir, filename);
  const base = path.resolve(catalogDir);
  if (!candidate.startsWith(base + path.sep) && candidate !== base) {
    throw new Error("Invalid template path");
  }
  return candidate;
}

export function createTemplatesRouter(): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const root = await findWorkspaceRoot(process.cwd());
      const catalogDir = path.join(root, "packages", "core", "src", "templates", "catalog");

      if (!(await pathExists(catalogDir))) {
        return res.json(templateManifestSchema.parse({ version: "1.0.0", templates: [] }));
      }

      const manifestPath = path.join(catalogDir, "manifest.json");
      if (!(await pathExists(manifestPath))) {
        return res.json(templateManifestSchema.parse({ version: "1.0.0", templates: [] }));
      }

      const manifestRaw = await fs.readFile(manifestPath, "utf8");
      const manifestJson = JSON.parse(manifestRaw) as { version?: string; templateIds?: string[] };
      const version = manifestJson.version ?? "1.0.0";
      const ids = manifestJson.templateIds ?? [];

      const templates: TemplateDraft[] = [];
      for (const id of ids) {
        const filePath = safeTemplatePath(catalogDir, id);
        if (!(await pathExists(filePath))) continue;
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = templateDraftSchema.safeParse(JSON.parse(raw));
        if (parsed.success) templates.push(parsed.data);
      }

      const manifest: TemplateManifest = { version, templates };
      return res.json(templateManifestSchema.parse(manifest));
    } catch (error) {
      console.error("Error loading template catalog:", error);
      return res.status(500).json({ error: "Failed to load templates" });
    }
  });

  return router;
}
