import { data, redirect, type ActionFunctionArgs } from 'react-router';

import { parseLocale } from '#/actions/locale.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { backUrlOf, readCandidate, rememberLocale } from '#/web/candidate.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The Locale Switcher of the Sidebar posts here: the chosen Candidate keeps the locale, for the CLI and
// the notifications too; without one, a cookie does (ADR-0012). The page it was posted from shows
// again, translated.
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const locale = parseLocale(formData.get('locale'));
  // The buttons only send the tool's locales: anything else is a forged request, refused as is
  if (locale === null) {
    return data(null, { status: 400 });
  }
  return relayAction(request, async () => {
    const { candidate } = await readCandidate(request);
    const backUrl = backUrlOf(request);
    if (candidate !== null) {
      await ACTIONS.setCandidateLocale({ candidateId: candidate.id, locale });
      return redirect(backUrl);
    }
    return redirect(backUrl, { headers: { 'Set-Cookie': await rememberLocale(locale) } });
  });
}
