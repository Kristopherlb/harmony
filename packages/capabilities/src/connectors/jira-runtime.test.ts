/**
 * packages/capabilities/src/connectors/jira-runtime.test.ts
 * TCS-001: contract tests for Jira HTTP runtime script.
 */
import { describe, it, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import { Buffer } from 'node:buffer';
import { JIRA_HTTP_RUNTIME_CJS } from './jira-runtime';

type RequestInitLike = { method?: string; headers?: unknown; body?: unknown };
type FetchCall = { url: string; init: RequestInitLike };

async function runRuntime(opts: {
  input: unknown;
  secrets: Record<string, string | undefined>;
  fetchResponse: { ok: boolean; status: number; text: string; statusText?: string };
}): Promise<{ stdout: string; stderr: string; exitCode: number | undefined; fetchCalls: FetchCall[] }> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const fetchCalls: FetchCall[] = [];

  let exitCode: number | undefined;
  let done = false;
  let resolveDone!: () => void;
  const donePromise = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const require = (mod: string) => {
    if (mod === 'node:fs') {
      return {
        readFileSync: (path: string) => {
          const v = opts.secrets[path];
          if (v === undefined) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
          return v;
        },
      };
    }
    throw new Error(`Unexpected require('${mod}')`);
  };

  const fetch = async (url: string, init: RequestInitLike) => {
    fetchCalls.push({ url, init });
    return {
      ok: opts.fetchResponse.ok,
      status: opts.fetchResponse.status,
      statusText: opts.fetchResponse.statusText ?? '',
      text: async () => opts.fetchResponse.text,
    };
  };

  const process = {
    env: { INPUT_JSON: JSON.stringify(opts.input) },
    stdout: {
      write: (chunk: string) => {
        stdoutChunks.push(String(chunk));
        if (!done) {
          done = true;
          resolveDone();
        }
        return true;
      },
    },
    exit: (code: number) => {
      exitCode = code;
      if (!done) {
        done = true;
        resolveDone();
      }
    },
  };

  const console = {
    error: (...args: unknown[]) => {
      stderrChunks.push(args.map(String).join(' '));
      if (!done) {
        done = true;
        resolveDone();
      }
    },
  };

  runInNewContext(
    JIRA_HTTP_RUNTIME_CJS,
    {
      require,
      fetch,
      process,
      console,
      Buffer,
      URL,
      URLSearchParams,
    },
    { timeout: 1000 }
  );

  await donePromise;

  return {
    stdout: stdoutChunks.join(''),
    stderr: stderrChunks.join('\n'),
    exitCode,
    fetchCalls,
  };
}

describe('JIRA_HTTP_RUNTIME_CJS', () => {
  it('uses Basic auth and performs GET with query params', async () => {
    const res = await runRuntime({
      input: {
        method: 'GET',
        host: 'https://example.atlassian.net',
        path: '/rest/api/3/search/jql',
        authMode: 'basic',
        query: { jql: 'project = HSP', maxResults: 5 },
      },
      secrets: {
        '/run/secrets/jira_email': 'me@example.com\n',
        '/run/secrets/jira_api_token': 'abc123\n',
      },
      fetchResponse: { ok: true, status: 200, text: '{"issues":[]}' },
    });

    expect(res.exitCode).toBeUndefined();
    expect(res.fetchCalls.length).toBe(1);
    const call = res.fetchCalls[0]!;
    expect(call.url).toContain('/rest/api/3/search/jql');
    expect(call.url).toContain('jql=project+%3D+HSP');
    expect(call.url).toContain('maxResults=5');
    expect(call.init.method).toBe('GET');

    const headers = call.init.headers as Record<string, string>;
    const expected = Buffer.from('me@example.com:abc123', 'utf8').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
    expect(res.stdout).toBe('{"issues":[]}');
  });

  it('uses Bearer auth and performs POST with JSON body', async () => {
    const res = await runRuntime({
      input: {
        method: 'POST',
        host: 'https://example.atlassian.net',
        path: '/rest/api/3/search/approximate-count',
        authMode: 'oauth2',
        body: { jql: 'project = HSP' },
      },
      secrets: {
        '/run/secrets/jira_access_token': 'tok_xyz',
      },
      fetchResponse: { ok: true, status: 200, text: '{"count":153}' },
    });

    expect(res.fetchCalls.length).toBe(1);
    const call = res.fetchCalls[0]!;
    expect(call.init.method).toBe('POST');
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok_xyz');
    expect(headers['Content-Type']).toBe('application/json');
    expect(call.init.body).toBe(JSON.stringify({ jql: 'project = HSP' }));
    expect(res.stdout).toBe('{"count":153}');
  });

  it('writes an HTTP status-coded message on auth errors (supports error mapping)', async () => {
    const res = await runRuntime({
      input: {
        method: 'GET',
        host: 'https://example.atlassian.net',
        path: '/rest/api/3/search/jql',
        authMode: 'oauth2',
        query: { jql: 'project = HSP' },
      },
      secrets: {
        '/run/secrets/jira_access_token': 'tok_xyz',
      },
      fetchResponse: { ok: false, status: 401, text: 'unauthorized', statusText: 'Unauthorized' },
    });

    expect(res.exitCode).toBe(1);
    expect(res.stderr).toMatch(/HTTP 401/i);
  });
});

