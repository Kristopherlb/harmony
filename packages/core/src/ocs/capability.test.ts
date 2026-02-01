/**
 * packages/core/src/ocs/capability.test.ts
 * TDD: Capability interface and context passed to factory.
 */
import { describe, it, expect } from 'vitest';
import { z } from '@golden/schema-registry';
import type { Capability } from './capability';
import type { GoldenContext } from '../context/golden-context';
import type { CapabilityContext } from '../types';

describe('Capability', () => {
  const ctx: GoldenContext = {
    app_id: 'app',
    environment: 'dev',
    initiator_id: 'user:1',
    trace_id: 't1',
  };

  it('minimal implementation satisfies interface and factory receives context with ctx', () => {
    const cap: Capability<{ x: number }, { y: number }, { timeout: number }, { apiKey: string }> = {
      metadata: {
        id: 'test.echo',
        version: '1.0.0',
        name: 'Echo',
        description: 'Echo',
        tags: [],
        maintainer: 'team',
      },
      schemas: {
        input: z.object({ x: z.number() }),
        output: z.object({ y: z.number() }),
        config: z.object({ timeout: z.number() }),
        secrets: z.object({ apiKey: z.string() }),
      },
      security: {
        requiredScopes: [],
        dataClassification: 'PUBLIC',
        networkAccess: { allowOutbound: [] },
      },
      operations: {
        isIdempotent: true,
        retryPolicy: {
          maxAttempts: 3,
          initialIntervalSeconds: 1,
          backoffCoefficient: 2,
        },
        errorMap: () => 'FATAL',
        costFactor: 'LOW',
      },
      aiHints: {
        exampleInput: { x: 1 },
        exampleOutput: { y: 1 },
      },
      factory: (_dag, context, input) => {
        expect(context.ctx).toEqual(ctx);
        expect(context.config).toEqual({ timeout: 5000 });
        expect(context.secretRefs).toEqual({ apiKey: '/path/to/secret' });
        expect(input).toEqual({ x: 42 });
        return {} as ReturnType<Capability['factory']>;
      },
    };

    const capabilityContext: CapabilityContext<{ timeout: number }, { apiKey: string }> = {
      ctx,
      config: { timeout: 5000 },
      secretRefs: { apiKey: '/path/to/secret' },
    };
    cap.factory(null as unknown, capabilityContext, { x: 42 });
  });
});
