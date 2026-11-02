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
  // The shell's shadcn components (ADR-0017) bring their own: radix-ui and the rest, listed the same way.
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
      '@mdx-js/mdx',
      'mermaid',
      'cmdk',
      'vaul',
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
