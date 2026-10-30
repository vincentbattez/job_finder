import type { ActionFunctionArgs } from 'react-router';

import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';
import { PARAMETRE_FIELD_PREFIX } from '#/web/components/canal-notification.tsx';

// The buttons of a Veille in the Profil, for the Candidat of the menu; each answers its own fetcher, a
// refusal in the words of the action. A list Paramètre comes one value per line, as its descriptor says.
export async function action({ request }: ActionFunctionArgs) {
  const { candidat } = await readCandidat(request);
  const formData = await request.formData();
  const sourceId = formData.get('source');
  const sourceList = await ACTIONS.listSources();
  const listNameSet = new Set(
    sourceList
      .find(({ id }) => id === sourceId)
      ?.parametreList.filter(({ type }) => type === 'list')
      .map(({ name }) => name),
  );
  const parametres = Object.fromEntries(
    [...formData]
      .filter(([name]) => name.startsWith(PARAMETRE_FIELD_PREFIX))
      .map(([fieldName, value]) => {
        const name = fieldName.slice(PARAMETRE_FIELD_PREFIX.length);
        const text = typeof value === 'string' ? value.trim() : '';
        return [name, listNameSet.has(name) ? text.split('\n').map((line) => line.trim()) : text];
      }),
  );
  const input = {
    candidatId: candidat?.id,
    veilleId: formData.get('veilleId') ?? undefined,
    source: sourceId,
    parametres,
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
