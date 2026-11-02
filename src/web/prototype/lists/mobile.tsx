// PROTOTYPE. Below md, whatever the variant: the map is the page; the list is a bottom sheet the
// Candidate drags up (shadcn Drawer / vaul, non-modal, three snap points: a peek, half, full). A tap
// on a point raises the sheet to half and scrolls to its row.
import { SlidersHorizontalIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '#/web/prototype/components/ui/drawer.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { LIST_LABEL } from '../model.ts';
import { useRunningKeysByReference } from './columns.tsx';
import { CompactRow } from './compact-row.tsx';
import { ApplicationTabs, ListFilters } from './filters.tsx';
import { useListController } from './list-context.tsx';
import { ListMap } from './list-map.tsx';
import { hasFilters } from './list-model.ts';
import { EmptyList } from './variant-a.tsx';

// vaul measures a px snap point from the window's bottom edge to its top: the peek shows ~150px of a
// sheet that stops under the page header (4.5rem)
const PEEK = '222px';
const SNAP_POINT_LIST: (string | number)[] = [PEEK, 0.5, 1];

export function MobileLayout() {
  const { list, postings, filters, activeReference, activeOrigin } = useListController();
  const runningKeysByReference = useRunningKeysByReference();
  const [snapPoint, setSnapPoint] = useState<string | number | null>(PEEK);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // A point tapped: the sheet comes up enough to show its row
  useEffect(() => {
    if (activeReference !== null && activeOrigin === 'map') {
      setSnapPoint((current) => (current === PEEK ? 0.5 : current));
    }
  }, [activeReference, activeOrigin]);

  return (
    <div className="relative min-h-0 flex-1">
      <ListMap className="absolute inset-0" paddingBottomRight={[24, 170]} paddingTopLeft={[24, 24]} />
      <Drawer
        open
        modal={false}
        dismissible={false}
        snapPoints={SNAP_POINT_LIST}
        activeSnapPoint={snapPoint}
        setActiveSnapPoint={setSnapPoint}
      >
        <DrawerContent
          className="h-full shadow-[0_-8px_30px_rgb(0_0_0/0.12)] data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[calc(100svh-4.5rem)]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex items-center gap-2 px-4 pt-2 pb-3">
            <div className="min-w-0 flex-1">
              <DrawerTitle className="text-base font-semibold">
                {LIST_LABEL[list]} <span className="font-normal text-muted-foreground">· {postings.length}</span>
              </DrawerTitle>
              <DrawerDescription className="text-xs">Glisse vers le haut pour voir la liste</DrawerDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={cn(hasFilters(filters) && 'border-primary/40 text-primary')}
              onClick={() => {
                setIsFilterOpen((isOpen) => !isOpen);
                setSnapPoint(1);
              }}
            >
              <SlidersHorizontalIcon />
              Filtres
            </Button>
          </div>
          {list === 'applications' ? <ApplicationTabs isFull className="px-4 pb-3" /> : null}
          {isFilterOpen ? <ListFilters layout="stack" className="border-t px-4 py-3" /> : null}
          <ul
            className={cn('min-h-0 flex-1 divide-y border-t', snapPoint === 1 ? 'overflow-y-auto' : 'overflow-hidden')}
          >
            {postings.length === 0 ? (
              <li>
                <EmptyList />
              </li>
            ) : (
              postings.map((posting) => (
                <CompactRow
                  key={posting.reference}
                  posting={posting}
                  runningKeys={runningKeysByReference.get(posting.reference) ?? []}
                />
              ))
            )}
          </ul>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
