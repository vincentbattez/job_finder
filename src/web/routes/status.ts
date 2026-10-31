import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The outcome selector posts here, then the Posting page shows the new status; a refusal goes back to
// the selector
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    await ACTIONS.changeStatus({ ...Object.fromEntries(await request.formData()), ...params });
    return redirect(`/postings/${String(params.reference)}`);
  });
}
