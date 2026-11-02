// PROTOTYPE. Variant B « Carte d’abord » (the user's pick) bets on place as the first question
// (« où est ce poste ? »): the map fills the page; the list floats over it in a panel that folds away,
// grouped by what needs attention first (as variant C): the Deadline's urgency for New and To Apply;
// Interviewed, Invited, Applied for Applications. The map takes the same groups as its colors. The
// Sheet opens on the right; a Posting opened is centered in the map that is left visible.
import { ListIcon, PanelLeftCloseIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '#/web/prototype/components/ui/button.tsx';

import { LIST_LABEL } from '../model.ts';
import { GroupedCompactList } from './compact-row.tsx';
import { ApplicationTabs, ListFilters } from './filters.tsx';
import { useListController } from './list-context.tsx';
import { ListMap, MapLegend } from './list-map.tsx';
import { mapLegendOf, mapToneOf } from './list-model.ts';

const PANEL_WIDTH = 400;
const PANEL_MARGIN = 12;
// The Sheet's width (posting-sheet.tsx: 30rem, the whole width below sm)
const SHEET_WIDTH = 480;

function useWindowWidth(): number {
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

export function VariantB() {
  const { list, postings, sheetReference } = useListController();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const windowWidth = useWindowWidth();
  const panelInset = isPanelOpen ? PANEL_WIDTH + PANEL_MARGIN : 0;
  return (
    <div className="relative min-h-0 flex-1">
      <ListMap
        className="absolute inset-0"
        paddingTopLeft={[panelInset + 40, 64]}
        paddingBottomRight={[40, 56]}
        toneOf={mapToneOf(list)}
        focusInset={{
          top: 0,
          bottom: 0,
          left: panelInset,
          right: sheetReference === null ? 0 : Math.min(SHEET_WIDTH, windowWidth),
        }}
      />
      <MapLegend items={mapLegendOf(list)} className="absolute right-3 bottom-6 max-w-[calc(100%-28rem)]" />
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GroupedCompactList />
          </div>
        </aside>
      ) : (
        <Button
          variant="outline"
          className="absolute top-3 left-3 z-10 bg-background shadow-lg"
          onClick={() => setIsPanelOpen(true)}
        >
          <ListIcon />
          {LIST_LABEL[list]} · {postings.length}
        </Button>
      )}
    </div>
  );
}
