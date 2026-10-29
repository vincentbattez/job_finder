import type { ActionFunctionArgs } from 'react-router';

import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';

// The launch buttons of the fiche of an Offre post here, like jf run: the job of the module is
// queued, and the worker runs it (ADR-0003). A refusal goes back to the button, in the words of the
// action.
export async function action({ request }: ActionFunctionArgs) {
  try {
    await ACTIONS.runModule(Object.fromEntries(await request.formData()));
    return { error: null };
  } catch (error) {
    return { error: messageOf(error) };
  }
}
