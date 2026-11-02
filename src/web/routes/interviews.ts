import type { ActionFunctionArgs } from 'react-router';

import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The Interview Dialog and the Interviews tab post here through a fetcher, which revalidates the page;
// adding answers the Interview added, which the Dialog shows and lands on; a refusal goes back to the form,
// which keeps what was typed
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    const interview = { reference: params.reference, number: formData.get('number') };
    const fields = {
      start: formData.get('start'),
      durationMinutes: formData.get('durationMinutes'),
      place: formData.get('place'),
      interviewers: formData.get('interviewers'),
    };
    switch (formData.get('intent')) {
      case 'add': {
        const { number, startAt, durationMinutes, place, interviewers } = await ACTIONS.addInterview({
          reference: params.reference,
          ...fields,
        });
        return { added: { number, startAt, durationMinutes, place, interviewers } };
      }
      case 'edit': {
        await ACTIONS.editInterview({ ...interview, ...fields });
        break;
      }
      case 'delete': {
        await ACTIONS.deleteInterview(interview);
        break;
      }
      default: {
        throw codedError('unknown_intent');
      }
    }
    return null;
  });
}
