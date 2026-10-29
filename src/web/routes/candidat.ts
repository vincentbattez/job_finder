import { redirect, type ActionFunctionArgs } from 'react-router';

import { rememberCandidat } from '#/web/candidat.server.ts';

// The menu of the top bar posts here: the cookie remembers the Candidat, then their Offres show
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  return redirect('/', { headers: { 'Set-Cookie': await rememberCandidat(formData.get('candidatId')) } });
}
