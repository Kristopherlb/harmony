import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      // Exact-match aliases to avoid prefix collisions (e.g. @golden/core vs @golden/core/workflow).
      { find: /^@golden\/core\/workflow$/, replacement: path.resolve(__dirname, '../../core/src/wcs/workflow.ts') },
      { find: /^@golden\/core$/, replacement: path.resolve(__dirname, '../../core/index.ts') },
      { find: /^@golden\/schema-registry$/, replacement: path.resolve(__dirname, '../../schema-registry/index.ts') },
      { find: /^@golden\/capabilities$/, replacement: path.resolve(__dirname, '../../capabilities/index.ts') },
      { find: /^@golden\/blueprints$/, replacement: path.resolve(__dirname, '../../blueprints/index.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
  },
});

