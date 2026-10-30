import type { ActionFunctionArgs } from 'react-router';

import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';

// For the Candidate of the menu; a refusal goes back to the drop zone in the words of the action
export async function action({ request }: ActionFunctionArgs) {
  const { candidate } = await readCandidate(request);
  try {
    const job = await ACTIONS.importJobDescription({
      ...Object.fromEntries(await request.formData()),
      candidateId: candidate?.id,
    });
    return { job, error: null };
  } catch (error) {
    return { job: null, error: messageOf(error) };
  }
}
