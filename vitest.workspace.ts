import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  {
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
