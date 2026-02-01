/**
 * packages/tools/workbench-server/src/cli.ts
 * Dev runner for Workbench server.
 *
 * This is intended for local exploration (dev auth) and quick testing.
 */
import { createWorkbenchServer } from './server.js';

function readEnv(name: string, fallback: string): string {
  const v = process.env[name];
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return fallback;
}

async function main(): Promise<void> {
  const port = Number(readEnv('WORKBENCH_PORT', '8787'));

  // Sensible local defaults (users can override).
  process.env.WORKBENCH_ENVIRONMENT ??= 'local';
  process.env.WORKBENCH_CORS_ORIGINS ??= 'http://localhost:3000';

  // Dev auth on by default for this runner.
  process.env.WORKBENCH_DEV_AUTH ??= 'true';
  process.env.WORKBENCH_DEV_USER ??= 'user:dev';
  process.env.WORKBENCH_DEV_ROLES ??=
    'provider:github,provider:jira,workbench:launch,workbench:graphql:query,workbench:rest:read';

  const s = createWorkbenchServer({ port });
  await s.listen();

  const base = s.address();
  // eslint-disable-next-line no-console
  console.log(`Workbench server: ${base}`);
  // eslint-disable-next-line no-console
  console.log(`Create session: curl -s -X POST "${base}/workbench/sessions" -H "content-type: application/json" -H "origin: http://localhost:3000" --data '{"provider":"github","kind":"graphql","mode":"launch"}'`);
  // eslint-disable-next-line no-console
  console.log(`Then open:      ${base}/workbench/launch/graphql?sessionId=<sessionId>`);

  // Keep process alive.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

