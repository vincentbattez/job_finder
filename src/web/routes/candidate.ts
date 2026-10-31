import { redirect, type ActionFunctionArgs } from 'react-router';

import { rememberCandidate } from '#/web/candidate.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The menu of the top bar posts here: the cookie remembers the Candidate, then their home shows
export function action({ request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    return redirect('/', { headers: { 'Set-Cookie': await rememberCandidate(formData.get('candidateId')) } });
  });
}
