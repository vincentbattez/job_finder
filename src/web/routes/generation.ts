import type { LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { relayLoader } from '#/web/relay-action.server.ts';

// The generation panel loads its Inputs as it opens, then the Prompt of the Inputs checked, which
// its Copy the Prompt button copies (spec #125); beside them, the Instructions of the Candidate of the
// menu, which its editor changes, outside the Artifact module (ADR-0016)
export function loader({ params, request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { searchParams } = new URL(request.url);
    const inputKeyList = searchParams.getAll('input');
    const [generation, { candidate }] = await Promise.all([
      ACTIONS.readGeneration({
        ...params,
        interview: searchParams.get('interview') ?? undefined,
        inputKeyList: inputKeyList.length === 0 ? undefined : inputKeyList,
      }),
      readCandidate(request),
    ]);
    return {
      ...generation,
      instructions:
        candidate === null
          ? null
          : await ACTIONS.readInstructions({ candidateId: candidate.id, module: generation.artifact }),
    };
  });
}
