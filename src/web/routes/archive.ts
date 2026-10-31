import { redirect, type ActionFunctionArgs } from 'react-router';

import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The Archive button of the Posting page posts here, beside the Status buttons since Archived is a
// mark and not a Status (ADR-0007); a refusal goes back to the button
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const input = { reference: params.reference };
    const formData = await request.formData();
    switch (formData.get('intent')) {
      case 'archive': {
        await ACTIONS.archive(input);
        break;
      }
      case 'unarchive': {
        await ACTIONS.unarchive(input);
        break;
      }
      default: {
        throw codedError('unknown_intent');
      }
    }
    return redirect(`/postings/${String(params.reference)}`);
  });
}
