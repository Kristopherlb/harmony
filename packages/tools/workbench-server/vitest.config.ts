import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
    deps: {
      // Workspace packages use TS source with .js specifiers; inline to avoid stale pre-bundling.
      inline: ['@golden/core', '@golden/schema-registry'],
    },
  },
});

