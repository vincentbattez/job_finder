import type { ReactNode } from 'react';
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
import { useCatalogue, useLocale } from './catalogue.ts';
import { CandidateMenu } from './components/candidate-menu.tsx';
import { englishUrlOf } from './redirects.ts';

import './app.css';

// An English route reached with the French query of an older link moves for good to the English one
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

export function Layout({ children }: Readonly<{ children: ReactNode }>) {
  // Undefined when the root loader itself failed: the error page then shows without the menu
  const candidateData = useRouteLoaderData<typeof loader>('root');
  const locale = useLocale();
  const { layout } = useCatalogue().settings;
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
            <nav className="topbar__nav" aria-label={layout.navigationLabel}>
              <NavLink to="/" end>
                {layout.postingsLink}
              </NavLink>
              <NavLink to="/profile">{layout.profileLink}</NavLink>
              <NavLink to="/instructions">{layout.instructionsLink}</NavLink>
              <NavLink to="/candidates">{layout.candidatesLink}</NavLink>
            </nav>
            {candidateData !== undefined && <CandidateMenu {...candidateData} />}
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
  const { layout } = useCatalogue().settings;
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{isNotFound ? layout.notFoundHeading : layout.errorHeading}</h1>
        <p>{isNotFound ? layout.notFoundHint : layout.errorHint}</p>
      </div>
    </main>
  );
}
