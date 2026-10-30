import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The button that chooses a Version posts here, then the Posting page shows the new Chosen Version; a
// refusal goes back to the button
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    await ACTIONS.chooseVersion({ ...Object.fromEntries(await request.formData()), ...params });
    return redirect(`/postings/${String(params.reference)}`);
  });
}
