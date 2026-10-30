import { redirect, type ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';

// The editor of a file of the Version retenue posts here, then the Posting page shows the saved text
export async function action({ params, request }: ActionFunctionArgs) {
  await ACTIONS.saveDocument({ ...Object.fromEntries(await request.formData()), ...params });
  return redirect(`/postings/${String(params.reference)}`);
}
