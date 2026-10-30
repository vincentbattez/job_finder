import type { ActionFunctionArgs } from 'react-router';

import { codedErrorOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';

// Like jf run, it only queues the job (ADR-0003); a refusal goes back to the button
export async function action({ request }: ActionFunctionArgs) {
  try {
    await ACTIONS.runModule(Object.fromEntries(await request.formData()));
    return { error: null };
  } catch (error) {
    return { error: codedErrorOf(error).message };
  }
}
