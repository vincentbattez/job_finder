import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';

// « Retenir cette Version » posts here, then the fiche shows the new Version retenue
export async function action({ params, request }: ActionFunctionArgs) {
  await ACTIONS.retenirVersion({ ...Object.fromEntries(await request.formData()), ...params });
  return redirect(`/offres/${String(params.reference)}`);
}
