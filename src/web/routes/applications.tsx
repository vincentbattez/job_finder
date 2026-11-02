import { useTranslation } from 'react-i18next';
import {
  useLoaderData,
  useSearchParams,
  type LoaderFunctionArgs,
  type MetaArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { ApplicationsList } from '#/web/components/applications-list.tsx';
import { PageHeader } from '#/web/components/page-header.tsx';
import { useListFilters } from '#/web/containers/list-filters.tsx';
import { PostingSheet, useSheetSelection } from '#/web/containers/posting-sheet.tsx';
import { APPLICATION_TAB_LIST, isPlaceChangeOnly, readListFilters, type ApplicationTab } from '#/web/list-model.ts';
import { readSheetPosting } from '#/web/posting-sheet.server.ts';
import { relayLoader } from '#/web/relay-action.server.ts';

// The Applications the Candidate follows, or under the Archived filter the Archived ones
export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { isArchived } = readListFilters(new URL(request.url).searchParams);
    const { candidate, locale } = await readCandidate(request);
    const listOf = async (isArchivedList: boolean) =>
      candidate === null ? [] : ACTIONS.listApplications({ candidateId: candidate.id, isArchived: isArchivedList });
    const itemList = await listOf(isArchived);
    // Under Archived, the list holds them already
    const archivedList = isArchived ? itemList : await listOf(true);
    return {
      candidate,
      // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
      locale,
      itemList,
      archivedCount: archivedList.length,
      // The Posting of the Sheet the URL opens
      sheetPosting: await readSheetPosting(request, candidate?.id ?? null),
      // The year dates are shown without, the same for the server's render and the browser's
      now: new Date(),
    };
  });
}

// The City and the Region filter what the page holds already
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return !(formMethod === undefined && isPlaceChangeOnly(currentUrl, nextUrl)) && defaultShouldRevalidate;
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'lists')('applications.pageTitle') }];
}

function isApplicationTab(value: string | null): value is ApplicationTab {
  return APPLICATION_TAB_LIST.some((tab) => tab === value);
}

export default function Applications() {
  const { candidate, itemList, archivedCount, now, sheetPosting } = useLoaderData<typeof loader>();
  const { t } = useTranslation('lists');
  const filtered = useListFilters(itemList, archivedCount);
  const { selectedReference, onSelect, onClose } = useSheetSelection();
  // The tab lives in the URL, In progress by default (spec #125 « Navigation and URL state »)
  const [searchParameters, setSearchParameters] = useSearchParams();
  const requestedTab = searchParameters.get('tab');
  const tab = isApplicationTab(requestedTab) ? requestedTab : 'in_progress';

  function changeTab(nextTab: string) {
    setSearchParameters(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (nextTab === 'in_progress') {
          next.delete('tab');
        } else {
          next.set('tab', nextTab);
        }
        return next;
      },
      { preventScrollReset: true },
    );
  }

  return (
    <main className="flex h-svh min-h-0 flex-col">
      <PageHeader title={t('applications.heading')} />
      {candidate === null ? (
        <div className="p-4 sm:p-6">
          <p className="text-body font-semibold">{t('noCandidateHeading', { ns: 'postingList' })}</p>
          <p className="text-body text-muted-foreground">{t('noCandidateHint', { ns: 'postingList' })}</p>
        </div>
      ) : (
        <ApplicationsList
          itemList={filtered.itemList}
          filtering={filtered.filtering}
          tab={tab}
          onTabChange={changeTab}
          now={now}
          selectedReference={selectedReference}
          onSelect={onSelect}
        />
      )}
      <PostingSheet detail={sheetPosting} onClose={onClose} />
    </main>
  );
}
