import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The editor of a file of the Chosen Version posts here, then the Posting page shows the saved text; a
// refusal goes back to the editor, which keeps what was typed
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    await ACTIONS.saveDocument({ ...Object.fromEntries(await request.formData()), ...params });
    return redirect(`/postings/${String(params.reference)}`);
  });
}
