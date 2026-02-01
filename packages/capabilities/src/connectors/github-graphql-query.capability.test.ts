/**
 * packages/capabilities/src/connectors/github-graphql-query.capability.test.ts
 * TCS-001 contract verification for generated capability.
 */
import { describe, it, expect } from 'vitest';
import { githubGraphqlQueryCapability } from './github-graphql-query.capability.js';

describe('githubGraphqlQueryCapability', () => {
  it('validates aiHints examples against schemas', () => {
    expect(() => githubGraphqlQueryCapability.schemas.input.parse(githubGraphqlQueryCapability.aiHints.exampleInput)).not.toThrow();
    expect(() => githubGraphqlQueryCapability.schemas.output.parse(githubGraphqlQueryCapability.aiHints.exampleOutput)).not.toThrow();
  });

  it('requires GITHUB_TOKEN for factory', () => {
    const prev = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      expect(() =>
        githubGraphqlQueryCapability.factory(
          {},
          // ctx/config/secretRefs are not used in local-dev auth mode
          { ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' }, config: {}, secretRefs: {} },
          githubGraphqlQueryCapability.schemas.input.parse(githubGraphqlQueryCapability.aiHints.exampleInput)
        )
      ).toThrow(/GITHUB_TOKEN/i);
    } finally {
      if (prev !== undefined) process.env.GITHUB_TOKEN = prev;
    }
  });

  it('builds a Dagger container that receives INPUT_JSON and GITHUB_TOKEN', () => {
    const prev = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'test-token';
    try {
      const calls: { env: Array<{ key: string; value: string }>; exec: string[][]; from: string[] } = {
        env: [],
        exec: [],
        from: [],
      };
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
            withExec(args: string[]) {
              calls.exec.push(args);
              return builder;
            },
          };
          return builder;
        },
      };

      githubGraphqlQueryCapability.factory(
        fakeDag,
        { ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' }, config: {}, secretRefs: {} },
        githubGraphqlQueryCapability.schemas.input.parse(githubGraphqlQueryCapability.aiHints.exampleInput)
      );

      expect(calls.from[0]).toContain('node:');
      expect(calls.env.some((e) => e.key === 'GITHUB_TOKEN' && e.value === 'test-token')).toBe(true);
      expect(calls.env.some((e) => e.key === 'INPUT_JSON' && e.value.includes('"query"'))).toBe(true);
      expect(calls.exec.length).toBe(1);
    } finally {
      if (prev !== undefined) process.env.GITHUB_TOKEN = prev;
      else delete process.env.GITHUB_TOKEN;
    }
  });
});
