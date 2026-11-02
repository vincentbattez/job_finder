import type { ActionFunctionArgs } from 'react-router';

import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { readParameters } from '#/web/parameters.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The buttons of the Notifications section of the Settings, for the Candidate of the menu; each answers
// its own fetcher, whose toast words the success, or the refusal in the words of the action. Only the
// choices a module listed come back, never a secret Parameter (ADR-0006).
export async function action({ request }: ActionFunctionArgs) {
  const { candidate, locale } = await readCandidate(request);
  const formData = await request.formData();
  const moduleId = formData.get('channel');
  const moduleList = await ACTIONS.listNotificationChannels();
  const input = {
    candidateId: candidate?.id,
    channel: moduleId ?? undefined,
    parameter: formData.get('parameter') ?? undefined,
    parameters: readParameters(formData, moduleList.find(({ id }) => id === moduleId)?.parameterList),
  };
  return relayAction(request, async () => {
    switch (formData.get('intent')) {
      case 'save': {
        await ACTIONS.saveNotificationChannel(input);
        return { error: null, choiceList: null };
      }
      case 'test': {
        await ACTIONS.testNotificationChannel(input);
        return { error: null, choiceList: null };
      }
      case 'choices': {
        return { error: null, choiceList: await ACTIONS.listParameterChoices(input) };
      }
      case 'notify': {
        await ACTIONS.sendTestNotification(input);
        return { error: null, choiceList: null };
      }
    }
    throw codedError('unknown_intent', {}, { locale });
  });
}
