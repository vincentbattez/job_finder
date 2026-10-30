import type { ActionFunctionArgs } from 'react-router';

import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { readParametres } from '#/web/parametres.server.ts';

// The buttons of a Veille in the Profile, for the Candidate of the menu; each answers its own fetcher, a
// refusal in the words of the action. A list Paramètre comes one value per line, as its descriptor says.
export async function action({ request }: ActionFunctionArgs) {
  const { candidate } = await readCandidate(request);
  const formData = await request.formData();
  const sourceId = formData.get('source');
  const sourceList = await ACTIONS.listSources();
  const input = {
    candidateId: candidate?.id,
    veilleId: formData.get('veilleId') ?? undefined,
    source: sourceId,
    parametres: readParametres(formData, sourceList.find(({ id }) => id === sourceId)?.parametreList),
  };
  try {
    switch (formData.get('intent')) {
      case 'save': {
        await ACTIONS.saveVeille(input);
        return { message: 'Veille enregistrée.', error: null };
      }
      case 'delete': {
        await ACTIONS.deleteVeille(input);
        return { message: null, error: null };
      }
    }
  } catch (error) {
    return { message: null, error: messageOf(error) };
  }
  return { message: null, error: 'Ce bouton ne fait rien : recharger la page.' };
}
