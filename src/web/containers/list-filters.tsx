import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { ListFilters } from '#/web/components/list-filters.tsx';
import type { IMapListFiltering } from '#/web/components/map-list.tsx';
import { isInPlace, readListFilters, tally, writeListFilters } from '#/web/list-model.ts';
import { regionBoundsOf } from '#/web/region-bounds.ts';

interface IPlacedItem {
  posting: { city: string | null; region: string | null };
}

// A chosen value the list no longer holds, from a saved link or after a Posting left the list, stays
// offered, at 0, so that the Candidate sees it chosen and can take it back
function withChosen(tallyList: { value: string; count: number }[], chosenList: string[]) {
  const missingList = chosenList.filter((chosen) => tallyList.every(({ value }) => value !== chosen));
  return [...tallyList, ...missingList.map((value) => ({ value, count: 0 }))];
}

// The common filters of a list, held in the URL (spec #125 « Lists »): the loader already chose the
// followed or the Archived Postings; the City and the Region narrow them here. The filtering goes to the
// list's MapList: the bar in its panel, the Region's extent for its map, and what it says when empty.
export function useListFilters<T extends IPlacedItem>(
  itemList: T[],
  archivedCount: number,
): { itemList: T[]; filtering: IMapListFiltering } {
  const { t } = useTranslation('lists');
  const [searchParameters, setSearchParameters] = useSearchParams();
  const filters = readListFilters(searchParameters);
  const filteredList = itemList.filter(({ posting }) => isInPlace(posting, filters));
  // The list's own empty message, unless a filter is why it is empty
  let empty = null;
  if (itemList.length === 0 && filters.isArchived) {
    empty = t('filters.noArchived');
  } else if (filteredList.length === 0 && itemList.length > 0) {
    empty = t('filters.noMatch');
  }
  return {
    itemList: filteredList,
    filtering: {
      toolbar: (
        <ListFilters
          filters={filters}
          cityList={withChosen(tally(itemList.map(({ posting }) => posting.city)), filters.cityList)}
          regionList={withChosen(
            tally(itemList.map(({ posting }) => posting.region)),
            filters.region === null ? [] : [filters.region],
          ).toSorted((first, second) => first.value.localeCompare(second.value, 'fr'))}
          archivedCount={archivedCount}
          onChange={(nextFilters) => {
            setSearchParameters(writeListFilters(searchParameters, nextFilters), {
              replace: true,
              preventScrollReset: true,
            });
          }}
        />
      ),
      fitCornerList: filters.region === null ? undefined : regionBoundsOf(filters.region),
      // The view fits again whenever a filter changes, even after the Candidate moved the map
      fitKey: JSON.stringify(filters),
      empty,
    },
  };
}
