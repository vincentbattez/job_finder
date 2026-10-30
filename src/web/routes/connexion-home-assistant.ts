import type { ActionFunctionArgs } from 'react-router';

import { messageOf, type Actions } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';

type NotifyService = Awaited<ReturnType<Actions['listNotifyServices']>>[number];

function answer(message: string, serviceList: NotifyService[] | null = null) {
  return { message, error: null, serviceList };
}

function refuse(error: string) {
  return { message: null, error, serviceList: null };
}

// The buttons of the Notifications section of the Profil, for the Candidat of the menu; each answers
// its own fetcher, a refusal in the words of the action. The token never comes back (ADR-0006).
export async function action({ request }: ActionFunctionArgs) {
  const { candidat } = await readCandidat(request);
  const formData = await request.formData();
  const input = { ...Object.fromEntries(formData), candidatId: candidat?.id };
  try {
    switch (formData.get('intent')) {
      case 'save': {
        await ACTIONS.saveConnexionHomeAssistant(input);
        return answer('Connexion Home Assistant enregistrée.');
      }
      case 'test': {
        await ACTIONS.testConnexionHomeAssistant(input);
        return answer('Home Assistant répond et accepte le jeton.');
      }
      case 'services': {
        const serviceList = await ACTIONS.listNotifyServices(input);
        return answer(`${String(serviceList.length)} services de notification trouvés.`, serviceList);
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
