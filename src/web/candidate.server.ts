import { createCookie } from 'react-router';

import { localeOf, type Locale } from '#/actions/i18n.ts';
import { parseLocale } from '#/actions/locale.ts';

import { ACTIONS } from './acl/actions.server.ts';

// The Candidate chosen in the menu, remembered for a year, with no password: the front is only
// reachable on the LAN and through WireGuard (ADR-0002)
const CANDIDATE_COOKIE = createCookie('candidate', { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 31_536_000 });

// The locale chosen with the Locale Switcher while no Candidate is chosen; a Candidate keeps theirs on
// their row (ADR-0012)
const LOCALE_COOKIE = createCookie('locale', { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 31_536_000 });

// The Candidates of the menu, the one the cookie names unless the config no longer has them, and the
// locale the request is rendered in
export async function readCandidate(request: Request) {
  const cookieHeader = request.headers.get('Cookie');
  const candidateId: unknown = await CANDIDATE_COOKIE.parse(cookieHeader);
  const candidateList = await ACTIONS.listCandidates();
  const candidate = candidateList.find(({ id }) => id === candidateId) ?? null;
  return {
    candidateList,
    candidate,
    locale: localeOf(candidate, parseLocale(await LOCALE_COOKIE.parse(cookieHeader))),
  };
}

export function rememberCandidate(candidateId: unknown): Promise<string> {
  return CANDIDATE_COOKIE.serialize(candidateId);
}

export function rememberLocale(locale: Locale): Promise<string> {
  return LOCALE_COOKIE.serialize(locale);
}
