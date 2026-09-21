import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';
import { EXTENSION_NAME, STORE_NAME } from './src/extension';

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: STORE_NAME,
    description: 'Placeholder — coming soon.',
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: `${EXTENSION_NAME}@pigfox.com`,
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
  zip: {
    // Sources zip for Mozilla review: everything needed to rebuild from the repo root.
    sourcesRoot: fileURLToPath(new URL('../..', import.meta.url)),
    includeSources: [
      'SOURCE_BUILD.md',
      'LICENSE',
      'package.json',
      'pnpm-workspace.yaml',
      'pnpm-lock.yaml',
      'tsconfig.base.json',
      'packages/shared/**',
      `extensions/${EXTENSION_NAME}/**`,
    ],
  },
});
