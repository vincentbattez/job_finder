import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// Like jf run, it only queues the job (ADR-0003); a refusal goes back to the button
export function action({ request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    await ACTIONS.runModule(Object.fromEntries(await request.formData()));
    return { error: null };
  });
}
