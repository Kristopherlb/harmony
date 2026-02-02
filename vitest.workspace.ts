import { defineWorkspace } from 'vitest/config';
import path from 'node:path';

export default defineWorkspace([
  // Use explicit config globs to avoid treating `packages/tools/` (a monorepo folder)
  // as a Vitest project and double-running nested tests with incorrect module aliases.
  'packages/*/vitest.config.ts',
  'packages/*/*/vitest.config.ts',
  // apps/console pins a different Vitest major; run its tests via the workspace "unit" config instead.
  '!packages/apps/console/vitest.config.ts',
  {
    resolve: {
      alias: [
        { find: /^@golden\/core\/workflow$/, replacement: path.resolve(__dirname, 'packages/core/src/wcs/workflow.ts') },
        { find: /^@golden\/core$/, replacement: path.resolve(__dirname, 'packages/core/index.ts') },
        { find: /^@golden\/schema-registry$/, replacement: path.resolve(__dirname, 'packages/schema-registry/index.ts') },
        { find: /^@golden\/capabilities$/, replacement: path.resolve(__dirname, 'packages/capabilities/index.ts') },
        { find: /^@golden\/blueprints$/, replacement: path.resolve(__dirname, 'packages/blueprints/index.ts') },
        { find: /^@golden\/mcp-server$/, replacement: path.resolve(__dirname, 'packages/tools/mcp-server/index.ts') },
      ],
    },
    test: {
      name: 'unit',
      environment: 'node',
      include: ['**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
  },
]);
