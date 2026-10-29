import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';

// The statut buttons of the fiche post here, then the fiche shows the new statut
export async function action({ params, request }: ActionFunctionArgs) {
  await ACTIONS.changeStatus({ ...Object.fromEntries(await request.formData()), ...params });
  return redirect(`/offres/${String(params.reference)}`);
}
