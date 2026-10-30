import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';

// The status buttons of the Posting page post here, then the Posting page shows the new status
export async function action({ params, request }: ActionFunctionArgs) {
  await ACTIONS.changeStatus({ ...Object.fromEntries(await request.formData()), ...params });
  return redirect(`/postings/${String(params.reference)}`);
}
