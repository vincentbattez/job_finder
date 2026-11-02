import { useTranslation } from 'react-i18next';
import { useLoaderData, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { PostingList } from '#/web/components/posting-list.tsx';
import { Detection } from '#/web/containers/detection.tsx';
import { JobDescriptionImport } from '#/web/containers/job-description-import.tsx';
import { relayLoader } from '#/web/relay-action.server.ts';

export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { candidate, locale } = await readCandidate(request);
    return {
      candidate,
      // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
      locale,
      postingList: candidate === null ? [] : await ACTIONS.listPostings({ candidateId: candidate.id }),
      detection: candidate === null ? null : await ACTIONS.followDetection({ candidateId: candidate.id }),
    };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'postingList')('pageTitle') }];
}

export default function Postings() {
  const { candidate, postingList, detection } = useLoaderData<typeof loader>();
  const { t } = useTranslation('postingList');
  if (candidate === null || detection === null) {
    return (
      <main className="container page">
        <div className="page__head">
          <h1>{t('noCandidateHeading')}</h1>
          <p>{t('noCandidateHint')}</p>
        </div>
      </main>
    );
  }
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{t('heading', { candidateName: candidate.name })}</h1>
        <Detection overview={detection} />
        <JobDescriptionImport />
      </div>
      <PostingList
        postingList={postingList.filter(({ archivedAt }) => archivedAt === null)}
        newReferenceList={detection.newReferenceList}
      />
    </main>
  );
}
