import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The Detection button posts here, for the Candidate of the menu: the Detection runs on in the server,
// and the page follows it (#63). A refusal, such as a Detection already running, goes back to the button.
export function action({ request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const { candidate } = await readCandidate(request);
    await ACTIONS.startDetection({ candidateId: candidate?.id });
    return { error: null };
  });
}
