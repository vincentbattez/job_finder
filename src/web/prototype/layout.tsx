// PROTOTYPE (branch prototype/v1-ux, never merged). The layout of every /prototype route: it loads the
// snapshot once (data.server.ts), then holds the theme, the tooltips, the stub store, the toasts and
// the dock of the variant switchers. Its loader runs again only on an explicit revalidate (a Candidate
// switch), never when a ?variant= or ?panel= changes.
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import {
  isRouteErrorResponse,
  Link,
  Outlet,
  useLoaderData,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Toaster } from '#/web/prototype/components/ui/sonner.tsx';
import { TooltipProvider } from '#/web/prototype/components/ui/tooltip.tsx';

import { loadPrototype } from './data.server.ts';
import { PrototypeSwitcherDock } from './prototype-switcher.tsx';
import { PrototypeStoreProvider } from './store.ts';

export function loader({ request }: LoaderFunctionArgs) {
  return loadPrototype(request);
}

export function shouldRevalidate({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  return currentUrl.href === nextUrl.href;
}

export function meta() {
  return [{ title: 'Job Finder · prototype V1' }];
}

// No favicon request, so no 404 in the console
export function links() {
  return [{ rel: 'icon', href: 'data:,' }];
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}

export default function PrototypeLayout() {
  const data = useLoaderData<typeof loader>();
  return (
    <Providers>
      <PrototypeStoreProvider data={data}>
        <Outlet />
        <Toaster position="bottom-right" closeButton />
        <PrototypeSwitcherDock />
      </PrototypeStoreProvider>
    </Providers>
  );
}

// A failure of the prototype itself, in its own theme rather than the old front's
export function ErrorBoundary({ error }: { error: unknown }) {
  const message = isRouteErrorResponse(error)
    ? `${String(error.status)} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);
  return (
    <Providers>
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Le prototype a échoué</h1>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{message}</pre>
        <Button asChild variant="outline" className="self-start">
          <Link to="/prototype/new">Revenir aux Nouvelles</Link>
        </Button>
      </main>
    </Providers>
  );
}
