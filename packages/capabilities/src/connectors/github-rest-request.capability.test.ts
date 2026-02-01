/**
 * packages/capabilities/src/connectors/github-rest-request.capability.test.ts
 * TCS-001 contract verification for generated capability.
 */
import { describe, it, expect } from 'vitest';
import { githubRestRequestCapability } from './github-rest-request.capability.js';

describe('githubRestRequestCapability', () => {
  it('validates aiHints examples against schemas', () => {
    expect(() => githubRestRequestCapability.schemas.input.parse(githubRestRequestCapability.aiHints.exampleInput)).not.toThrow();
    expect(() => githubRestRequestCapability.schemas.output.parse(githubRestRequestCapability.aiHints.exampleOutput)).not.toThrow();
  });

  it('requires GITHUB_TOKEN for factory', () => {
    const prev = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      expect(() =>
        githubRestRequestCapability.factory(
          {},
          { ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' }, config: {}, secretRefs: {} },
          githubRestRequestCapability.schemas.input.parse(githubRestRequestCapability.aiHints.exampleInput)
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

      githubRestRequestCapability.factory(
        fakeDag,
        { ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' }, config: {}, secretRefs: {} },
        githubRestRequestCapability.schemas.input.parse(githubRestRequestCapability.aiHints.exampleInput)
      );

      expect(calls.from[0]).toContain('node:');
      expect(calls.env.some((e) => e.key === 'GITHUB_TOKEN' && e.value === 'test-token')).toBe(true);
      expect(calls.env.some((e) => e.key === 'INPUT_JSON' && e.value.includes('"path"'))).toBe(true);
      expect(calls.exec.length).toBe(1);
    } finally {
      if (prev !== undefined) process.env.GITHUB_TOKEN = prev;
      else delete process.env.GITHUB_TOKEN;
    }
  });
});
