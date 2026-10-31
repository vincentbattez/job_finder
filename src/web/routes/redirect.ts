import { redirect, type LoaderFunctionArgs } from 'react-router';

import { englishUrlOf } from '#/web/redirects.ts';
import { relayLoader } from '#/web/relay-action.server.ts';

// Every French route of the redirect table lands here and moves for good to its English one, its
// query kept; only the table routes here, so a path without an English one is not expected
export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, () => redirect(englishUrlOf(new URL(request.url)) ?? '/', 301));
}
