import { redirect, type ActionFunctionArgs } from 'react-router';

import { backUrlOf, rememberCandidate } from '#/web/candidate.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// A Posting page shows a Posting of the Candidate left: the switch then leads to New
const POSTING_PAGE_PATTERN = /^\/postings\/[^/?]+/;

// The Candidate switcher of the Sidebar posts here: the cookie remembers the Candidate, then the same
// page shows again, theirs (spec #125, « Navigation and URL state »)
export function action({ request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    const backUrl = backUrlOf(request);
    return redirect(POSTING_PAGE_PATTERN.test(backUrl) ? '/' : backUrl, {
      headers: { 'Set-Cookie': await rememberCandidate(formData.get('candidateId')) },
    });
  });
}
