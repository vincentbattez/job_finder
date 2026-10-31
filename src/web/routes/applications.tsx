import { useTranslation } from 'react-i18next';
import { useLoaderData, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { Applications, loadApplications } from '#/web/containers/applications.tsx';
import { relayLoader } from '#/web/relay-action.server.ts';

export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { candidate, locale } = await readCandidate(request);
    return {
      candidate,
      // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
      locale,
      sectionList: candidate === null ? [] : await loadApplications(ACTIONS, candidate.id),
    };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'applications')('pageTitle') }];
}

// The historical record: every Application by section, and the Postings archived without one
export default function ApplicationsPage() {
  const { candidate, sectionList } = useLoaderData<typeof loader>();
  const { t } = useTranslation('applications');
  if (candidate === null) {
    return (
      <main className="container page">
        <div className="page__head">
          <h1>{t('noCandidateHeading')}</h1>
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
      <Applications sectionList={sectionList} />
    </main>
  );
}
