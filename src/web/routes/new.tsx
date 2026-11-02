import { useTranslation } from 'react-i18next';
import { redirect, useLoaderData, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { PageHeader } from '#/web/components/page-header.tsx';
import { NewSorting } from '#/web/containers/new-sorting.tsx';
import { relayLoader } from '#/web/relay-action.server.ts';

// The filters of the Posting list, which lived on the home before it moved to /postings
const POSTING_FILTER_LIST = ['city', 'region', 'archived'];

// `/` opens New, what waits for the Candidate's decision (spec #125 « Navigation and URL state »). A
// filtered list saved before the move keeps filtering, at /postings.
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
      itemList: candidate === null ? [] : await ACTIONS.listNew({ candidateId: candidate.id }),
      // The day the groups are counted from, the same for the server's render and the browser's
      now: new Date(),
    };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'lists')('new.pageTitle') }];
}

export default function New() {
  const { candidate, itemList, now } = useLoaderData<typeof loader>();
  const { t } = useTranslation('lists');
  return (
    <main className="flex h-svh min-h-0 flex-col">
      <PageHeader
        title={t('new.heading')}
        description={candidate === null ? undefined : t('new.description', { count: itemList.length })}
      />
      {candidate === null ? (
        <div className="p-4 sm:p-6">
          <p className="text-body font-semibold">{t('noCandidateHeading', { ns: 'postingList' })}</p>
          <p className="text-body text-muted-foreground">{t('noCandidateHint', { ns: 'postingList' })}</p>
        </div>
      ) : (
        <NewSorting itemList={itemList} now={now} />
      )}
    </main>
  );
}
