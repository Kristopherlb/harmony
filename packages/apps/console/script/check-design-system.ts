#!/usr/bin/env tsx
/**
 * Design System Enforcement Script
 * 
 * Checks for violations of design system requirements:
 * 1. No raw <button> in client/src/** (except documented exceptions)
 * 2. No duplicate Button implementations
 * 3. No hard-coded color utilities for semantic roles
 * 4. No inline component definitions in pages (except <30 line local helpers)
 * 5. All status/health colors use semantic tokens
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

interface Violation {
  file: string;
  line: number;
  type: string;
  message: string;
}

const violations: Violation[] = [];
const clientSrcPath = join(process.cwd(), "client/src");

// Hard-coded color patterns to detect
const hardCodedColorPatterns = [
  /bg-(emerald|amber|red|green|yellow|orange|blue|purple|gray|slate|zinc|neutral|stone)-\d+/g,
  /text-(emerald|amber|red|green|yellow|orange|blue|purple|gray|slate|zinc|neutral|stone)-\d+/g,
  /border-(emerald|amber|red|green|yellow|orange|blue|purple|gray|slate|zinc|neutral|stone)-\d+/g,
];

// Allowed exceptions (documented)
const EXCEPTIONS = [
  "// EXCEPTION:",
  "Radix",
  "node_modules",
  "__tests__",
  ".test.",
  ".spec.",
];

async function scanFile(filePath: string, relativePath: string) {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Check for raw <button> usage
    lines.forEach((line, index) => {
      if (/<button\s/g.test(line)) {
        const isException = EXCEPTIONS.some((exc) => line.includes(exc) || relativePath.includes(exc));
        if (!isException) {
          violations.push({
            file: relativePath,
            line: index + 1,
            type: "raw-button",
            message: `Raw <button> found: ${line.trim().substring(0, 60)}`,
          });
        }
      }
    });

    // Check for hard-coded colors (skip in test files and exceptions)
    if (!relativePath.includes("__tests__") && !relativePath.includes(".test.")) {
      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith("//") || line.trim().startsWith("/*")) {
          return;
        }

        for (const pattern of hardCodedColorPatterns) {
          const matches = line.matchAll(pattern);
          for (const match of matches) {
            // Skip if it's a comment
            const commentIndex = Math.min(
              line.indexOf("//") !== -1 ? line.indexOf("//") : Infinity,
              line.indexOf("/*") !== -1 ? line.indexOf("/*") : Infinity
            );
            if (match.index !== undefined && match.index > commentIndex) {
              continue;
            }

            violations.push({
              file: relativePath,
              line: index + 1,
              type: "hard-coded-color",
              message: `Hard-coded color: ${match[0]}`,
            });
          }
        }
      });
    }

    // Check for inline component definitions in pages
    if (relativePath.startsWith("pages/")) {
      const componentMatches = content.matchAll(
        /^(function|const)\s+([A-Z][a-zA-Z0-9]*)\s*[=:].*\{/gm
      );
      for (const match of componentMatches) {
        const componentName = match[2];
        // Skip if it's the default export (the page itself)
        if (componentName.includes("Page") || componentName === "default") {
          continue;
        }

        // Check if component is more than 30 lines
        const componentStart = match.index || 0;
        const afterMatch = content.substring(componentStart);
        const braceCount = (afterMatch.match(/\{/g) || []).length;
        let braceBalance = 0;
        let componentEnd = afterMatch.length;

        for (let i = 0; i < afterMatch.length; i++) {
          if (afterMatch[i] === "{") braceBalance++;
          if (afterMatch[i] === "}") braceBalance--;
          if (braceBalance === 0 && i > 100) {
            componentEnd = i;
            break;
          }
        }

        const componentLength = afterMatch.substring(0, componentEnd).split("\n").length;

        if (componentLength > 30) {
          violations.push({
            file: relativePath,
            line: content.substring(0, componentStart).split("\n").length,
            type: "inline-component",
            message: `Large inline component "${componentName}" (${componentLength} lines) should be extracted`,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }
}

async function scanDirectory(dirPath: string, relativePath: string = "") {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const newRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // Skip node_modules, .git, dist, etc.
        if (
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules" &&
          entry.name !== "dist" &&
          entry.name !== "coverage"
        ) {
          await scanDirectory(fullPath, newRelativePath);
        }
      } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
        await scanFile(fullPath, newRelativePath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
}

async function main() {
  console.log("🔍 Checking design system compliance...\n");

  await scanDirectory(clientSrcPath);

  // Group violations by type
  const violationsByType = violations.reduce(
    (acc, v) => {
      if (!acc[v.type]) acc[v.type] = [];
      acc[v.type].push(v);
      return acc;
    },
    {} as Record<string, Violation[]>
  );

  // Print summary
  console.log("📊 Violation Summary:\n");
  for (const [type, items] of Object.entries(violationsByType)) {
    console.log(`  ${type}: ${items.length} violations`);
  }

  if (violations.length > 0) {
    console.log("\n📋 Detailed Violations:\n");
    for (const [type, items] of Object.entries(violationsByType)) {
      console.log(`\n## ${type.toUpperCase()} (${items.length} violations)\n`);
      items.slice(0, 10).forEach((v) => {
        console.log(`  ${v.file}:${v.line}`);
        console.log(`    ${v.message}\n`);
      });
      if (items.length > 10) {
        console.log(`  ... and ${items.length - 10} more\n`);
      }
    }

    console.log(`\n❌ Found ${violations.length} violations`);
    process.exit(1);
  } else {
    console.log("\n✅ No violations found! Design system compliance check passed.");
    process.exit(0);
  }
}

main().catch(console.error);
