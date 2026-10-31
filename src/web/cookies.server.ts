import { createCookie } from 'react-router';

// The two cookies of the front, apart from what reads them: the e2e fixture (e2e/candidate.ts) serializes
// the Candidate's with the same encoding, without loading the actions

// The Candidate chosen in the menu, remembered for a year, with no password: the front is only
// reachable on the LAN and through WireGuard (ADR-0002)
export const CANDIDATE_COOKIE = createCookie('candidate', {
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
  maxAge: 31_536_000,
});

// The locale chosen with the Locale Switcher while no Candidate is chosen; a Candidate keeps theirs on
// their row (ADR-0012)
export const LOCALE_COOKIE = createCookie('locale', { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 31_536_000 });
