import type { ActionFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// Bringing my own Version posts here through a fetcher, multipart so a PDF reaches the action byte for byte: a
// text lands at once as a Draft, a PDF waits for the worker's conversion; the answer tells which
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    const { pdf, ...fieldByName } = Object.fromEntries(formData);
    if (pdf instanceof File) {
      await ACTIONS.bringPdf({
        ...fieldByName,
        ...params,
        fileName: pdf.name,
        content: new Uint8Array(await pdf.arrayBuffer()),
      });
      return { brought: 'pdf' as const };
    }
    await ACTIONS.bringVersion({ ...fieldByName, ...params });
    return { brought: 'text' as const };
  });
}
