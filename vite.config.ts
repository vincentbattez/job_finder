import path from 'node:path';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), reactRouter()],
  // The front is reached on the LAN by its mDNS name as well as by IP (ADR-0002)
  server: { allowedHosts: ['.local'] },
  // Vite's scan of the routes stops at the #/ imports, so it would find these only once a page needs
  // them, then reload that page mid-hydration: bundled up front instead. The CI log of the e2e showed
  // the two i18next packages optimized on the first page of a run, which then never hydrated.
  // PROTOTYPE (branch prototype/v1-ux): every client dependency of src/web/prototype/, for the same reason
  optimizeDeps: {
    include: [
      'react-markdown',
      'remark-gfm',
      'leaflet',
      'react-i18next',
      'i18next',
      'radix-ui',
      'class-variance-authority',
      'cn',
      'lucide-react',
      'next-themes',
      'sonner',
      'vaul',
      'cmdk',
      'react-resizable-panels',
      '@mdx-js/mdx',
      '@mdxeditor/editor',
      'mermaid',
      'react/jsx-runtime',
    ],
  },
  // The e2e tests (playwright.config.ts) serve the front with the actions of test/, which fake the
  // external boundaries, whatever the path a module imports them by
  resolve: {
    alias:
      mode === 'e2e'
        ? [
            {
              find: /^.*\/acl\/actions\.server\.ts$/,
              replacement: path.join(import.meta.dirname, 'test', 'e2e-actions.server.ts'),
            },
          ]
        : [],
  },
}));
