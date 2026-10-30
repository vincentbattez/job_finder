import { redirect, type ActionFunctionArgs } from 'react-router';

import { rememberCandidate } from '#/web/candidate.server.ts';

// The menu of the top bar posts here: the cookie remembers the Candidate, then their Postings show
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  return redirect('/', { headers: { 'Set-Cookie': await rememberCandidate(formData.get('candidateId')) } });
}
