import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // In-workspace tests should import sources, not dist outputs.
      '@golden/capabilities': path.resolve(__dirname, '../../capabilities/index.ts'),
      '@golden/blueprints': path.resolve(__dirname, '../../blueprints/index.ts'),
      '@golden/core': path.resolve(__dirname, '../../core/index.ts'),
      '@golden/core/workflow': path.resolve(__dirname, '../../core/src/wcs/workflow.ts'),
      '@golden/schema-registry': path.resolve(__dirname, '../../schema-registry/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
  },
});

