import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// Like jf run, it only queues the job (ADR-0003), with the Inputs the generation panel checked; a refusal
// goes back to the button
export function action({ request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    const inputKeyList = formData.getAll('input');
    await ACTIONS.runModule({
      ...Object.fromEntries(formData),
      inputKeyList: inputKeyList.length === 0 ? undefined : inputKeyList,
    });
    return { error: null };
  });
}
