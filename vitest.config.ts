import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          environment: 'node',
          include: ['packages/*/tests/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'extensions',
          environment: 'happy-dom',
          include: ['extensions/*/tests/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/shared/src/**/*.ts', 'extensions/*/src/**/*.ts', 'extensions/*/entrypoints/**/*.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
