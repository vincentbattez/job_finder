import { generatePath, matchPath, redirect, type LoaderFunctionArgs } from 'react-router';

import { REDIRECT_LIST } from '#/web/redirects.ts';

// The English route of a French path, null when the table has none
function englishPathOf(pathname: string): string | null {
  for (const { from, to } of REDIRECT_LIST) {
    const match = matchPath(`/${from}`, pathname);
    if (match !== null) {
      return generatePath(`/${to}`, match.params);
    }
  }
  return null;
}

// Every French route of the redirect table lands here and moves for good to its English one, its
// query kept; only the table routes here, so a path without an English one is not expected
export function loader({ request }: LoaderFunctionArgs) {
  const { pathname, search } = new URL(request.url);
  return redirect((englishPathOf(pathname) ?? '/') + search, 301);
}
