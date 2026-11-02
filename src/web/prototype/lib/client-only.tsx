// PROTOTYPE. What only runs in the browser (MDXEditor, Mermaid, Leaflet) renders after hydration: the
// server and the first client render show the fallback, so they agree
import type { ReactNode } from 'react';

import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';

export function ClientOnly({ children, fallback = null }: { children: () => ReactNode; fallback?: ReactNode }) {
  return useIsHydrated() ? children() : fallback;
}
