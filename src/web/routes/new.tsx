import { useTranslation } from 'react-i18next';
import { useLoaderData, type LoaderFunctionArgs, type MetaArgs, type ShouldRevalidateFunctionArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { PageHeader } from '#/web/components/page-header.tsx';
import { useListFilters } from '#/web/containers/list-filters.tsx';
import { NewSorting } from '#/web/containers/new-sorting.tsx';
import { PostingSheet, useSheetSelection } from '#/web/containers/posting-sheet.tsx';
import { isPlaceChangeOnly, readListFilters } from '#/web/list-model.ts';
import { readSheetPosting } from '#/web/posting-sheet.server.ts';
import { relayLoader } from '#/web/relay-action.server.ts';

// `/` opens New, what waits for the Candidate's decision (spec #125 « Navigation and URL state »): the
// New Postings they follow, or under the Archived filter those they dismissed
export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { isArchived } = readListFilters(new URL(request.url).searchParams);
    const { candidate, locale } = await readCandidate(request);
    const listOf = async (isArchivedList: boolean) =>
      candidate === null ? [] : ACTIONS.listNew({ candidateId: candidate.id, isArchived: isArchivedList });
    const itemList = await listOf(isArchived);
    // Under Archived, the list holds them already
    const archivedList = isArchived ? itemList : await listOf(true);
    return {
      candidate,
      // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
      locale,
      isArchived,
      itemList,
      archivedCount: archivedList.length,
      // The Posting of the Sheet the URL opens
      sheetPosting: await readSheetPosting(request, candidate?.id ?? null),
      // The day the groups are counted from, the same for the server's render and the browser's
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
  return [{ title: tFor(localeOf(loaderData), 'lists')('new.pageTitle') }];
}

export default function New() {
  const { candidate, isArchived, itemList, archivedCount, now, sheetPosting } = useLoaderData<typeof loader>();
  const { t } = useTranslation('lists');
  const filtered = useListFilters(itemList, archivedCount);
  const { selectedReference, onSelect, onClose } = useSheetSelection();
  return (
    <main className="flex h-svh min-h-0 flex-col">
      <PageHeader
        title={t('new.heading')}
        description={candidate === null || isArchived ? undefined : t('new.description', { count: itemList.length })}
      />
      {candidate === null ? (
        <div className="p-4 sm:p-6">
          <p className="text-body font-semibold">{t('noCandidateHeading', { ns: 'postingList' })}</p>
          <p className="text-body text-muted-foreground">{t('noCandidateHint', { ns: 'postingList' })}</p>
        </div>
      ) : (
        <NewSorting
          itemList={filtered.itemList}
          now={now}
          isArchived={isArchived}
          filtering={filtered.filtering}
          selectedReference={selectedReference}
          onSelect={onSelect}
        />
      )}
      <PostingSheet detail={sheetPosting} onClose={onClose} />
    </main>
  );
}
