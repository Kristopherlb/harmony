#!/usr/bin/env tsx
/**
 * Script to systematically replace hard-coded colors with semantic tokens
 * 
 * This script performs find-and-replace operations for common color patterns
 * across the codebase. Run this after manual review of critical files.
 */

import { readFile, writeFile } from "fs/promises";
import { readdir } from "fs/promises";
import { join } from "path";

const clientSrcPath = join(process.cwd(), "client/src");

// Color replacement mappings
const colorReplacements: Array<[RegExp, string]> = [
  // Status colors
  [/bg-emerald-500/g, "bg-status-healthy"],
  [/text-emerald-400/g, "text-status-healthy"],
  [/text-emerald-500/g, "text-status-healthy"],
  [/bg-amber-500/g, "bg-status-degraded"],
  [/text-amber-400/g, "text-status-degraded"],
  [/text-amber-500/g, "text-status-degraded"],
  [/bg-red-500/g, "bg-status-critical"],
  [/text-red-400/g, "text-status-critical"],
  [/text-red-500/g, "text-status-critical"],
  [/bg-gray-500/g, "bg-status-unknown"],
  [/text-gray-400/g, "text-status-unknown"],
  [/text-gray-500/g, "text-status-unknown"],
  
  // Risk colors
  [/bg-green-500\/20/g, "bg-risk-low/20"],
  [/text-green-400/g, "text-risk-low"],
  [/border-green-500\/30/g, "border-risk-low/30"],
  [/bg-yellow-500\/20/g, "bg-risk-medium/20"],
  [/text-yellow-400/g, "text-risk-medium"],
  [/border-yellow-500\/30/g, "border-risk-medium/30"],
  [/bg-orange-500\/20/g, "bg-risk-high/20"],
  [/text-orange-400/g, "text-risk-high"],
  [/text-orange-500/g, "text-risk-high"],
  [/border-orange-500\/30/g, "border-risk-high/30"],
  
  // Common semantic mappings
  [/text-blue-400/g, "text-primary"],
  [/text-blue-500/g, "text-primary"],
  [/text-blue-300/g, "text-primary/80"],
  [/text-purple-400/g, "text-primary"],
  [/text-pink-400/g, "text-primary"],
  [/text-cyan-400/g, "text-primary"],
];

async function processFile(filePath: string) {
  try {
    const content = await readFile(filePath, "utf-8");
    let modified = content;
    let changed = false;

    for (const [pattern, replacement] of colorReplacements) {
      if (pattern.test(modified)) {
        modified = modified.replace(pattern, replacement);
        changed = true;
      }
    }

    if (changed) {
      await writeFile(filePath, modified, "utf-8");
      console.log(`Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

async function scanDirectory(dirPath: string) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let updatedCount = 0;

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") {
          updatedCount += await scanDirectory(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
        if (await processFile(fullPath)) {
          updatedCount++;
        }
      }
    }

    return updatedCount;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    return 0;
  }
}

async function main() {
  console.log("🔄 Replacing hard-coded colors with semantic tokens...\n");
  
  const updatedCount = await scanDirectory(clientSrcPath);
  
  console.log(`\n✅ Updated ${updatedCount} files`);
  console.log("\n⚠️  Note: Review changes manually. Some replacements may need adjustment.");
}

main().catch(console.error);
