import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';
import { EXTENSION_NAME, STORE_NAME } from './src/extension';

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: STORE_NAME,
    description: 'Summarizes YouTube videos with Claude: the key points, what to skip, and the time it saves.',
    permissions: ['storage'],
    host_permissions: ['https://api.anthropic.com/*'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: `${EXTENSION_NAME}@pigfox.com`,
          // The transcript (page content) is sent to Anthropic with the user's own key.
          data_collection_permissions: { required: ['websiteContent'] },
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
