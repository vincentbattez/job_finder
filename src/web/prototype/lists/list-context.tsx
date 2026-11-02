// PROTOTYPE. The state the list, the map and the Sheet share, whatever the variant lays out: the
// Postings shown (list, tab, filters, order), the one hovered and the one active (two-way sync between
// rows and markers), the Posting the Sheet shows, and the rows leaving the list after Garder/Écarter.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import type { IPosting, ListName } from '../model.ts';
import { useActions, usePostings } from '../store.ts';
import {
  applyFilters,
  EMPTY_FILTERS,
  parseApplicationTab,
  postingsOfList,
  sortPostings,
  type ApplicationTab,
  type IListFilters,
} from './list-model.ts';

type Origin = 'list' | 'map';

interface IListController {
  list: ListName;
  tab: ApplicationTab;
  setTab: (tab: ApplicationTab) => void;
  // Every Posting of the Candidate, for the counts of the tabs
  allPostings: IPosting[];
  // The list's Postings before the City and Region filters: what those filters offer
  listPostings: IPosting[];
  postings: IPosting[];
  filters: IListFilters;
  setFilters: (filters: IListFilters) => void;
  // A key that changes when the filters, the list or the tab do: the map fits its view again then
  fitKey: string;
  hoveredReference: string | null;
  activeReference: string | null;
  activeOrigin: Origin;
  sheetReference: string | null;
  hover: (reference: string | null, origin: Origin) => void;
  // A row opens the Sheet; a marker highlights its row, and shows it in the Sheet when it is open
  activate: (reference: string, origin: Origin) => void;
  closeSheet: () => void;
  leavingReferences: ReadonlySet<string>;
  sort: (reference: string, decision: 'keep' | 'dismiss') => Promise<void>;
}

const ListContext = createContext<IListController | null>(null);

// The row of a Posting in whatever list is mounted, scrolled into view
function revealRow(reference: string) {
  const row = document.querySelector(`[data-posting-row="${CSS.escape(reference)}"]`);
  // In the mobile bottom sheet only its top part shows: the row goes to the top
  const isInSheet = row?.closest('[data-vaul-drawer]') != null;
  row?.scrollIntoView({ block: isInSheet ? 'start' : 'nearest', behavior: 'smooth' });
}

export function ListProvider({ list, children }: { list: ListName; children: ReactNode }) {
  const allPostings = usePostings();
  const actions = useActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseApplicationTab(searchParams.get('tab'));
  const [filters, setFilters] = useState<IListFilters>(EMPTY_FILTERS);
  const [hoveredReference, setHoveredReference] = useState<string | null>(null);
  const [active, setActive] = useState<{ reference: string | null; origin: Origin }>({
    reference: null,
    origin: 'list',
  });
  const [sheetReference, setSheetReference] = useState<string | null>(null);
  const [leavingReferences, setLeavingReferences] = useState<ReadonlySet<string>>(new Set());

  const listPostings = useMemo(
    () => postingsOfList(allPostings, list, tab, filters.isArchived),
    [allPostings, list, tab, filters.isArchived],
  );
  const postings = useMemo(
    () => sortPostings(list, applyFilters(listPostings, filters)),
    [list, listPostings, filters],
  );

  const setTab = useCallback(
    (next: ApplicationTab) => {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          params.set('tab', next);
          return params;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  const hover = useCallback((reference: string | null, origin: Origin) => {
    setHoveredReference(reference);
    if (reference !== null && origin === 'map') {
      revealRow(reference);
    }
  }, []);

  const activate = useCallback((reference: string, origin: Origin) => {
    setActive({ reference, origin });
    if (origin === 'list') {
      setSheetReference(reference);
      return;
    }
    revealRow(reference);
    setSheetReference((current) => (current === null ? null : reference));
  }, []);

  const closeSheet = useCallback(() => {
    setSheetReference(null);
    setActive({ reference: null, origin: 'list' });
  }, []);

  const sort = useCallback(
    async (reference: string, decision: 'keep' | 'dismiss') => {
      setLeavingReferences((current) => new Set([...current, reference]));
      try {
        await (decision === 'keep' ? actions.keep(reference) : actions.dismiss(reference));
      } finally {
        setLeavingReferences((current) => new Set([...current].filter((other) => other !== reference)));
      }
    },
    [actions],
  );

  const fitKey = `${list}|${tab}|${JSON.stringify(filters)}`;
  const value = useMemo(
    (): IListController => ({
      list,
      tab,
      setTab,
      allPostings,
      listPostings,
      postings,
      filters,
      setFilters,
      fitKey,
      hoveredReference,
      activeReference: active.reference,
      activeOrigin: active.origin,
      sheetReference,
      hover,
      activate,
      closeSheet,
      leavingReferences,
      sort,
    }),
    [
      list,
      tab,
      setTab,
      allPostings,
      listPostings,
      postings,
      filters,
      fitKey,
      hoveredReference,
      active,
      sheetReference,
      hover,
      activate,
      closeSheet,
      leavingReferences,
      sort,
    ],
  );
  return <ListContext.Provider value={value}>{children}</ListContext.Provider>;
}

export function useListController(): IListController {
  const value = useContext(ListContext);
  if (value === null) {
    throw new Error('List components need <ListProvider>, mounted by prototype/lists.tsx');
  }
  return value;
}

// What a row needs to take part in the sync: its data attribute, hover and click handlers, its state
export function useRowSync(reference: string) {
  const { hoveredReference, activeReference, sheetReference, hover, activate, leavingReferences } = useListController();
  return {
    rowProps: {
      'data-posting-row': reference,
      onMouseEnter: () => hover(reference, 'list'),
      onMouseLeave: () => hover(null, 'list'),
      onClick: () => activate(reference, 'list'),
    },
    isHovered: hoveredReference === reference,
    isActive: activeReference === reference || sheetReference === reference,
    isLeaving: leavingReferences.has(reference),
  };
}
