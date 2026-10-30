import { createCookie } from 'react-router';

import { ACTIONS } from './acl/actions.server.ts';

// The Candidate chosen in the menu, remembered for a year, with no password: the front is only
// reachable on the LAN and through WireGuard (ADR-0002)
const CANDIDATE_COOKIE = createCookie('candidate', { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 31_536_000 });

// The Candidates of the menu and the one the cookie names, unless the config no longer has them
export async function readCandidate(request: Request) {
  const candidateId: unknown = await CANDIDATE_COOKIE.parse(request.headers.get('Cookie'));
  const candidateList = await ACTIONS.listCandidates();
  return { candidateList, candidate: candidateList.find(({ id }) => id === candidateId) ?? null };
}

export function rememberCandidate(candidateId: unknown): Promise<string> {
  return CANDIDATE_COOKIE.serialize(candidateId);
}
