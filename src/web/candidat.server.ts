import { createCookie } from 'react-router';

import { ACTIONS } from './acl/actions.server.ts';

// The Candidat chosen in the menu, remembered for a year, with no password: the front is only
// reachable on the LAN and through WireGuard (ADR-0002)
const CANDIDAT_COOKIE = createCookie('candidat', { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 31_536_000 });

// The Candidats of the menu and the one the cookie names, unless the config no longer has them
export async function readCandidat(request: Request) {
  const candidatId: unknown = await CANDIDAT_COOKIE.parse(request.headers.get('Cookie'));
  const candidatList = await ACTIONS.listCandidats();
  return { candidatList, candidat: candidatList.find(({ id }) => id === candidatId) ?? null };
}

export function rememberCandidat(candidatId: unknown): Promise<string> {
  return CANDIDAT_COOKIE.serialize(candidatId);
}
