import type { LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { relayLoader } from '#/web/relay-action.server.ts';

// The generation panel loads its Inputs as it opens, then the Prompt of the Inputs checked, which
// its Copy the Prompt button copies (spec #125)
export function loader({ params, request }: LoaderFunctionArgs) {
  return relayLoader(request, () => {
    const { searchParams } = new URL(request.url);
    const inputKeyList = searchParams.getAll('input');
    return ACTIONS.readGeneration({
      ...params,
      interview: searchParams.get('interview') ?? undefined,
      inputKeyList: inputKeyList.length === 0 ? undefined : inputKeyList,
    });
  });
}
