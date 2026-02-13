/**
 * packages/capabilities/src/connectors/jira-runtime.test.ts
 * TCS-001: contract tests for Jira HTTP runtime script.
 */
import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JIRA_HTTP_RUNTIME_CJS } from './jira-runtime';

async function runRuntime(opts: {
  input: unknown;
  secretsDir: string;
}): { stdout: string; stderr: string; exitCode: number } {
  const dir = mkdtempSync(join(tmpdir(), 'jira-runtime-'));
  const file = join(dir, 'runtime.cjs');
  writeFileSync(file, JIRA_HTTP_RUNTIME_CJS, 'utf8');

  const child = spawn(process.execPath, [file], {
    env: {
      ...process.env,
      INPUT_JSON: JSON.stringify(opts.input),
      SECRETS_DIR: opts.secretsDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on('data', (c) => stdoutChunks.push(Buffer.from(c)));
  child.stderr?.on('data', (c) => stderrChunks.push(Buffer.from(c)));

  const exitCode = await new Promise<number>((resolve) => {
    const softTimeoutMs = 10_000;
    const hardTimeoutMs = 12_000;

    const soft = setTimeout(() => {
      child.kill('SIGKILL');
    }, softTimeoutMs);
    const hard = setTimeout(() => {
      resolve(1);
    }, hardTimeoutMs);

    child.on('exit', (code) => {
      clearTimeout(soft);
      clearTimeout(hard);
      resolve(typeof code === 'number' ? code : 1);
    });
  });

  return {
    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: Buffer.concat(stderrChunks).toString('utf8'),
    exitCode,
  };
}

async function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind');
  return { server, host: `http://127.0.0.1:${addr.port}` };
}

describe('JIRA_HTTP_RUNTIME_CJS', () => {
  it('uses Basic auth and performs GET with query params', async () => {
    const requests: Array<{ url: string; auth: string | undefined }> = [];
    const { server, host } = await startServer((req, res) => {
      requests.push({
        url: String(req.url ?? ''),
        auth: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
      });
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ issues: [] }));
    });

    const secretsDir = mkdtempSync(join(tmpdir(), 'jira-secrets-'));
    mkdirSync(secretsDir, { recursive: true });
    writeFileSync(join(secretsDir, 'jira_email'), 'me@example.com\n', 'utf8');
    writeFileSync(join(secretsDir, 'jira_api_token'), 'abc123\n', 'utf8');

    try {
    const res = await runRuntime({
        input: {
          method: 'GET',
          host,
          path: '/rest/api/3/search/jql',
          authMode: 'basic',
          query: { jql: 'project = HSP', maxResults: 5 },
        },
        secretsDir,
      });

      expect(res.exitCode).toBe(0);
      expect(requests.length).toBe(1);
      expect(requests[0]!.url).toContain('/rest/api/3/search/jql');
      expect(requests[0]!.url).toContain('jql=project+%3D+HSP');
      expect(requests[0]!.url).toContain('maxResults=5');
      const expected = Buffer.from('me@example.com:abc123', 'utf8').toString('base64');
      expect(requests[0]!.auth).toBe(`Basic ${expected}`);
      expect(res.stdout).toBe('{"issues":[]}');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('uses Bearer auth and performs POST with JSON body', async () => {
    const requests: Array<{ method: string; auth: string | undefined; body: string }> = [];
    const { server, host } = await startServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.from(c as any));
      const body = Buffer.concat(chunks).toString('utf8');
      requests.push({
        method: String(req.method ?? ''),
        auth: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
        body,
      });
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ count: 153 }));
    });

    const secretsDir = mkdtempSync(join(tmpdir(), 'jira-secrets-'));
    mkdirSync(secretsDir, { recursive: true });
    writeFileSync(join(secretsDir, 'jira_access_token'), 'tok_xyz', 'utf8');

    try {
      const res = await runRuntime({
        input: {
          method: 'POST',
          host,
          path: '/rest/api/3/search/approximate-count',
          authMode: 'oauth2',
          body: { jql: 'project = HSP' },
        },
        secretsDir,
      });

      expect(res.exitCode).toBe(0);
      expect(requests.length).toBe(1);
      expect(requests[0]!.method).toBe('POST');
      expect(requests[0]!.auth).toBe('Bearer tok_xyz');
      expect(requests[0]!.body).toBe(JSON.stringify({ jql: 'project = HSP' }));
      expect(res.stdout).toBe('{"count":153}');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('writes an HTTP status-coded message on auth errors (supports error mapping)', async () => {
    const { server, host } = await startServer((_req, res) => {
      res.statusCode = 401;
      res.statusMessage = 'Unauthorized';
      res.end('unauthorized');
    });

    const secretsDir = mkdtempSync(join(tmpdir(), 'jira-secrets-'));
    mkdirSync(secretsDir, { recursive: true });
    writeFileSync(join(secretsDir, 'jira_access_token'), 'tok_xyz', 'utf8');

    try {
      const res = await runRuntime({
        input: {
          method: 'GET',
          host,
          path: '/rest/api/3/search/jql',
          authMode: 'oauth2',
          query: { jql: 'project = HSP' },
        },
        secretsDir,
      });

      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toMatch(/HTTP 401/i);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

