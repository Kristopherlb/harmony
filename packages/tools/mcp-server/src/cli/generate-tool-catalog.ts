/**
 * packages/tools/mcp-server/src/cli/generate-tool-catalog.ts
 * Regenerate deterministic tool-catalog.json from registries (no timestamps).
 */
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolCatalog, serializeToolCatalog } from '../../index.js';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv: string[]): { version: string; includeBlueprints: boolean } {
  const versionFlagIdx = argv.indexOf('--version');
  const version = versionFlagIdx >= 0 ? (argv[versionFlagIdx + 1] ?? '1') : '1';
  const includeBlueprints = argv.includes('--no-blueprints') ? false : true;
  return { version, includeBlueprints };
}

async function main() {
  const { version, includeBlueprints } = parseArgs(process.argv.slice(2));
  const registry = createCapabilityRegistry();
  const catalog = generateToolCatalog({ registry, version, includeBlueprints });
  const outPath = path.resolve(process.cwd(), 'packages/tools/mcp-server/src/manifest/tool-catalog.json');
  writeFileSync(outPath, serializeToolCatalog(catalog), 'utf-8');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

