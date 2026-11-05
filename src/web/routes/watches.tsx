import { useTranslation } from 'react-i18next';
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { PageHeader } from '#/web/components/page-header.tsx';
import { Watches } from '#/web/containers/watches.tsx';
import { readParameters, translateParameters } from '#/web/parameters.server.ts';
import { relayAction, relayLoader } from '#/web/relay-action.server.ts';

export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { candidate, locale } = await readCandidate(request);
    return {
      // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
      locale,
      hasCandidate: candidate !== null,
      watchList: candidate === null ? [] : await ACTIONS.listWatches({ candidateId: candidate.id }),
      sourceList: translateParameters(await ACTIONS.listSources(), locale),
    };
  });
}

// Each form posts here through its fetcher, for the Candidate of the menu, never one the form names; a
// refusal goes back to its fetcher's toast, in the words of the action
export async function action({ request }: ActionFunctionArgs) {
  const { candidate, locale } = await readCandidate(request);
  const formData = await request.formData();
  const input = {
    candidateId: candidate?.id,
    watchId: formData.get('watchId') ?? undefined,
    source: formData.get('source'),
    parameters: readParameters(formData),
  };
  return relayAction(request, async () => {
    switch (formData.get('intent')) {
      case 'save': {
        await ACTIONS.saveWatch(input);
        return null;
      }
      case 'delete': {
        await ACTIONS.deleteWatch(input);
        return null;
      }
    }
    throw codedError('unknown_intent', {}, { locale });
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'settings')('watches.pageTitle') }];
}

// The Watches (spec #125 « Profile, Watches, Settings »): plain forms, one per Watch with its Source's
// Parameters, its last Detection and its Near Misses
export default function WatchesPage() {
  const { hasCandidate, watchList, sourceList } = useLoaderData<typeof loader>();
  const { t } = useTranslation('settings');
  return (
    <main>
      <PageHeader title={t('watches.heading')} description={t('watches.description')} />
      <div className="mx-auto grid max-w-3xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:px-8">
        {hasCandidate ? (
          <>
            <p className="max-w-prose text-sm text-muted-foreground">{t('watches.intro')}</p>
            <Watches watchList={watchList} sourceList={sourceList} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('watches.noCandidate')}</p>
        )}
      </div>
    </main>
  );
}
