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

  it('declares explicit allowOutbound for GitHub API', () => {
    expect(githubGraphqlQueryCapability.security.networkAccess.allowOutbound).toContain('api.github.com');
  });

  it('mounts token as a secret (no plaintext env token)', () => {
    const calls: {
      env: Array<{ key: string; value: string }>;
      mounted: Array<{ path: string; secret: unknown }>;
      exec: string[][];
      from: string[];
    } = { env: [], mounted: [], exec: [], from: [] };

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
          withMountedSecret(path: string, secret: unknown) {
            calls.mounted.push({ path, secret });
            return builder;
          },
          withNewFile(_path: string, _contents: string) {
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

    const tokenSecret = { __dagger_secret__: 'github-token' };
    githubGraphqlQueryCapability.factory(
      fakeDag as any,
      { ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' }, config: {}, secretRefs: { token: tokenSecret } } as any,
      githubGraphqlQueryCapability.schemas.input.parse(githubGraphqlQueryCapability.aiHints.exampleInput)
    );

    expect(calls.from[0]).toContain('node:');
    expect(calls.env.some((e) => e.key === 'INPUT_JSON' && e.value.includes('"query"'))).toBe(true);
    expect(calls.mounted).toEqual([{ path: '/run/secrets/github_token', secret: tokenSecret }]);
    expect(calls.env.some((e) => e.key === 'GITHUB_TOKEN')).toBe(false);
    expect(calls.exec.length).toBe(1);
  });
});
