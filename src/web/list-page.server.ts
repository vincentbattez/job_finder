import { readCandidate } from './candidate.server.ts';
import { readListFilters } from './list-model.ts';
import { readSheetPosting } from './posting-sheet.server.ts';

// What each list page loads the same way: the items its action lists for the followed Candidate, or under
// the Archived filter the Archived ones, and the Posting of the Sheet the URL opens
export async function readListPage<Item>(
  request: Request,
  listItems: (input: { candidateId: string; isArchived: boolean }) => Promise<Item[]>,
) {
  const { isArchived } = readListFilters(new URL(request.url).searchParams);
  const { candidate, locale } = await readCandidate(request);
  const listOf = async (isArchivedList: boolean) =>
    candidate === null ? [] : listItems({ candidateId: candidate.id, isArchived: isArchivedList });
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
    sheetPosting: await readSheetPosting(request, candidate?.id ?? null),
    // The day the page counts from, the same for the server's render and the browser's
    now: new Date(),
  };
}
