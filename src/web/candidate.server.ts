import { localeOf, type Locale } from '#/actions/i18n.ts';
import { parseLocale } from '#/actions/locale.ts';

import { ACTIONS } from './acl/actions.server.ts';
import { CANDIDATE_COOKIE, LOCALE_COOKIE } from './cookies.server.ts';

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

// The page a switch was posted from, to show again: only the path of the Referer, never another site,
// since a path starting with // would lead to one
export function backUrlOf(request: Request): string {
  const { pathname, search } = new URL(request.headers.get('Referer') ?? '/', request.url);
  return `/${pathname.replace(/^\/+/, '')}${search}`;
}

export function rememberLocale(locale: Locale): Promise<string> {
  return LOCALE_COOKIE.serialize(locale);
}
