import path from 'node:path';

import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [reactRouter()],
  // The front is reached on the LAN by its mDNS name as well as by IP (ADR-0002)
  server: { allowedHosts: ['.local'] },
  // Vite's scan of the routes stops at the #/ imports, so it would find react-markdown only once a
  // page needs it, then reload that page mid-hydration: bundled up front instead
  optimizeDeps: { include: ['react-markdown'] },
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
