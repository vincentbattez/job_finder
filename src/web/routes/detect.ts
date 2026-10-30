import type { ActionFunctionArgs } from 'react-router';

import { codedErrorOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';

// The Detection button posts here, for the Candidate of the menu: the Detection runs on in the server,
// and the page follows it (#63). A refusal, such as a Detection already running, goes back to the button.
export async function action({ request }: ActionFunctionArgs) {
  const { candidate } = await readCandidate(request);
  try {
    await ACTIONS.startDetection({ candidateId: candidate?.id });
    return { error: null };
  } catch (error) {
    return { error: codedErrorOf(error).message };
  }
}
