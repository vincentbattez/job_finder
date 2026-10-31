import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// A path of Job Finder only, never another site nor a protocol-relative URL (`//host`)
const LOCAL_PATH_PATTERN = /^\/(?![/\\])/;

// The outcome selector posts here, then the page it was on shows the new status: an Application row
// sends its own in returnTo, else the Posting page; a refusal goes back to the selector
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    await ACTIONS.changeStatus({ reference: params.reference, status: formData.get('status') });
    const returnTo = formData.get('returnTo');
    return redirect(
      typeof returnTo === 'string' && LOCAL_PATH_PATTERN.test(returnTo)
        ? returnTo
        : `/postings/${String(params.reference)}`,
    );
  });
}
