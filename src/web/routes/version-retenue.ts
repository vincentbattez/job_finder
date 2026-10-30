import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';

// « Retenir cette Version » posts here, then the Posting page shows the new Version retenue
export async function action({ params, request }: ActionFunctionArgs) {
  await ACTIONS.retenirVersion({ ...Object.fromEntries(await request.formData()), ...params });
  return redirect(`/postings/${String(params.reference)}`);
}
