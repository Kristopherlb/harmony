/**
 * packages/tools/mcp-server/src/demo/run-demo.ts
 * Persona A demo: exercise MCP JSON-RPC over stdio.
 *
 * Modes:
 * - default / --temporal: uses Temporal-backed env defaults (requires Temporal + worker running)
 * - --local: disables env defaults so `golden.echo` runs via deterministic local fallback
 */
import { PassThrough } from 'node:stream';
import { createCapabilityRegistry } from '@golden/capabilities';
import { generateToolManifestFromCapabilities } from '../manifest/capabilities.js';
import { runMcpStdioServer } from '../mcp/stdio-server.js';
import { createStdioJsonRpcClient } from './stdio-jsonrpc-client.js';
import { parseDemoArgs } from './demo-args.js';
import { formatAsMarkdownTable } from './format-as-table.js';

function handleBrokenPipe(): void {
  // If the consumer (e.g., jq) exits early, stdout gets closed and Node will throw EPIPE.
  // Treat this as a normal exit for CLI ergonomics.
  process.stdout.on('error', (err: any) => {
    if (err && typeof err === 'object' && (err as any).code === 'EPIPE') {
      process.exit(0);
    }
  });
}

async function main(): Promise<void> {
  handleBrokenPipe();

  const demo = parseDemoArgs({ argv: process.argv });

  const manifest = generateToolManifestFromCapabilities({
    registry: createCapabilityRegistry(),
    generated_at: new Date().toISOString(),
    version: '1',
    includeBlueprints: true,
  });

  // In-process stdio loop for a clean demo.
  const stdin = new PassThrough();
  const stdout = new PassThrough();

  const server = runMcpStdioServer({
    manifest,
    stdin,
    stdout,
    useEnvDefaults: demo.temporal,
  });

  const client = createStdioJsonRpcClient({ stdin, stdout });

  const init = await client.request('initialize', { protocolVersion: '2025-11-25' });
  process.stdout.write(JSON.stringify({ step: 'initialize', ok: true, result: init }) + '\n');

  const list = await client.request('tools/list', {});
  process.stdout.write(JSON.stringify({ step: 'tools/list', ok: true, result: list }) + '\n');

  // Canonical demo tool call.
  // - In --local mode, this uses the tool-surface fallback for golden.echo (deterministic).
  // - In default/--temporal mode, this routes through Temporal executeCapabilityWorkflow (requires worker).
  const call = await client.request('tools/call', { name: demo.name, arguments: demo.arguments });
  process.stdout.write(JSON.stringify({ step: 'tools/call', ok: true, result: call }) + '\n');

  // Optional pretty output for the last step (human-friendly).
  if (demo.output === 'table') {
    const sc = (call as any)?.structuredContent as Record<string, unknown> | undefined;
    if (sc && typeof sc === 'object') {
      process.stdout.write(formatAsMarkdownTable(sc) + '\n');
    }
  }

  client.close();
  stdin.end();
  await server;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

