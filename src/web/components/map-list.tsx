import { cn } from 'cn';
import { ListIcon, MapPinIcon, PanelLeftCloseIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Button } from '#/web/components/ui/button.tsx';
import { useIsMobile } from '#/web/hooks/use-mobile.ts';

import { coveredHeightOf, HALF, ListDrawer, PEEK, type SnapPoint } from './list-drawer.tsx';
import { ListMap } from './list-map.tsx';

export interface IMapListItem {
  reference: string;
  title: string;
  employer: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface IMapListGroup<T extends IMapListItem> {
  key: string;
  label: string;
  hint: string;
  // The color its markers take, a state token's background class
  toneClass: string;
  itemList: T[];
}

// What the list's filters bring (containers/list-filters.tsx): their bar, at the head of the panel; the
// extent the map fits to, a Region's, rather than the markers'; a key that fits the view again when it
// changes; and what the list says when a filter empties it
export interface IMapListFiltering {
  toolbar: ReactNode;
  fitCornerList: [[number, number], [number, number]] | undefined;
  fitKey: string;
  empty: ReactNode;
}

// The Posting whose Sheet is open, which the URL names, and how a row or a marker opens another
export interface ISheetSelection {
  selectedReference: string | null;
  onSelect: (reference: string) => void;
}

interface IMapListProperties<T extends IMapListItem> extends ISheetSelection {
  // The list's name, which also names its panel
  label: string;
  groupList: IMapListGroup<T>[];
  legendList: { label: string; toneClass: string }[];
  // The third line of a row: the facts of its list
  renderFacts: (item: T) => ReactNode;
  // What a row offers on its right, such as New's Dismiss and Keep, over the row's own button
  renderActions?: ((item: T) => ReactNode) | undefined;
  // What the panel's head holds under the list's name, such as the Applications tabs
  controls?: ReactNode;
  empty: ReactNode;
  filtering?: IMapListFiltering | undefined;
}

// The panel's width and its inset from the map's edges (DESIGN.md « Layout »)
const PANEL_WIDTH = 400;
const PANEL_INSET = 12;
// The Sheet's width, 30rem, which it covers on the right while it is open (DESIGN.md « Layout »)
const SHEET_WIDTH = 480;

// The row of a Posting brought into view, wherever the list scrolled: at the top of the phone's
// drawer, whose lower part may lie under the screen's edge
function revealRow(reference: string, block: ScrollLogicalPosition = 'nearest') {
  document
    .querySelector(`[data-row-reference="${CSS.escape(reference)}"]`)
    ?.scrollIntoView({ block, behavior: 'smooth' });
}

interface IListGroupsProperties<T extends IMapListItem> {
  groupList: IMapListGroup<T>[];
  renderFacts: (item: T) => ReactNode;
  renderActions: ((item: T) => ReactNode) | undefined;
  empty: ReactNode;
  hoveredReference: string | null;
  activeReference: string | null;
  onHover: (reference: string | null) => void;
  onSelect: (reference: string) => void;
}

// The rows by groups, under a sticky heading each, as the panel and the phone's drawer both show them
function ListGroups<T extends IMapListItem>({
  groupList,
  renderFacts,
  renderActions,
  empty,
  hoveredReference,
  activeReference,
  onHover,
  onSelect,
}: Readonly<IListGroupsProperties<T>>) {
  const { t } = useTranslation('lists');
  if (groupList.length === 0) {
    return (
      <p className="m-4 rounded-2xl border border-dashed p-6 text-center text-body text-muted-foreground">{empty}</p>
    );
  }
  return (
    <>
      {groupList.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h2 className="sticky top-0 z-10 flex max-w-none items-baseline gap-2 border-b bg-muted/95 px-4 py-1.5 font-sans text-label font-semibold tracking-normal backdrop-blur">
            <span aria-hidden className={cn('size-2 shrink-0 self-center rounded-full', group.toneClass)} />
            {group.label}
            <span className="font-normal text-muted-foreground tabular-nums">{group.itemList.length}</span>
            {group.hint !== '' && <span className="ml-auto font-normal text-muted-foreground">{group.hint}</span>}
          </h2>
          <ul className="divide-y border-b">
            {group.itemList.map((item) => (
              <li
                key={item.reference}
                data-row-reference={item.reference}
                data-highlighted={item.reference === hoveredReference ? '' : undefined}
                data-active={item.reference === activeReference ? '' : undefined}
                onMouseEnter={() => {
                  onHover(item.reference);
                }}
                onMouseLeave={() => {
                  onHover(null);
                }}
                className="relative flex scroll-my-10 items-center gap-3 px-4 py-3 transition-colors duration-150 data-active:bg-primary/[0.07] data-active:shadow-[inset_3px_0_0_var(--primary)] data-highlighted:bg-muted/70"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-body">
                    <MapPinIcon aria-hidden className="size-3.5 shrink-0 text-primary" />
                    <span className="shrink-0 font-semibold">{item.city ?? t('unknownCity')}</span>
                    {item.employer !== null && (
                      <span className="truncate text-label text-muted-foreground">· {item.employer}</span>
                    )}
                  </p>
                  <Link
                    to={`/postings/${item.reference}`}
                    title={item.title}
                    className="relative z-[1] mt-1 block truncate text-body text-foreground/85 underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {item.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label">{renderFacts(item)}</div>
                </div>
                {renderActions !== undefined && (
                  <div className="relative z-[1] flex shrink-0 items-center gap-1">{renderActions(item)}</div>
                )}
                {/* The whole row opens its Sheet; the title above it opens the Posting's page */}
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item.reference);
                  }}
                  className="absolute inset-0 cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <span className="sr-only">{t('openSheet')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

// The map-first list every list is built on (spec #125 « Lists », DESIGN.md « Map-first list »): the map
// fills the page, the list floats over it in a panel that folds away, by groups, each row leading with
// its City. Rows and markers stay in step: hovering one raises the other, and a row shown on the map
// centers its marker. A row or a marker opens its Posting's Sheet, the map centering it in what the list
// and the Sheet leave visible. On a phone the list is a drawer over the map instead, and a marker only
// raises the drawer to its row: the Sheet, the whole screen wide there, would hide both (spec #125 story 38).
export function MapList<T extends IMapListItem>({
  label,
  groupList,
  legendList,
  renderFacts,
  renderActions,
  controls,
  empty,
  filtering,
  selectedReference,
  onSelect,
}: Readonly<IMapListProperties<T>>) {
  const { t } = useTranslation('lists');
  const isMobile = useIsMobile();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [snapPoint, setSnapPoint] = useState<SnapPoint>(PEEK);
  const [hoveredReference, setHoveredReference] = useState<string | null>(null);
  // The active Posting, at once on a click, and again when the URL names another, as Back does; each
  // change of the nonce centers the map on it, a link opening a Sheet included
  const [active, setActive] = useState({ reference: selectedReference, nonce: selectedReference === null ? 0 : 1 });
  const [shownReference, setShownReference] = useState(selectedReference);
  if (selectedReference !== shownReference) {
    setShownReference(selectedReference);
    if (selectedReference !== active.reference) {
      setActive(({ nonce }) => ({
        reference: selectedReference,
        nonce: selectedReference === null ? nonce : nonce + 1,
      }));
    }
  }
  const count = groupList.reduce((total, { itemList }) => total + itemList.length, 0);
  const pointList = groupList.flatMap(({ key, toneClass, itemList }) =>
    itemList.map(({ reference, title, city, latitude, longitude }) => ({
      reference,
      latitude,
      longitude,
      label: `${city ?? t('unknownCity')} · ${title}`,
      group: key,
      toneClass,
    })),
  );

  function hoverFromMap(reference: string | null) {
    setHoveredReference(reference);
    if (reference !== null) {
      revealRow(reference);
    }
  }

  function activate(reference: string) {
    setActive(({ nonce }) => ({ reference, nonce: nonce + 1 }));
  }

  function select(reference: string) {
    activate(reference);
    onSelect(reference);
  }

  function selectFromMap(reference: string) {
    if (isMobile) {
      activate(reference);
      setSnapPoint((current) => (current === PEEK ? HALF : current));
      revealRow(reference, 'start');
      return;
    }
    select(reference);
    revealRow(reference);
  }

  const legend = (
    <ul
      aria-label={t('legendLabel')}
      className={cn(
        'flex flex-wrap gap-x-3 gap-y-1 text-label text-muted-foreground',
        !isMobile &&
          'pointer-events-none absolute right-3 bottom-6 z-10 max-w-[calc(100%-1.5rem)] rounded-full bg-background/90 px-3 py-1.5 shadow-whisper ring-1 ring-border backdrop-blur md:max-w-[calc(100%-27rem)]',
      )}
    >
      {legendList.map(({ label: legendLabel, toneClass }) => (
        <li key={legendLabel} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-2.5 rounded-full', toneClass)} />
          {legendLabel}
        </li>
      ))}
    </ul>
  );
  const groups = (
    <ListGroups
      groupList={groupList}
      renderFacts={renderFacts}
      renderActions={renderActions}
      empty={filtering?.empty ?? empty}
      hoveredReference={hoveredReference}
      activeReference={active.reference}
      onHover={setHoveredReference}
      onSelect={select}
    />
  );

  let list: ReactNode;
  if (isMobile) {
    list = (
      <ListDrawer
        label={label}
        count={count}
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        head={
          <>
            {legend}
            {controls}
            {filtering?.toolbar}
          </>
        }
      >
        {groups}
      </ListDrawer>
    );
  } else if (isPanelOpen) {
    list = (
      <>
        {legend}
        {/* Until React knows the screen's width, a phone shows the map alone rather than this panel */}
        <aside
          aria-label={label}
          className="absolute top-3 bottom-3 left-3 z-10 flex w-[400px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border bg-background/95 shadow-float backdrop-blur max-md:hidden supports-[backdrop-filter]:bg-background/85"
        >
          <div className="flex flex-col gap-2.5 border-b px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-body font-semibold">
                {label} <span className="font-normal text-muted-foreground tabular-nums">· {count}</span>
              </p>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setIsPanelOpen(false);
                }}
                aria-label={t('fold')}
              >
                <PanelLeftCloseIcon />
              </Button>
            </div>
            {controls}
            {filtering?.toolbar}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{groups}</div>
        </aside>
      </>
    );
  } else {
    list = (
      <>
        {legend}
        <Button
          variant="outline"
          className="absolute top-3 left-3 z-10 bg-background shadow-lg"
          onClick={() => {
            setIsPanelOpen(true);
          }}
        >
          <ListIcon />
          {t('count', { label, count })}
        </Button>
      </>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <ListMap
        className="absolute inset-0"
        pointList={pointList}
        hoveredReference={hoveredReference}
        activeReference={active.reference}
        focusNonce={active.nonce}
        coveredLeft={!isMobile && isPanelOpen ? PANEL_WIDTH + PANEL_INSET : 0}
        coveredRight={isMobile || active.reference === null ? 0 : SHEET_WIDTH}
        coveredBottom={isMobile ? coveredHeightOf(snapPoint) : 0}
        fitCornerList={filtering?.fitCornerList}
        fitKey={filtering?.fitKey ?? ''}
        onHover={hoverFromMap}
        onSelect={selectFromMap}
      />
      {list}
    </div>
  );
}
