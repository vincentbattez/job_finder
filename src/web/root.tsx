import type { ReactNode } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type LinksFunction,
} from 'react-router';

import './app.css';

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=DM+Mono&family=Instrument+Sans:wght@400;500&family=Schibsted+Grotesk:wght@700&display=swap',
  },
];

export function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="topbar">
          <div className="container">
            <span className="wordmark">Job Finder</span>
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
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{isNotFound ? 'Page introuvable' : 'Cette page n’a pas pu s’afficher'}</h1>
        <p>
          {isNotFound
            ? 'Cette adresse ne mène à aucune page du front.'
            : 'Rechargez la page. Si l’erreur revient, les journaux du front disent ce qui a échoué.'}
        </p>
      </div>
    </main>
  );
}
