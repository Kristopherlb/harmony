import { describe, it, expect } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import contextExtensionGenerator from './entry';

function minimalGoldenContextSource() {
  return `import { z } from '@golden/schema-registry';

export const goldenContextSchema = z.object({
  app_id: z.string(),
});

export type GoldenContext = z.infer<typeof goldenContextSchema>;

export function parseGoldenContext(input: unknown): GoldenContext {
  return goldenContextSchema.parse(input) as GoldenContext;
}
`;
}

function minimalGoldenContextSourceWeirdFormatting() {
  return `import { z } from '@golden/schema-registry';

// formatting intentionally odd to ensure generator is structure-aware
export const goldenContextSchema=z.object({app_id:z.string()}).passthrough();
export type GoldenContext = z.infer<typeof goldenContextSchema>;
`;
}

function minimalGoldenSpanSource() {
  return `import type { GoldenContext } from '../context/golden-context.js';

export const GOLDEN_ATTRIBUTES = {
  APP_ID: 'golden.app_id',
} as const;

export function getGoldenSpanAttributes(ctx: GoldenContext): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {
    [GOLDEN_ATTRIBUTES.APP_ID]: ctx.app_id,
  };
  return attrs;
}
`;
}

function minimalGoldenSpanSourceWeirdFormatting() {
  return `import type { GoldenContext } from '../context/golden-context.js';

// formatting intentionally odd to ensure generator is structure-aware
export const GOLDEN_ATTRIBUTES={APP_ID:'golden.app_id'} as const;

export function getGoldenSpanAttributes(ctx: GoldenContext): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = { [GOLDEN_ATTRIBUTES.APP_ID]: ctx.app_id };
  return attrs;
}
`;
}

function minimalCoreIndexSource() {
  return `export { goldenContextSchema, parseGoldenContext, type GoldenContext } from './context/golden-context.js';\n`;
}

describe('@golden/path:context-extension', () => {
  it('extends goldenContextSchema, adds helper module, and updates exports + span attrs', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('packages/core/src/context/golden-context.ts', minimalGoldenContextSource());
    tree.write('packages/core/src/observability/golden-span.ts', minimalGoldenSpanSource());
    tree.write('packages/core/src/index.ts', minimalCoreIndexSource());

    await expect(
      contextExtensionGenerator(tree, {
        name: 'deployment',
        fields: [
          { name: 'deployment_id', type: 'string', optional: true },
          { name: 'deployment_env', type: 'string', optional: true },
        ],
      })
    ).resolves.toBeDefined();

    const goldenContext = tree.read('packages/core/src/context/golden-context.ts', 'utf-8')!;
    expect(goldenContext).toContain('deployment_id:');
    expect(goldenContext).toContain('deployment_env:');

    expect(tree.exists('packages/core/src/context/deployment-context.ts')).toBe(true);
    expect(tree.exists('packages/core/src/context/deployment-context.test.ts')).toBe(true);

    const coreIndex = tree.read('packages/core/src/index.ts', 'utf-8')!;
    expect(coreIndex).toContain("from './context/deployment-context.js'");

    const span = tree.read('packages/core/src/observability/golden-span.ts', 'utf-8')!;
    expect(span).toContain("DEPLOYMENT_ID: 'golden.deployment_id'");
    expect(span).toContain("DEPLOYMENT_ENV: 'golden.deployment_env'");
  });

  it('handles formatting variations (structure-aware edits, not string needles)', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('packages/core/src/context/golden-context.ts', minimalGoldenContextSourceWeirdFormatting());
    tree.write('packages/core/src/observability/golden-span.ts', minimalGoldenSpanSourceWeirdFormatting());
    tree.write('packages/core/src/index.ts', minimalCoreIndexSource());

    await expect(
      contextExtensionGenerator(tree, {
        name: 'deployment',
        fields: [{ name: 'deployment_id', type: 'string', optional: true }],
      })
    ).resolves.toBeDefined();

    const goldenContext = tree.read('packages/core/src/context/golden-context.ts', 'utf-8')!;
    expect(goldenContext).toContain('deployment_id:');

    const span = tree.read('packages/core/src/observability/golden-span.ts', 'utf-8')!;
    expect(span).toContain("DEPLOYMENT_ID: 'golden.deployment_id'");
  });

  it('is idempotent', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('packages/core/src/context/golden-context.ts', minimalGoldenContextSource());
    tree.write('packages/core/src/observability/golden-span.ts', minimalGoldenSpanSource());
    tree.write('packages/core/src/index.ts', minimalCoreIndexSource());

    await contextExtensionGenerator(tree, {
      name: 'deployment',
      fields: [{ name: 'deployment_id', type: 'string', optional: true }],
    });
    const once = tree.read('packages/core/src/context/golden-context.ts', 'utf-8')!;

    await contextExtensionGenerator(tree, {
      name: 'deployment',
      fields: [{ name: 'deployment_id', type: 'string', optional: true }],
    });
    const twice = tree.read('packages/core/src/context/golden-context.ts', 'utf-8')!;

    expect(twice).toBe(once);
  });
});

