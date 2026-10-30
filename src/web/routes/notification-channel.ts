import type { ActionFunctionArgs } from 'react-router';

import { tFor } from '#/actions/i18n.ts';
import type { Actions } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { readParameters } from '#/web/parameters.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

type ParameterChoice = Awaited<ReturnType<Actions['listParameterChoices']>>[number];

function answer(message: string, choiceList: ParameterChoice[] | null = null) {
  return { message, error: null, choiceList };
}

function refuse(error: string) {
  return { message: null, error, choiceList: null };
}

// The buttons of the Notifications section of the Profile, for the Candidate of the menu; each answers
// its own fetcher, a refusal in the words of the action. No secret Parameter comes back (ADR-0006).
export async function action({ request }: ActionFunctionArgs) {
  const { candidate, locale } = await readCandidate(request);
  const t = tFor(locale, 'settings');
  const formData = await request.formData();
  const moduleId = formData.get('channel');
  const moduleList = await ACTIONS.listNotificationChannels();
  const input = {
    candidateId: candidate?.id,
    channel: moduleId ?? undefined,
    parameter: formData.get('parameter') ?? undefined,
    parameters: readParameters(formData, moduleList.find(({ id }) => id === moduleId)?.parameterList),
  };
  return relayAction(
    request,
    async () => {
      switch (formData.get('intent')) {
        case 'save': {
          await ACTIONS.saveNotificationChannel(input);
          return answer(t('notificationChannel.saved'));
        }
        case 'test': {
          await ACTIONS.testNotificationChannel(input);
          return answer(t('notificationChannel.answers'));
        }
        case 'choices': {
          const choiceList = await ACTIONS.listParameterChoices(input);
          return answer(t('notificationChannel.choicesFound', { count: choiceList.length }), choiceList);
        }
        case 'notify': {
          await ACTIONS.sendTestNotification(input);
          return answer(t('notificationChannel.notified'));
        }
      }
      return refuse(t('unknownIntent'));
    },
    refuse,
  );
}
