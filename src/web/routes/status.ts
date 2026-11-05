import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// A path of Job Finder only, never another site nor a protocol-relative URL (`//host`)
const LOCAL_PATH_PATTERN = /^\/(?![/\\])/;

// The Status changes post here: an Application row sends its page in returnTo, which a plain form
// comes back to; the Posting page posts through a fetcher, which revalidates it in its tab. A refusal
// goes back to what posted it.
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    // Marking Applied may settle the Letter first, so the Letter sent is the one recorded
    await ACTIONS.changeStatus({
      reference: params.reference,
      status: formData.get('status'),
      letterNumber: formData.get('letterNumber') ?? undefined,
      isWithoutLetter: formData.get('isWithoutLetter') ?? undefined,
    });
    const returnTo = formData.get('returnTo');
    return typeof returnTo === 'string' && LOCAL_PATH_PATTERN.test(returnTo) ? redirect(returnTo) : null;
  });
}
