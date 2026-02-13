/**
 * tools/scripts/run-harmony-mcp.mjs
 *
 * Purpose: Ensure the Harmony MCP server is built then run it over stdio so Cursor
 * (or any MCP client) can use Harmony tools without a separate "turn on" step.
 *
 * Usage (from repo root, or via Cursor MCP config):
 *   node tools/scripts/run-harmony-mcp.mjs
 *
 * Behavior:
 * - Resolves repo root from this script's location.
 * - Runs `pnpm nx run mcp-server:build` so dist/ exists.
 * - Executes packages/tools/mcp-server/dist/src/cli/stdio.js with current env
 *   and inherited stdio (MCP protocol on stdin/stdout).
 *
 * Cursor: point .cursor/mcp.json at this script so MCP is available when working
 * in Harmony; first tool use will build then start the server automatically.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  return r.status ?? 0;
}

const buildStatus = run('pnpm', ['nx', 'run', 'mcp-server:build']);
if (buildStatus !== 0) process.exit(buildStatus);

const stdioPath = join(repoRoot, 'packages/tools/mcp-server/dist/src/cli/stdio.js');
const serverStatus = run('node', [stdioPath], { env: process.env });
process.exit(serverStatus);
