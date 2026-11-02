import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The Notes form posts here through a fetcher, whatever the Status, which revalidates the page it is on;
// a refusal goes back to the form, which keeps what was typed
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    await ACTIONS.saveNotes({ reference: params.reference, notes: formData.get('notes') });
    return null;
  });
}
