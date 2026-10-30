import type { ActionFunctionArgs } from 'react-router';

import { catalogueOf } from '#/actions/catalogue.ts';
import { messageOf, type Actions } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { readParameters } from '#/web/parameters.server.ts';

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
  const { candidate } = await readCandidate(request);
  const { settings } = catalogueOf(candidate);
  const copy = settings.notificationChannel;
  const formData = await request.formData();
  const moduleId = formData.get('channel');
  const moduleList = await ACTIONS.listNotificationChannels();
  const input = {
    candidateId: candidate?.id,
    channel: moduleId ?? undefined,
    parameter: formData.get('parameter') ?? undefined,
    parameters: readParameters(formData, moduleList.find(({ id }) => id === moduleId)?.parameterList),
  };
  try {
    switch (formData.get('intent')) {
      case 'save': {
        await ACTIONS.saveNotificationChannel(input);
        return answer(copy.saved);
      }
      case 'test': {
        await ACTIONS.testNotificationChannel(input);
        return answer(copy.answers);
      }
      case 'choices': {
        const choiceList = await ACTIONS.listParameterChoices(input);
        return answer(copy.choicesFound(choiceList.length), choiceList);
      }
      case 'notify': {
        await ACTIONS.sendTestNotification(input);
        return answer(copy.notified);
      }
    }
  } catch (error) {
    return refuse(messageOf(error));
  }
  return refuse(settings.unknownIntent);
}
