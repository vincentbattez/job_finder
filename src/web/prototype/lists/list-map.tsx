// PROTOTYPE. The map beside every list (Leaflet, as src/web/components/posting-map.tsx): a point per
// Posting in its Step's tone (or the tone a variant gives), synced both ways with the rows: hovering a
// row raises its point and opens its label; hovering or clicking a point highlights its row and scrolls
// the list to it. Leaflet reads the window as it loads: only the browser imports it, in an effect.
import type { LatLngBoundsExpression, LayerGroup, Map as LeafletMap, Marker, PointExpression } from 'leaflet';
import { useEffect, useRef, useState } from 'react';

import { cn } from '#/web/prototype/lib/utils.ts';

import type { IPosting } from '../model.ts';
import { useListController } from './list-context.tsx';
import { distinctivePartOf, STEP_TONE } from './list-model.ts';

type Leaflet = typeof import('leaflet');

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAINLAND_BOUNDS: [number, number][] = [
  [41.3, -5.2],
  [51.1, 9.6],
];
const POINT_SIZE = 14;
const POINT_STEP = POINT_SIZE + 3;

// Quiet tiles: desaturated by day, inverted by night
const TILE_CLASS =
  '[filter:saturate(0.45)_contrast(0.95)] dark:[filter:invert(1)_hue-rotate(180deg)_brightness(0.85)_contrast(0.9)_saturate(0.4)]';
// The point lives in a span: Leaflet positions the marker element itself with a transform
const POINT_CLASS =
  'block size-full rounded-full border-2 border-white shadow-[0_1px_3px_rgb(0_0_0/0.45)] transition-[transform,box-shadow] duration-150 ease-out group-data-[highlight=hover]/marker:scale-150 group-data-[highlight=hover]/marker:shadow-[0_0_0_4px_color-mix(in_oklch,var(--foreground)_22%,transparent)] group-data-[highlight=active]/marker:scale-[1.7] group-data-[highlight=active]/marker:shadow-[0_0_0_5px_color-mix(in_oklch,var(--primary)_40%,transparent)] dark:border-neutral-900 data-archived:opacity-50';
const TOOLTIP_CLASS =
  'w-max max-w-64 rounded-md border-border bg-popover px-2 py-1 font-sans whitespace-normal text-xs font-medium text-popover-foreground shadow-md before:hidden';
const CONTROL_CLASS =
  'bg-muted font-sans [&_.leaflet-bar]:border-border [&_.leaflet-bar]:shadow-sm [&_.leaflet-bar_a]:border-border [&_.leaflet-bar_a]:bg-background [&_.leaflet-bar_a]:text-foreground [&_.leaflet-bar_a:hover]:bg-muted [&_.leaflet-control-attribution]:bg-background/70 [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-control-attribution]:text-muted-foreground [&_.leaflet-control-attribution_a]:text-muted-foreground';

interface ILocated extends IPosting {
  latitude: number;
  longitude: number;
}

function isLocated(posting: IPosting): posting is ILocated {
  return posting.latitude !== null && posting.longitude !== null;
}

// The Postings of one commune share its coordinates: grouped to sit side by side
function groupByLocation(postings: ILocated[]): ILocated[][] {
  const groupByKey = new Map<string, ILocated[]>();
  for (const posting of postings) {
    const key = `${String(posting.latitude)},${String(posting.longitude)}`;
    groupByKey.set(key, [...(groupByKey.get(key) ?? []), posting]);
  }
  return [...groupByKey.values()];
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

interface IListMapProps {
  className?: string;
  // Room the view keeps free for what floats over the map (variant B's panel), in pixels
  paddingTopLeft?: PointExpression;
  paddingBottomRight?: PointExpression;
  zoomPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  // The point's color class; the Step's tone by default
  toneOf?: (posting: IPosting) => string;
}

export function ListMap({
  className,
  paddingTopLeft = [32, 32],
  paddingBottomRight = [32, 32],
  zoomPosition = 'topright',
  toneOf = (posting) => STEP_TONE[posting.step].dot,
}: IListMapProps) {
  const { postings, fitKey, hoveredReference, activeReference, activeOrigin, sheetReference, hover, activate } =
    useListController();
  const containerReference = useRef<HTMLDivElement>(null);
  const mapReference = useRef<{ leaflet: Leaflet; map: LeafletMap; layer: LayerGroup } | null>(null);
  const markerByReference = useRef(new Map<string, Marker>());
  const [isReady, setIsReady] = useState(false);
  // The handlers of the points read the latest callbacks without rebuilding the points
  const latest = useRef({ hover, activate, toneOf, paddingTopLeft, paddingBottomRight, postings });
  latest.current = { hover, activate, toneOf, paddingTopLeft, paddingBottomRight, postings };

  useEffect(() => {
    let isUnmounted = false;
    let map: LeafletMap | undefined;
    let observer: ResizeObserver | undefined;
    void import('leaflet').then((leaflet) => {
      const container = containerReference.current;
      if (isUnmounted || container === null) {
        return;
      }
      map = leaflet.map(container, { zoomSnap: 0.5, zoomControl: false });
      leaflet.control.zoom({ position: zoomPosition, zoomInTitle: 'Zoomer', zoomOutTitle: 'Dézoomer' }).addTo(map);
      leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION, className: TILE_CLASS }).addTo(map);
      map.fitBounds(MAINLAND_BOUNDS);
      const layer = leaflet.layerGroup().addTo(map);
      mapReference.current = { leaflet, map, layer };
      const currentMap = map;
      observer = new ResizeObserver(() => currentMap.invalidateSize());
      observer.observe(container);
      setIsReady(true);
    });
    return () => {
      isUnmounted = true;
      observer?.disconnect();
      map?.remove();
      mapReference.current = null;
      markerByReference.current.clear();
    };
  }, [zoomPosition]);

  // The points, rebuilt when the shown Postings change
  const pointKey = postings
    .map(({ reference, step, archivedAt }) => `${reference}:${step}:${archivedAt === null ? '' : 'a'}`)
    .join('|');
  useEffect(() => {
    const current = mapReference.current;
    if (!isReady || current === null) {
      return;
    }
    const { leaflet, layer } = current;
    layer.clearLayers();
    markerByReference.current.clear();
    for (const group of groupByLocation(latest.current.postings.filter(isLocated))) {
      for (const [index, posting] of group.entries()) {
        const shift = (index - (group.length - 1) / 2) * POINT_STEP;
        const icon = leaflet.divIcon({
          className: 'group/marker',
          html: `<span class="${POINT_CLASS} ${latest.current.toneOf(posting)}"${posting.archivedAt === null ? '' : ' data-archived'}></span>`,
          iconSize: [POINT_SIZE, POINT_SIZE],
          iconAnchor: [POINT_SIZE / 2 - shift, POINT_SIZE / 2],
        });
        const marker = leaflet.marker([posting.latitude, posting.longitude], { icon, keyboard: true }).addTo(layer);
        const label = `${posting.city ?? ''} · ${distinctivePartOf(posting.title)}`;
        marker.bindTooltip(escapeHtml(label.length > 60 ? `${label.slice(0, 58)}…` : label), {
          direction: 'top',
          offset: [shift, -POINT_SIZE / 2 - 4],
          className: TOOLTIP_CLASS,
        });
        marker.on('mouseover', () => latest.current.hover(posting.reference, 'map'));
        marker.on('mouseout', () => latest.current.hover(null, 'map'));
        marker.on('click', () => latest.current.activate(posting.reference, 'map'));
        markerByReference.current.set(posting.reference, marker);
      }
    }
  }, [isReady, pointKey]);

  // The view, fitted again when the list, its tab or its filters change (not when a row leaves)
  useEffect(() => {
    const current = mapReference.current;
    if (!isReady || current === null) {
      return;
    }
    const { leaflet, map } = current;
    const pointList = latest.current.postings
      .filter(isLocated)
      .map(({ latitude, longitude }) => leaflet.latLng(latitude, longitude));
    const mainland = leaflet.latLngBounds(MAINLAND_BOUNDS);
    const mainlandPointList = pointList.filter((point) => mainland.contains(point));
    const shownList = mainlandPointList.length > 0 ? mainlandPointList : pointList;
    const bounds: LatLngBoundsExpression = shownList.length > 0 ? leaflet.latLngBounds(shownList) : mainland;
    map.fitBounds(bounds, {
      maxZoom: 11,
      paddingTopLeft: latest.current.paddingTopLeft,
      paddingBottomRight: latest.current.paddingBottomRight,
    });
  }, [isReady, fitKey]);

  // The highlight: hovered, active (its Sheet open or its point clicked), or none
  useEffect(() => {
    for (const [reference, marker] of markerByReference.current) {
      const highlight =
        reference === hoveredReference
          ? 'hover'
          : reference === activeReference || reference === sheetReference
            ? 'active'
            : null;
      const element = marker.getElement();
      if (highlight === null) {
        element?.removeAttribute('data-highlight');
        marker.setZIndexOffset(0);
      } else {
        element?.setAttribute('data-highlight', highlight);
        marker.setZIndexOffset(highlight === 'hover' ? 2000 : 1000);
      }
      if (reference === hoveredReference) {
        marker.openTooltip();
      } else if (marker.isTooltipOpen()) {
        marker.closeTooltip();
      }
    }
  }, [hoveredReference, activeReference, sheetReference, pointKey, isReady]);

  // A row opened from the list: its point comes into view
  useEffect(() => {
    const current = mapReference.current;
    const marker = activeReference === null ? undefined : markerByReference.current.get(activeReference);
    if (current === null || marker === undefined || activeOrigin !== 'list') {
      return;
    }
    current.map.panInside(marker.getLatLng(), {
      paddingTopLeft: latest.current.paddingTopLeft,
      paddingBottomRight: latest.current.paddingBottomRight,
    });
  }, [activeReference, activeOrigin]);

  const unlocatedCount = postings.filter((posting) => !isLocated(posting)).length;
  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <div
        ref={containerReference}
        className={cn('absolute inset-0 z-0', CONTROL_CLASS)}
        role="region"
        aria-label="Carte des Offres"
      />
      {unlocatedCount > 0 ? (
        <p className="absolute bottom-6 left-3 z-[500] rounded-md bg-background/85 px-2 py-1 text-xs text-muted-foreground shadow-sm">
          {unlocatedCount} sans lieu connu
        </p>
      ) : null}
    </div>
  );
}

// The legend of a map toned by a variant: one dot and its label per tone
export function MapLegend({ items, className }: { items: { dot: string; label: string }[]; className?: string }) {
  return (
    <ul
      className={cn(
        'pointer-events-none z-10 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur',
        className,
      )}
    >
      {items.map(({ dot, label }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', dot)} />
          {label}
        </li>
      ))}
    </ul>
  );
}
