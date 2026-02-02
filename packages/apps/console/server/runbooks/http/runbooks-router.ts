// server/runbooks/http/runbooks-router.ts
// HTTP router for runbook listing + content. Read-only, repo-local.

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import { RunbookDetailSchema, RunbookListResponseSchema } from "@shared/schema";
import { promises as fs } from "node:fs";
import path from "node:path";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findWorkspaceRoot(startDir: string): Promise<string> {
  // Walk up until we find a monorepo marker.
  // Prefer pnpm workspace since Harmony is pnpm-based.
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

function parseTitle(id: string, content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return trimmed.replace(/^#\s+/, "").trim();
  }
  return id.replace(/-/g, " ");
}

function safeRunbookPath(runbooksDir: string, id: string): string {
  const filename = `${id}.md`;
  const candidate = path.resolve(runbooksDir, filename);
  const base = path.resolve(runbooksDir);
  if (!candidate.startsWith(base + path.sep) && candidate !== base) {
    throw new Error("Invalid runbook path");
  }
  return candidate;
}

export interface RunbooksRouterOptions {
  runbooksDir?: string;
}

export function createRunbooksRouter(options: RunbooksRouterOptions = {}): Router {
  const router = createRouter();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const root = await findWorkspaceRoot(process.cwd());
      const runbooksDir = options.runbooksDir ?? path.join(root, "runbooks");

      if (!(await pathExists(runbooksDir))) {
        return res.json(RunbookListResponseSchema.parse({ runbooks: [] }));
      }

      const entries = await fs.readdir(runbooksDir, { withFileTypes: true });
      const mdFiles = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));

      const runbooks = await Promise.all(
        mdFiles.map(async (filename) => {
          const id = filename.replace(/\.md$/i, "");
          const fullPath = path.join(runbooksDir, filename);
          const content = await fs.readFile(fullPath, "utf8");
          const stat = await fs.stat(fullPath);
          return {
            id,
            title: parseTitle(id, content),
            filename,
            updatedAt: stat.mtime.toISOString(),
          };
        })
      );

      return res.json(RunbookListResponseSchema.parse({ runbooks }));
    } catch (error) {
      console.error("Error listing runbooks:", error);
      return res.status(500).json({ error: "Failed to list runbooks" });
    }
  });

  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const root = await findWorkspaceRoot(process.cwd());
      const runbooksDir = options.runbooksDir ?? path.join(root, "runbooks");

      if (!(await pathExists(runbooksDir))) {
        return res.status(404).json({ error: "Runbooks directory not found" });
      }

      const fullPath = safeRunbookPath(runbooksDir, id);
      if (!(await pathExists(fullPath))) {
        return res.status(404).json({ error: "Runbook not found" });
      }

      const content = await fs.readFile(fullPath, "utf8");
      const stat = await fs.stat(fullPath);
      const filename = path.basename(fullPath);

      const detail = RunbookDetailSchema.parse({
        id,
        title: parseTitle(id, content),
        filename,
        updatedAt: stat.mtime.toISOString(),
        content,
      });

      return res.json(detail);
    } catch (error) {
      console.error("Error reading runbook:", error);
      return res.status(500).json({ error: "Failed to read runbook" });
    }
  });

  return router;
}

