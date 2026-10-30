// First of all: app.css declares the order of the cascade layers, which the first @layer to appear
// sets, and the components imported below bring their own CSS
import './app.css';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
  type LinksFunction,
  type LoaderFunctionArgs,
} from 'react-router';

import { readCandidate } from './candidate.server.ts';
import { CandidateMenu } from './components/candidate-menu.tsx';
import { LocaleSwitcher } from './components/locale-switcher.tsx';
import { LocaleProvider, useLocale } from './i18n.tsx';
import { englishUrlOf } from './redirects.ts';

import './legacy-components.css';

// An English route reached with the French query of an older link moves for good to the English one.
// Otherwise the menu's Candidates and the locale the whole page renders in (ADR-0012).
export function loader({ request }: LoaderFunctionArgs) {
  const englishUrl = englishUrlOf(new URL(request.url));
  return englishUrl === null ? readCandidate(request) : redirect(englishUrl, 301);
}

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=DM+Mono&family=Instrument+Sans:wght@400;500&family=Schibsted+Grotesk:wght@700&display=swap',
  },
];

// Every page, the error page included, renders in the request's locale
export function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <LocaleProvider>
      <Page>{children}</Page>
    </LocaleProvider>
  );
}

function Page({ children }: Readonly<{ children: ReactNode }>) {
  // Undefined when the root loader itself failed: the error page then shows without the menu
  const candidateData = useRouteLoaderData<typeof loader>('root');
  const locale = useLocale();
  const { t } = useTranslation('settings');
  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="topbar">
          <div className="container">
            <Link to="/" className="wordmark">
              Job Finder
            </Link>
            <nav className="topbar__nav" aria-label={t('layout.navigationLabel')}>
              <NavLink to="/" end>
                {t('layout.postingsLink')}
              </NavLink>
              <NavLink to="/profile">{t('layout.profileLink')}</NavLink>
              <NavLink to="/instructions">{t('layout.instructionsLink')}</NavLink>
              <NavLink to="/candidates">{t('layout.candidatesLink')}</NavLink>
            </nav>
            <div className="topbar__end">
              {candidateData !== undefined && <CandidateMenu {...candidateData} />}
              <LocaleSwitcher />
            </div>
          </div>
        </header>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Readonly<{ error: unknown }>) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const { t } = useTranslation('settings');
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{isNotFound ? t('layout.notFoundHeading') : t('layout.errorHeading')}</h1>
        <p>{isNotFound ? t('layout.notFoundHint') : t('layout.errorHint')}</p>
      </div>
    </main>
  );
}
