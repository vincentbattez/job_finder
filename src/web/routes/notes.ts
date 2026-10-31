import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The Notes form of the Posting page posts here, whatever the Status, then the page shows the saved
// Notes; a refusal goes back to the form, which keeps what was typed
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    await ACTIONS.saveNotes({ reference: params.reference, notes: formData.get('notes') });
    return redirect(`/postings/${String(params.reference)}`);
  });
}
