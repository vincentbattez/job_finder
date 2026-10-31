import { useTranslation } from 'react-i18next';
import { redirect, useLoaderData, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { LatestPostings, loadLatestPostings } from '#/web/containers/latest-postings.tsx';
import { relayLoader } from '#/web/relay-action.server.ts';

// The filters of the Posting list, which lived here before it moved to /postings
const POSTING_FILTER_LIST = ['city', 'region', 'archived'];

// A filtered list saved before the move keeps filtering, at /postings
export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { search, searchParams } = new URL(request.url);
    if (POSTING_FILTER_LIST.some((name) => searchParams.has(name))) {
      return redirect(`/postings${search}`, 301);
    }
    const { candidate, locale } = await readCandidate(request);
    return {
      candidate,
      // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
      locale,
      latestPostingList: candidate === null ? [] : await loadLatestPostings(ACTIONS, candidate.id),
    };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'home')('pageTitle') }];
}

export default function Home() {
  const { candidate, latestPostingList } = useLoaderData<typeof loader>();
  const { t } = useTranslation('home');
  if (candidate === null) {
    return (
      <main className="container page">
        <div className="page__head">
          <h1>{t('noCandidateHeading', { ns: 'postingList' })}</h1>
          <p>{t('noCandidateHint', { ns: 'postingList' })}</p>
        </div>
      </main>
    );
  }
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{t('heading', { candidateName: candidate.name })}</h1>
      </div>
      <LatestPostings postingList={latestPostingList} />
    </main>
  );
}
