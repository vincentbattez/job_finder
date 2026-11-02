import { ACTIONS } from './acl/actions.server.ts';

// The Posting a list's Sheet shows, which the URL names (`?posting=<reference>`, spec #125 « Navigation
// and URL state »): none when the URL names none, or a Posting of another Candidate, as a link kept
// across a switch of Candidate would
export async function readSheetPosting(request: Request, candidateId: string | null) {
  const reference = new URL(request.url).searchParams.get('posting');
  if (reference === null || candidateId === null) {
    return null;
  }
  const detail = await ACTIONS.readPosting({ reference });
  return detail.posting.candidateId === candidateId ? detail : null;
}
