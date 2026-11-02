// PROTOTYPE. Variant A « Tableau + carte » bets on reading many Postings at once: a dense table on the
// left, one column per fact, sticky headers; the map sticks on the right as a spatial index of the rows.
import { InboxIcon } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/web/prototype/components/ui/table.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import type { IPosting } from '../model.ts';
import { rowStateClass } from './cells.tsx';
import { COLUMNS_BY_LIST, useRunningKeysByReference } from './columns.tsx';
import { ApplicationTabs, ListFilters } from './filters.tsx';
import { useListController, useRowSync } from './list-context.tsx';
import { ListMap } from './list-map.tsx';

function Row({ posting, runningKeys }: { posting: IPosting; runningKeys: string[] }) {
  const { list } = useListController();
  const { rowProps, ...state } = useRowSync(posting.reference);
  return (
    <TableRow {...rowProps} className={rowStateClass({ ...state, isArchived: posting.archivedAt !== null })}>
      {COLUMNS_BY_LIST[list].map((column) => (
        <TableCell key={column.key} className={cn('py-2.5 align-middle', column.className)}>
          {column.cell(posting, { runningKeys })}
        </TableCell>
      ))}
    </TableRow>
  );
}

export function EmptyList({ className }: { className?: string }) {
  const { list, filters } = useListController();
  const message = filters.isArchived
    ? 'Aucune Offre archivée ici.'
    : list === 'new'
      ? 'Tout est trié. Lance une Détection pour chercher de nouvelles Offres.'
      : 'Aucune Offre ne correspond à ces filtres.';
  return (
    <div
      className={cn('flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground', className)}
    >
      <InboxIcon className="size-6" />
      {message}
    </div>
  );
}

export function VariantA() {
  const { list, postings } = useListController();
  const runningKeysByReference = useRunningKeysByReference();
  const columnList = COLUMNS_BY_LIST[list];
  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 border-b px-4 py-3">
          <ApplicationTabs />
          <ListFilters />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [&>[data-slot=table-container]]:overflow-visible">
          {postings.length === 0 ? (
            <EmptyList />
          ) : (
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                <TableRow className="hover:bg-transparent">
                  {columnList.map((column) => (
                    <TableHead key={column.key} className={cn('h-9 text-xs', column.className)}>
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {postings.map((posting) => (
                  <Row
                    key={posting.reference}
                    posting={posting}
                    runningKeys={runningKeysByReference.get(posting.reference) ?? []}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
      <aside className="hidden w-[36%] max-w-xl min-w-80 border-l lg:block">
        <ListMap className="size-full" />
      </aside>
    </div>
  );
}
