import type { ActionFunctionArgs } from 'react-router';

import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// Archive and unarchive post here through a fetcher, beside the Status since Archived is a mark and not
// a Status (ADR-0007); the fetcher revalidates the page it is on, a refusal goes back to it
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
        const { locale } = await readCandidate(request);
        throw codedError('unknown_intent', {}, { locale });
      }
    }
    return null;
  });
}
