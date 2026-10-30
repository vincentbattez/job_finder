import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';

// « Choose cette Version » posts here, then the Posting page shows the new Chosen Version
export async function action({ params, request }: ActionFunctionArgs) {
  await ACTIONS.chooseVersion({ ...Object.fromEntries(await request.formData()), ...params });
  return redirect(`/postings/${String(params.reference)}`);
}
