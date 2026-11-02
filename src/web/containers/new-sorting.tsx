import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { ISheetSelection } from '#/web/components/map-list.tsx';
import { NewList, SortButtons, type NewItem, type SortDecision } from '#/web/components/new-list.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

interface ISort {
  reference: string;
  decision: SortDecision;
}

// Where each decision posts: keeping moves the Posting To Apply, dismissing archives it (ADR-0018)
function submitSort(fetcher: ReturnType<typeof useFetcher>, { reference, decision }: ISort) {
  const isKeep = decision === 'keep';
  void fetcher.submit(isKeep ? {} : { intent: 'archive' }, {
    method: 'post',
    action: `/postings/${reference}/${isKeep ? 'keep' : 'archive'}`,
    preventScrollReset: true,
  });
}

// One sorting under way: it outlives its row, which leaves the list at once, so that its toast still
// tells how it ended. Dismissing offers its undo there.
function SortRequest({
  sort,
  onSettled,
  onUndo,
}: Readonly<{ sort: ISort; onSettled: () => void; onUndo: (reference: string) => void }>) {
  const { t } = useTranslation('lists');
  const fetcher = useFetcher<IRefusal | null>();
  // Whether its sorting was posted: once, even when React runs the effect twice
  const sentReference = useRef(false);
  useFeedback(
    fetcher,
    () => (sort.decision === 'keep' ? t('new.kept') : t('new.dismissed')),
    sort.decision === 'dismiss'
      ? () => ({
          label: t('new.undo'),
          onClick: () => {
            onUndo(sort.reference);
          },
        })
      : undefined,
  );
  useEffect(() => {
    if (sentReference.current) {
      return;
    }
    sentReference.current = true;
    submitSort(fetcher, sort);
  }, [fetcher, sort]);
  useEffect(() => {
    if (sentReference.current && fetcher.state === 'idle' && fetcher.data !== undefined) {
      onSettled();
    }
  }, [fetcher.state, fetcher.data, onSettled]);
  return null;
}

// New and its sorting (spec #125 « Sorting New »): Keep and Dismiss on each row; a sorted
// Posting leaves the list at once and comes back only if the sorting was refused
export function NewSorting({
  itemList,
  now,
  selectedReference,
  onSelect,
}: Readonly<{ itemList: NewItem[]; now: Date } & ISheetSelection>) {
  const { t } = useTranslation('lists');
  const [sortList, setSortList] = useState<ISort[]>([]);
  const undoFetcher = useFetcher<IRefusal | null>();
  useFeedback(undoFetcher, () => t('new.restored'));
  const sortingSet = new Set(sortList.map(({ reference }) => reference));

  function undo(reference: string) {
    void undoFetcher.submit(
      { intent: 'unarchive' },
      { method: 'post', action: `/postings/${reference}/archive`, preventScrollReset: true },
    );
  }

  return (
    <>
      <NewList
        itemList={itemList.filter(({ posting }) => !sortingSet.has(posting.reference))}
        now={now}
        selectedReference={selectedReference}
        onSelect={onSelect}
        renderActions={({ reference }) => (
          <SortButtons
            onSort={(decision) => {
              setSortList((previousList) => [...previousList, { reference, decision }]);
            }}
          />
        )}
      />
      {sortList.map((sort) => (
        <SortRequest
          key={sort.reference}
          sort={sort}
          onUndo={undo}
          onSettled={() => {
            setSortList((previousList) => previousList.filter(({ reference }) => reference !== sort.reference));
          }}
        />
      ))}
    </>
  );
}
