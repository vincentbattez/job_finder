import type { ActionFunctionArgs } from 'react-router';

import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';

// A Fiche de poste dropped on the Offres posts here: the same action as jf import, for the
// Candidat of the menu. It only queues the extraction, which the worker runs (ADR-0003). A refusal
// goes back to the drop zone, in the words of the action.
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
