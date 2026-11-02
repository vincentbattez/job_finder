// First of all: app.css declares the order of the cascade layers, which the first @layer to appear
// sets, and the POC components imported below bring their own CSS into the poc layer
import './app.css';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
  type LoaderFunctionArgs,
} from 'react-router';

import { ACTIONS } from './acl/actions.server.ts';
import { readCandidate } from './candidate.server.ts';
import { AppSidebar } from './components/app-sidebar.tsx';
import { PageHeader } from './components/page-header.tsx';
import { SidebarInset, SidebarProvider } from './components/ui/sidebar.tsx';
import { Toaster } from './components/ui/sonner.tsx';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import { useIsHydrated } from './components/use-is-hydrated.ts';
import { CandidateSwitcher } from './containers/candidate-switcher.tsx';
import { LocaleSwitcher } from './containers/locale-switcher.tsx';
import { isLoaderFailure } from './failure.ts';
import { LocaleProvider, useLocale } from './i18n.tsx';
import { englishUrlOf } from './redirects.ts';
import { relayLoader } from './relay-action.server.ts';

// An English route reached with the French query of an older link moves for good to the English one.
// Otherwise the switcher's Candidates, the locale the whole page renders in (ADR-0012) and the count of
// New Postings left to sort, the Sidebar's badge, which every mutation's revalidation refreshes.
export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const englishUrl = englishUrlOf(new URL(request.url));
    if (englishUrl !== null) {
      return redirect(englishUrl, 301);
    }
    const candidateData = await readCandidate(request);
    const { candidate } = candidateData;
    const newItemList = candidate === null ? [] : await ACTIONS.listNew({ candidateId: candidate.id });
    return { ...candidateData, newCount: newItemList.length };
  });
}

// Every page, the error page included, renders in the request's locale
export function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <LocaleProvider>
      <Page>{children}</Page>
    </LocaleProvider>
  );
}

// The V1 shell (ADR-0017, DESIGN.md « Layout »): the Sidebar beside the page, the theme next-themes
// keeps on <html>, and the toasts that end every mutation
function Page({ children }: Readonly<{ children: ReactNode }>) {
  // Undefined when the root loader itself failed: the error page then shows without the switcher
  const candidateData = useRouteLoaderData<typeof loader>('root');
  const locale = useLocale();
  // Tells when React runs the page: a click or a form sent before may go nowhere, so an e2e test waits
  // for it (e2e/candidate.ts)
  const isHydrated = useIsHydrated();
  return (
    // next-themes sets the theme's class on <html> before React hydrates it
    <html lang={locale} data-hydrated={isHydrated || undefined} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            <SidebarProvider>
              <AppSidebar
                candidateSwitcher={candidateData !== undefined && <CandidateSwitcher {...candidateData} />}
                localeSwitcher={<LocaleSwitcher />}
                newCount={candidateData?.newCount ?? 0}
              />
              <SidebarInset className="min-w-0">{children}</SidebarInset>
            </SidebarProvider>
            <Toaster position="bottom-right" closeButton />
          </TooltipProvider>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// A loader's failure shows its code and its message, which says what to do, in the Candidate's
// locale (relayLoader): the front, on the LAN or WireGuard only, has nothing to hide (ADR-0002,
// ADR-0015). Any other one, such as a render's, shows the hint, never a raw message.
export function ErrorBoundary({ error }: Readonly<{ error: unknown }>) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const failure = isRouteErrorResponse(error) && isLoaderFailure(error.data) ? error.data : null;
  const { t } = useTranslation('settings');
  return (
    <main>
      <PageHeader title={isNotFound ? t('layout.notFoundHeading') : t('layout.errorHeading')} />
      <div className="mx-auto grid max-w-2xl gap-2 p-4 sm:p-6 lg:p-8">
        {failure === null ? (
          <p>{isNotFound ? t('layout.notFoundHint') : t('layout.errorHint')}</p>
        ) : (
          <>
            <p role="alert">{failure.message}</p>
            <p className="text-muted-foreground">{t('layout.errorCode', { errorCode: failure.errorCode })}</p>
          </>
        )}
      </div>
    </main>
  );
}
