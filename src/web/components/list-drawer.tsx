import { cn } from 'cn';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';
import { Drawer, DrawerContent, DrawerTitle } from '#/web/components/ui/drawer.tsx';

// The drawer's first pixels a peek shows over the map: its handle, its head and a glimpse of a row
const PEEK_HEIGHT = 152;
// The page header's height (3.5rem), under which the drawer stops
const HEADER_HEIGHT = 56;
// vaul counts a px snap point from the window's bottom edge
export const PEEK = `${String(PEEK_HEIGHT + HEADER_HEIGHT)}px`;
export const HALF = 0.5;
const FULL = 1;
const SNAP_POINT_LIST = [PEEK, HALF, FULL];

export type SnapPoint = number | string | null;

// The height of the map the drawer covers at a snap point, which the map keeps its points above
export function coveredHeightOf(snapPoint: SnapPoint): number {
  return snapPoint === PEEK ? PEEK_HEIGHT : Math.max(0, globalThis.innerHeight * Number(snapPoint) - HEADER_HEIGHT);
}

// The list of a phone (DESIGN.md « Layout »): a bottom drawer over the full-screen map, never modal so
// the map stays usable, pulled up from a peek to half the screen, then to all of it. Its button steps
// through the same snap points for whoever does not drag. Below the full height the list does not
// scroll, so that a drag anywhere on it raises the drawer.
export function ListDrawer({
  label,
  count,
  snapPoint,
  onSnapPointChange,
  head,
  children,
}: Readonly<{
  label: string;
  count: number;
  snapPoint: SnapPoint;
  onSnapPointChange: (snapPoint: SnapPoint) => void;
  // Under the title: the legend, then the list's own controls and filters
  head: ReactNode;
  children: ReactNode;
}>) {
  const { t } = useTranslation('lists');
  const isFull = snapPoint === FULL;
  return (
    <Drawer
      open
      modal={false}
      dismissible={false}
      snapPoints={SNAP_POINT_LIST}
      activeSnapPoint={snapPoint}
      setActiveSnapPoint={onSnapPointChange}
    >
      {/* vaul 1.1.2 opens its Radix Dialog as a modal whatever `modal` says, which hides the rest of the
          page from assistive technologies and traps the focus. This non-modal Dialog, nearer to the
          content, is the one it reads: the map, the header and the Sheet stay reachable. */}
      <DialogPrimitive.Root open modal={false}>
        <DrawerContent
          aria-describedby={undefined}
          className="h-full bg-background shadow-drawer data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[calc(100svh-3.5rem)]"
          // The map keeps the focus, so that the Candidate goes on browsing it
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <div className="flex flex-col gap-2.5 px-4 pt-2 pb-3">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle className="text-body font-semibold">
                {label} <span className="font-normal text-muted-foreground tabular-nums">· {count}</span>
              </DrawerTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={isFull ? t('collapse') : t('expand')}
                onClick={() => {
                  onSnapPointChange(SNAP_POINT_LIST[SNAP_POINT_LIST.indexOf(snapPoint ?? PEEK) + 1] ?? PEEK);
                }}
              >
                {isFull ? <ChevronDownIcon /> : <ChevronUpIcon />}
              </Button>
            </div>
            {head}
          </div>
          <div
            className={cn('min-h-0 flex-1 border-t', isFull ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden')}
          >
            {/* Below the full height, room under the last rows lets any row come up to the top, the part
                of the drawer on screen */}
            <div className={cn(!isFull && 'pb-[50svh]')}>{children}</div>
          </div>
        </DrawerContent>
      </DialogPrimitive.Root>
    </Drawer>
  );
}
