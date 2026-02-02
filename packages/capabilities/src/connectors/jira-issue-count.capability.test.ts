/**
 * packages/capabilities/src/connectors/jira-issue-count.capability.test.ts
 * TCS-001 contract verification + connector container-shape tests (TDD).
 */
import { describe, it, expect } from 'vitest';
import { jiraIssueCountCapability } from './jira-issue-count.capability.js';

describe('jiraIssueCountCapability', () => {
  it('validates aiHints examples against schemas', () => {
    expect(() =>
      jiraIssueCountCapability.schemas.input.parse(jiraIssueCountCapability.aiHints.exampleInput)
    ).not.toThrow();
    expect(() =>
      jiraIssueCountCapability.schemas.output.parse(jiraIssueCountCapability.aiHints.exampleOutput)
    ).not.toThrow();
  });

  it('builds a Dagger container that calls Jira /rest/api/3/search/approximate-count', () => {
    const calls: {
      from: string[];
      env: Array<{ key: string; value: string }>;
      newFile: Array<{ path: string; contents: string }>;
      mountedSecrets: Array<{ path: string; ref: unknown }>;
      exec: string[][];
    } = { from: [], env: [], newFile: [], mountedSecrets: [], exec: [] };

    const fakeDag = {
      container() {
        const builder = {
          from(image: string) {
            calls.from.push(image);
            return builder;
          },
          withEnvVariable(key: string, value: string) {
            calls.env.push({ key, value });
            return builder;
          },
          withNewFile(path: string, contents: string) {
            calls.newFile.push({ path, contents });
            return builder;
          },
          withMountedSecret(path: string, ref: unknown) {
            calls.mountedSecrets.push({ path, ref });
            return builder;
          },
          withExec(args: string[]) {
            calls.exec.push(args);
            return builder;
          },
        };
        return builder;
      },
    };

    jiraIssueCountCapability.factory(
      fakeDag,
      {
        ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
        config: { host: 'https://example.atlassian.net', authMode: 'basic' },
        secretRefs: { jiraEmail: '/secrets/JIRA_EMAIL', jiraApiToken: '/secrets/JIRA_API_TOKEN' },
      },
      { jql: 'project = HSP' }
    );

    expect(calls.from[0]).toContain('node:');
    const inputJson = calls.env.find((e) => e.key === 'INPUT_JSON')?.value;
    expect(inputJson).toContain('/rest/api/3/search/approximate-count');
    expect(calls.newFile.some((f) => f.path === '/opt/jira-runtime.cjs')).toBe(true);
    expect(calls.mountedSecrets.some((s) => s.path === '/run/secrets/jira_email')).toBe(true);
    expect(calls.mountedSecrets.some((s) => s.path === '/run/secrets/jira_api_token')).toBe(true);
    expect(calls.exec).toEqual([['node', '/opt/jira-runtime.cjs']]);
  });

  it('maps HTTP-like errors to OCS error categories', () => {
    expect(jiraIssueCountCapability.operations.errorMap({ status: 401 })).toBe('AUTH_FAILURE');
    expect(jiraIssueCountCapability.operations.errorMap({ status: 403 })).toBe('AUTH_FAILURE');
    expect(jiraIssueCountCapability.operations.errorMap({ status: 429 })).toBe('RATE_LIMIT');
    expect(jiraIssueCountCapability.operations.errorMap({ status: 500 })).toBe('RETRYABLE');
    expect(jiraIssueCountCapability.operations.errorMap({ status: 400 })).toBe('FATAL');
  });
});

