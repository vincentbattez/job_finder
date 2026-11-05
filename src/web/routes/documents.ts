import type { ActionFunctionArgs } from 'react-router';

import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The add-a-document form of the Documents section and of the generation panel posts here through a
// fetcher: a Custom Artifact of the Posting, or of the Interview named, or an Annex in the Profile of the
// Posting's Candidate. The answer names the key of the Input it adds, which the panel checks at once; a PDF
// of the Posting only tells it is queued, since no run reads it before the worker converted it.
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    const title = formData.get('title');
    const text = formData.get('text');
    switch (formData.get('scope')) {
      case 'posting': {
        const interview = formData.get('interview');
        const target = {
          reference: params.reference,
          ...(interview !== null && interview !== '' && { interview }),
          title,
        };
        const pdf = formData.get('pdf');
        if (pdf instanceof File) {
          const content = new Uint8Array(await pdf.arrayBuffer());
          await ACTIONS.addCustomArtifactPdf({ ...target, fileName: pdf.name, content });
          return { isQueued: true };
        }
        const { key } = await ACTIONS.addCustomArtifact({ ...target, text });
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
