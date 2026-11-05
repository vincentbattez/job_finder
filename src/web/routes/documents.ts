import type { ActionFunctionArgs } from 'react-router';

import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The add-a-document form of the Documents section and of the generation panel posts here through a
// fetcher: a Custom Artifact of the Posting, or of the Interview named, or an Annex in the Profile of the
// Posting's Candidate. The answer names the key of the Input it adds, which the panel checks at once.
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    const title = formData.get('title');
    const text = formData.get('text');
    switch (formData.get('scope')) {
      case 'posting': {
        const interview = formData.get('interview');
        const { key } = await ACTIONS.addCustomArtifact({
          reference: params.reference,
          ...(interview !== null && interview !== '' && { interview }),
          title,
          text,
        });
        return { added: { key } };
      }
      case 'profile': {
        const candidate = await ACTIONS.readPostingCandidate({ reference: params.reference });
        const { fileName } = await ACTIONS.addAnnex({ candidateId: candidate.id, title, markdown: text });
        return { added: { key: `profile:${fileName}` } };
      }
      default: {
        throw codedError('unknown_intent');
      }
    }
  });
}
