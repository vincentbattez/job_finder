import type { ActionFunctionArgs } from 'react-router';

import { messageOf, type Actions } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';
import { readParametres } from '#/web/parametres.server.ts';

type ParametreChoice = Awaited<ReturnType<Actions['listParametreChoices']>>[number];

function answer(message: string, choiceList: ParametreChoice[] | null = null) {
  return { message, error: null, choiceList };
}

function refuse(error: string) {
  return { message: null, error, choiceList: null };
}

// The buttons of the Notifications section of the Profil, for the Candidat of the menu; each answers
// its own fetcher, a refusal in the words of the action. No secret Paramètre comes back (ADR-0006).
export async function action({ request }: ActionFunctionArgs) {
  const { candidat } = await readCandidat(request);
  const formData = await request.formData();
  const moduleId = formData.get('canal');
  const moduleList = await ACTIONS.listCanauxNotification();
  const input = {
    candidatId: candidat?.id,
    canal: moduleId ?? undefined,
    parametre: formData.get('parametre') ?? undefined,
    parametres: readParametres(formData, moduleList.find(({ id }) => id === moduleId)?.parametreList),
  };
  try {
    switch (formData.get('intent')) {
      case 'save': {
        await ACTIONS.saveCanalNotification(input);
        return answer('Canal de notification enregistré.');
      }
      case 'test': {
        await ACTIONS.testCanalNotification(input);
        return answer('Le Canal de notification répond.');
      }
      case 'choices': {
        const choiceList = await ACTIONS.listParametreChoices(input);
        return answer(`${String(choiceList.length)} choix trouvés.`, choiceList);
      }
      case 'notify': {
        await ACTIONS.sendTestNotification(input);
        return answer('Notification de test envoyée : regardez votre téléphone.');
      }
    }
  } catch (error) {
    return refuse(messageOf(error));
  }
  return refuse('Ce bouton ne fait rien : recharger la page.');
}
