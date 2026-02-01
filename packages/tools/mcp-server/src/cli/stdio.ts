/**
 * packages/tools/mcp-server/src/cli/stdio.ts
 * CLI entrypoint: run the MCP stdio server with a generated manifest.
 *
 * This is intentionally tiny: it exists to make local dev UX predictable.
 */
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from '../manifest/capabilities.js';
import { runMcpStdioServer } from '../mcp/stdio-server.js';

function readBoolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (typeof v !== 'string' || v.trim().length === 0) return fallback;
  return v.trim().toLowerCase() === 'true';
}

async function main(): Promise<void> {
  const includeBlueprints = readBoolEnv('MCP_INCLUDE_BLUEPRINTS', true);
  const useEnvDefaults = readBoolEnv('MCP_USE_ENV_DEFAULTS', true);

  const manifest = generateToolManifestFromCapabilities({
    registry: createCapabilityRegistry(),
    generated_at: process.env.MCP_MANIFEST_GENERATED_AT ?? new Date().toISOString(),
    version: process.env.MCP_MANIFEST_VERSION ?? '1',
    includeBlueprints,
  });

  await runMcpStdioServer({
    manifest,
    useEnvDefaults,
  });
}

main().catch((err) => {
  // Never write logs to stdout in MCP stdio mode; use stderr.
  console.error(err);
  process.exit(1);
});

