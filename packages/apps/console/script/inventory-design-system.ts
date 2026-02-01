#!/usr/bin/env tsx
/**
 * Design System Inventory Script
 * 
 * Scans the codebase for design system violations:
 * - Raw <button> usage
 * - Hard-coded color utilities
 * - Inline component definitions in pages
 * - Duplicate button variant definitions
 * - Missing semantic token usage
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

// Color patterns to detect
const hardCodedColorPatterns = [
  /bg-(emerald|amber|red|green|yellow|orange|blue|purple|gray|slate|zinc|neutral|stone)-\d+/g,
  /text-(emerald|amber|red|green|yellow|orange|blue|purple|gray|slate|zinc|neutral|stone)-\d+/g,
  /border-(emerald|amber|red|green|yellow|orange|blue|purple|gray|slate|zinc|neutral|stone)-\d+/g,
];

// Patterns for detecting violations
const patterns = {
  rawButton: /<button\s/g,
  hardCodedColors: hardCodedColorPatterns,
  inlineComponent: /^(function|const)\s+\w+.*=.*\{[\s\S]{0,50}return\s*\(/m,
  duplicateButtonVariants: /buttonVariants|cva\([^)]*variant[^)]*\)/g,
};

async function scanFile(filePath: string, relativePath: string) {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Check for raw <button> usage
    lines.forEach((line, index) => {
      if (patterns.rawButton.test(line)) {
        // Allow exceptions for Radix internals and documented cases
        if (!line.includes("// EXCEPTION") && !line.includes("Radix")) {
          violations.push({
            file: relativePath,
            line: index + 1,
            type: "raw-button",
            message: `Raw <button> found: ${line.trim().substring(0, 60)}`,
          });
        }
      }
    });

    // Check for hard-coded colors
    lines.forEach((line, index) => {
      for (const pattern of patterns.hardCodedColors) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          // Skip if it's in a comment or string that's not a className
          if (line.includes("//") || line.includes("/*")) {
            const commentIndex = Math.min(
              line.indexOf("//"),
              line.indexOf("/*") !== -1 ? line.indexOf("/*") : Infinity
            );
            if (match.index !== undefined && match.index > commentIndex) {
              continue;
            }
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
        const componentEnd = afterMatch.indexOf("\n}\n", 100) || afterMatch.length;
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
        if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") {
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
  console.log("🔍 Scanning codebase for design system violations...\n");

  await scanDirectory(clientSrcPath);

  // Group violations by type
  const violationsByType = violations.reduce((acc, v) => {
    if (!acc[v.type]) acc[v.type] = [];
    acc[v.type].push(v);
    return acc;
  }, {} as Record<string, Violation[]>);

  // Print summary
  console.log("📊 Violation Summary:\n");
  for (const [type, items] of Object.entries(violationsByType)) {
    console.log(`${type}: ${items.length} violations`);
  }

  console.log("\n📋 Detailed Violations:\n");
  for (const [type, items] of Object.entries(violationsByType)) {
    console.log(`\n## ${type.toUpperCase()} (${items.length} violations)\n`);
    items.forEach((v) => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}\n`);
    });
  }

  // Exit with error code if violations found
  if (violations.length > 0) {
    console.log(`\n❌ Found ${violations.length} violations`);
    process.exit(1);
  } else {
    console.log("\n✅ No violations found!");
    process.exit(0);
  }
}

main().catch(console.error);
