import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// For the Candidate of the menu; a refusal goes back to the drop zone in the words of the action
export function action({ request }: ActionFunctionArgs) {
  return relayAction(
    request,
    async () => {
      const { candidate } = await readCandidate(request);
      const job = await ACTIONS.importJobDescription({
        ...Object.fromEntries(await request.formData()),
        candidateId: candidate?.id,
      });
      return { job, error: null };
    },
    (error) => ({ job: null, error }),
  );
}
