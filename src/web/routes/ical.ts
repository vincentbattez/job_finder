import type { LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayLoader } from '#/web/relay-action.server.ts';

// The iCal file of an Interview, downloaded; its links reuse the address the Candidate opened Job
// Finder through, the LAN, the VPN or a later public URL alike
export function loader({ params, request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { fileName, text } = await ACTIONS.readIcalFile({ ...params, origin: new URL(request.url).origin });
    return new Response(text, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  });
}
