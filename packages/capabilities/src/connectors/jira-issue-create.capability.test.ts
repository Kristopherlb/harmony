/**
 * packages/capabilities/src/connectors/jira-issue-create.capability.test.ts
 * TCS-001 contract verification + connector container-shape tests.
 */
import { describe, it, expect } from 'vitest';
import { jiraIssueCreateCapability } from './jira-issue-create.capability.js';

describe('jiraIssueCreateCapability', () => {
  it('validates aiHints examples against schemas', () => {
    expect(() =>
      jiraIssueCreateCapability.schemas.input.parse(jiraIssueCreateCapability.aiHints.exampleInput)
    ).not.toThrow();
    expect(() =>
      jiraIssueCreateCapability.schemas.output.parse(jiraIssueCreateCapability.aiHints.exampleOutput)
    ).not.toThrow();
  });

  it('builds a Dagger container that calls Jira /rest/api/3/issue (POST)', () => {
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

    jiraIssueCreateCapability.factory(
      fakeDag,
      {
        ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
        config: { host: 'https://example.atlassian.net', authMode: 'oauth2' },
        secretRefs: { jiraAccessToken: '/secrets/JIRA_ACCESS_TOKEN' },
      },
      {
        projectKey: 'HSP',
        issueType: 'Task',
        summary: 'Investigate elevated 500s',
        description: 'Triage: correlate spike with deploy',
      }
    );

    const inputJson = calls.env.find((e) => e.key === 'INPUT_JSON')?.value ?? '';
    expect(inputJson).toContain('"/rest/api/3/issue"');
    expect(inputJson).toContain('"method":"POST"');
    expect(calls.newFile.some((f) => f.path === '/opt/jira-runtime.cjs')).toBe(true);
    expect(calls.mountedSecrets.some((s) => s.path === '/run/secrets/jira_access_token')).toBe(true);
    expect(calls.exec).toEqual([['node', '/opt/jira-runtime.cjs']]);
  });

  it('maps HTTP-like errors to OCS error categories', () => {
    expect(jiraIssueCreateCapability.operations.errorMap({ status: 401 })).toBe('AUTH_FAILURE');
    expect(jiraIssueCreateCapability.operations.errorMap({ status: 429 })).toBe('RATE_LIMIT');
    expect(jiraIssueCreateCapability.operations.errorMap({ status: 500 })).toBe('RETRYABLE');
    expect(jiraIssueCreateCapability.operations.errorMap({ status: 400 })).toBe('FATAL');
  });
});

