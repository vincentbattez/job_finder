import { useTranslation } from 'react-i18next';
import { useLoaderData, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { PageHeader } from '#/web/components/page-header.tsx';
import { ToApplyList } from '#/web/components/to-apply-list.tsx';
import { relayLoader } from '#/web/relay-action.server.ts';

export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { candidate, locale } = await readCandidate(request);
    return {
      candidate,
      // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
      locale,
      itemList: candidate === null ? [] : await ACTIONS.listToApply({ candidateId: candidate.id }),
      // The day the groups are counted from, the same for the server's render and the browser's
      now: new Date(),
    };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'lists')('toApply.pageTitle') }];
}

export default function ToApply() {
  const { candidate, itemList, now } = useLoaderData<typeof loader>();
  const { t } = useTranslation('lists');
  return (
    <main className="flex h-svh min-h-0 flex-col">
      <PageHeader title={t('toApply.heading')} />
      {candidate === null ? (
        <div className="p-4 sm:p-6">
          <p className="text-body font-semibold">{t('noCandidateHeading', { ns: 'postingList' })}</p>
          <p className="text-body text-muted-foreground">{t('noCandidateHint', { ns: 'postingList' })}</p>
        </div>
      ) : (
        <ToApplyList itemList={itemList} now={now} />
      )}
    </main>
  );
}
