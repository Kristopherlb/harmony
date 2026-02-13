/**
 * packages/capabilities/src/demo/secret-present.capability.test.ts
 */
import { describe, it, expect } from 'vitest';
import { secretPresentCapability } from './secret-present.capability.js';

describe('secretPresentCapability', () => {
  it('validates aiHints examples against schemas', () => {
    expect(() =>
      secretPresentCapability.schemas.input.parse(secretPresentCapability.aiHints.exampleInput)
    ).not.toThrow();
    expect(() =>
      secretPresentCapability.schemas.output.parse(secretPresentCapability.aiHints.exampleOutput)
    ).not.toThrow();
  });

  it('mounts the secret ref at a fixed path', () => {
    const calls: { mounted: Array<{ path: string; secret: unknown }>; exec: string[][]; from: string[] } =
      {
        mounted: [],
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
          withMountedSecret(path: string, secret: unknown) {
            calls.mounted.push({ path, secret });
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

    const secretObj = { __dagger_secret__: 's1' };

    secretPresentCapability.factory(
      fakeDag as any,
      { ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' }, config: {}, secretRefs: { value: secretObj } } as any,
      {}
    );

    expect(calls.from[0]).toContain('node:');
    expect(calls.mounted).toEqual([{ path: '/run/secrets/value', secret: secretObj }]);
    expect(calls.exec.length).toBe(1);
  });
});

