import type { ActionFunctionArgs } from 'react-router';

import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';

// For the Candidat of the menu; a refusal goes back to the drop zone in the words of the action
export async function action({ request }: ActionFunctionArgs) {
  const { candidat } = await readCandidat(request);
  try {
    const job = await ACTIONS.importFicheDePoste({
      ...Object.fromEntries(await request.formData()),
      candidatId: candidat?.id,
    });
    return { job, error: null };
  } catch (error) {
    return { job: null, error: messageOf(error) };
  }
}
