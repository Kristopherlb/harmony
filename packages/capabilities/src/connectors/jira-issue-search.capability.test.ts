/**
 * packages/capabilities/src/connectors/jira-issue-search.capability.test.ts
 * TCS-001 contract verification + connector container-shape tests (TDD).
 */
import { describe, it, expect } from 'vitest';
import { jiraIssueSearchCapability } from './jira-issue-search.capability.js';

describe('jiraIssueSearchCapability', () => {
  it('validates aiHints examples against schemas', () => {
    expect(() =>
      jiraIssueSearchCapability.schemas.input.parse(jiraIssueSearchCapability.aiHints.exampleInput)
    ).not.toThrow();
    expect(() =>
      jiraIssueSearchCapability.schemas.output.parse(jiraIssueSearchCapability.aiHints.exampleOutput)
    ).not.toThrow();
  });

  it('builds a Dagger container that calls Jira /rest/api/3/search/jql', () => {
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

    jiraIssueSearchCapability.factory(
      fakeDag,
      {
        ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
        config: { host: 'https://example.atlassian.net', authMode: 'oauth2' },
        secretRefs: { jiraAccessToken: '/secrets/JIRA_ACCESS_TOKEN' },
      },
      {
        jql: 'project = HSP order by updated desc',
        maxResults: 5,
        fields: ['id', 'key'],
      }
    );

    expect(calls.from[0]).toContain('node:');
    const inputJson = calls.env.find((e) => e.key === 'INPUT_JSON')?.value;
    expect(inputJson).toContain('/rest/api/3/search/jql');
    expect(calls.newFile.some((f) => f.path === '/opt/jira-runtime.cjs')).toBe(true);
    expect(calls.mountedSecrets.some((s) => s.path === '/run/secrets/jira_access_token')).toBe(true);
    expect(calls.exec).toEqual([['node', '/opt/jira-runtime.cjs']]);
  });

  it('maps HTTP-like errors to OCS error categories', () => {
    expect(jiraIssueSearchCapability.operations.errorMap({ status: 401 })).toBe('AUTH_FAILURE');
    expect(jiraIssueSearchCapability.operations.errorMap({ status: 403 })).toBe('AUTH_FAILURE');
    expect(jiraIssueSearchCapability.operations.errorMap({ status: 429 })).toBe('RATE_LIMIT');
    expect(jiraIssueSearchCapability.operations.errorMap({ status: 500 })).toBe('RETRYABLE');
    expect(jiraIssueSearchCapability.operations.errorMap({ status: 400 })).toBe('FATAL');
  });
});

