import { useTranslation } from 'react-i18next';
import { useLoaderData, useSearchParams, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { Detection } from '#/web/components/detection.tsx';
import { JobDescriptionImport } from '#/web/components/job-description-import.tsx';
import { filterPostings, PostingFilters } from '#/web/components/posting-filters.tsx';
import { PostingList } from '#/web/components/posting-list.tsx';
import { PostingMap } from '#/web/components/posting-map.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidate, locale } = await readCandidate(request);
  return {
    candidate,
    // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
    locale,
    postingList: candidate === null ? [] : await ACTIONS.listPostings({ candidateId: candidate.id }),
  };
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'postingList')('pageTitle') }];
}

export default function Postings() {
  const { candidate, postingList } = useLoaderData<typeof loader>();
  const { t } = useTranslation('postingList');
  const [searchParameters] = useSearchParams();
  if (candidate === null) {
    return (
      <main className="container page">
        <div className="page__head">
          <h1>{t('noCandidateHeading')}</h1>
          <p>{t('noCandidateHint')}</p>
        </div>
      </main>
    );
  }
  const filteredPostingList = filterPostings(postingList, searchParameters);
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{t('heading', { candidateName: candidate.name })}</h1>
        <Detection />
        <JobDescriptionImport />
        {postingList.length > 0 && <PostingFilters postingList={postingList} />}
      </div>
      {postingList.length > 0 && <PostingMap postingList={filteredPostingList} />}
      {filteredPostingList.length === 0 && postingList.length > 0 ? (
        <p className="page__empty">{t('noFilteredPosting')}</p>
      ) : (
        <PostingList postingList={filteredPostingList} />
      )}
    </main>
  );
}
