import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';

// A Fiche de poste dropped on the Offres posts here: the same action as jf import, for the
// Candidat of the menu. A refusal goes back to the drop zone, in the words of the action.
export async function action({ request }: ActionFunctionArgs) {
  const { candidat } = await readCandidat(request);
  try {
    const offre = await ACTIONS.importFicheDePoste({
      ...Object.fromEntries(await request.formData()),
      candidatId: candidat?.id,
    });
    return { offre, error: null };
  } catch (error) {
    return { offre: null, error: error instanceof Error ? error.message : String(error) };
  }
}
