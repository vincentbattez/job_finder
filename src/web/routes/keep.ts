import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// Keeping a New Posting posts here through a fetcher, from its row or its page (ADR-0018): it moves To
// Apply and its Research is queued; the fetcher revalidates the page it is on, a refusal goes back to it
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    await ACTIONS.keep({ reference: params.reference });
    return null;
  });
}
