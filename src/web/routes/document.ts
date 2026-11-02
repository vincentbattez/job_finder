import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The editor of a file of the Chosen Version posts here through a fetcher, which revalidates the page in
// its tab; a refusal goes back to the editor, which keeps what was typed
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    await ACTIONS.saveDocument({ ...Object.fromEntries(await request.formData()), ...params });
    return null;
  });
}
