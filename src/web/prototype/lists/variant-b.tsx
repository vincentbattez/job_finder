// PROTOTYPE. Variant B « Carte d’abord » bets on place as the first question (« où est ce poste ? »):
// the map fills the page; the list floats over it in a panel that folds away, two lines per Posting.
import { ListIcon, PanelLeftCloseIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { LIST_LABEL } from '../model.ts';
import { useRunningKeysByReference } from './columns.tsx';
import { CompactRow } from './compact-row.tsx';
import { ApplicationTabs, ListFilters } from './filters.tsx';
import { useListController } from './list-context.tsx';
import { ListMap } from './list-map.tsx';
import { EmptyList } from './variant-a.tsx';

const PANEL_WIDTH = 400;

export function VariantB() {
  const { list, postings } = useListController();
  const runningKeysByReference = useRunningKeysByReference();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  return (
    <div className="relative min-h-0 flex-1">
      <ListMap
        className="absolute inset-0"
        paddingTopLeft={isPanelOpen ? [PANEL_WIDTH + 48, 48] : [48, 48]}
        paddingBottomRight={[48, 48]}
      />
      {isPanelOpen ? (
        <aside
          className="absolute top-3 bottom-3 left-3 z-10 flex flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/85"
          style={{ width: PANEL_WIDTH }}
        >
          <div className="space-y-3 border-b p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {LIST_LABEL[list]}{' '}
                <span className="font-normal text-muted-foreground tabular-nums">· {postings.length}</span>
              </h2>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsPanelOpen(false)}
                aria-label="Replier la liste"
              >
                <PanelLeftCloseIcon />
              </Button>
            </div>
            <ApplicationTabs isFull />
            <ListFilters layout="stack" />
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
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
        </aside>
      ) : (
        <Button
          variant="outline"
          className={cn('absolute top-3 left-3 z-10 bg-background shadow-lg')}
          onClick={() => setIsPanelOpen(true)}
        >
          <ListIcon />
          {LIST_LABEL[list]} · {postings.length}
        </Button>
      )}
    </div>
  );
}
