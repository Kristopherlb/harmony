// server/architecture.test.ts
// Enforces Clean Architecture: domain/application must not have runtime deps on
// express, zod, drizzle, pg, or routes; only import type from @shared/schema.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = __dirname;
const FORBIDDEN_MODULES = ["express", "zod", "pg"] as const;
const DRIZZLE_PATTERN = /drizzle/;
const ROUTES_PATTERN = /routes/;

function findTsFilesUnder(dir: string, pattern: RegExp): string[] {
  const out: string[] = [];
  function walk(d: string) {
    if (!statSync(d, { throwIfNoEntry: false })?.isDirectory()) return;
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.endsWith(".ts") && !name.endsWith(".d.ts") && pattern.test(full))
        out.push(full);
    }
  }
  walk(dir);
  return out;
}

function getModuleSpecifierText(node: ts.ImportDeclaration): string {
  const spec = node.moduleSpecifier;
  if (!ts.isStringLiteral(spec)) return "";
  return spec.text.trim();
}

/** Allowed: import type { X } and import { type X } from "@shared/schema". */
function isSchemaImportTypeOnly(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  const bindings = clause.namedBindings;
  if (!bindings) return true;
  if (ts.isNamespaceImport(bindings)) return false;
  return bindings.elements.every((el) => el.isTypeOnly);
}

function collectViolations(filePath: string, content: string): { file: string; message: string }[] {
  const violations: { file: string; message: string }[] = [];
  const source = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const spec = getModuleSpecifierText(node);
      if (!spec) return;

      const fromForbidden = FORBIDDEN_MODULES.some((m) => spec === m || spec.endsWith(`/${m}`));
      const fromDrizzle = DRIZZLE_PATTERN.test(spec);
      const fromRoutes = ROUTES_PATTERN.test(spec);
      const fromSchema = spec === "@shared/schema";

      if (fromForbidden || fromDrizzle || fromRoutes) {
        violations.push({
          file: filePath,
          message: `Forbidden import from "${spec}" (express/zod/drizzle/pg/routes not allowed in domain/application)`,
        });
        return;
      }

      if (fromSchema && !isSchemaImportTypeOnly(node)) {
        violations.push({
          file: filePath,
          message: `Only "import type" from "@shared/schema" allowed; value import found for "${spec}"`,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(source, visit);
  return violations;
}

describe("Architecture: domain/application import rules", () => {
  it("forbids runtime imports (express, zod, drizzle, pg, routes) in domain/application", () => {
    const domainFiles = findTsFilesUnder(SERVER_ROOT, /[/\\]domain[/\\]/);
    const appFiles = findTsFilesUnder(SERVER_ROOT, /[/\\]application[/\\]/);
    const allFiles = [...domainFiles, ...appFiles];
    const violations: { file: string; message: string }[] = [];

    for (const fp of allFiles) {
      const content = readFileSync(fp, "utf-8");
      violations.push(...collectViolations(fp, content));
    }

    expect(violations, violations.map((v) => `${v.file}: ${v.message}`).join("\n")).toHaveLength(0);
  });

  it("detects forbidden value import from zod", () => {
    const content = 'import { z } from "zod";';
    const v = collectViolations("/fake/domain/foo.ts", content);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].message).toMatch(/zod/);
  });

  it("detects forbidden type-only import from zod (zod entirely forbidden)", () => {
    const content = 'import type { Z } from "zod";';
    const v = collectViolations("/fake/application/bar.ts", content);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].message).toMatch(/zod/);
  });

  it("detects forbidden import from drizzle-orm / drizzle-kit", () => {
    expect(collectViolations("/fake/application/db.ts", 'import { x } from "drizzle-orm";').length).toBeGreaterThan(0);
    expect(collectViolations("/fake/domain/config.ts", 'import { defineConfig } from "drizzle-kit";').length).toBeGreaterThan(0);
  });

  it("allows import type { X } from @shared/schema", () => {
    const content = 'import type { Action } from "@shared/schema";';
    const v = collectViolations("/fake/application/types.ts", content);
    expect(v).toHaveLength(0);
  });

  it("allows import { type X } from @shared/schema", () => {
    const content = 'import { type Action } from "@shared/schema";';
    const v = collectViolations("/fake/application/types.ts", content);
    expect(v).toHaveLength(0);
  });

  it("detects forbidden value import from @shared/schema", () => {
    const content = 'import { ExecuteActionRequestSchema } from "@shared/schema";';
    const v = collectViolations("/fake/application/handler.ts", content);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].message).toMatch(/import type|@shared\/schema/);
  });

  it("keeps approval context validation in audit boundary, not router adapters", () => {
    const routerPath = join(SERVER_ROOT, "routers", "workbench-router.ts");
    const auditPath = join(SERVER_ROOT, "audit", "approval-log.ts");
    const routerSource = readFileSync(routerPath, "utf-8");
    const auditSource = readFileSync(auditPath, "utf-8");

    // Router should map domain validation errors, not re-implement approval context checks.
    expect(routerSource.includes("isApprovalLogValidationError")).toBe(true);
    expect(routerSource.includes("function hasRequiredApprovalContext")).toBe(false);

    // Core validation helpers live in the audit module.
    expect(auditSource.includes("function hasRequiredApprovalContext")).toBe(true);
    expect(auditSource.includes("validateApprovalLogEntry")).toBe(true);
  });
});
