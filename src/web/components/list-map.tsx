import { cn } from 'cn';
import type * as LeafletModule from 'leaflet';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface IMapPoint {
  reference: string;
  latitude: number | null;
  longitude: number | null;
  // What its label and its accessible name read, « Lille · Court clerk… »
  label: string;
  // The group whose color it takes, and that color's class
  group: string;
  toneClass: string;
}

interface ILocatedPoint extends IMapPoint {
  latitude: number;
  longitude: number;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAINLAND_CORNER_LIST: [number, number][] = [
  [41.3, -5.2],
  [51.1, 9.6],
];
const POINT_SIZE = 14;
const POINT_STEP = POINT_SIZE + 3;
// Room kept around the points when the view fits them: more on top, where a label opens
const FIT_PADDING = 40;
const FIT_PADDING_TOP = 64;
const FIT_MAX_ZOOM = 11;
// The zoom a Posting brought into view is shown at, unless the Candidate zoomed in further
const FOCUS_ZOOM_MIN = 7;
const FOCUS_ZOOM_MAX = 10;
const FOCUS_DURATION_S = 0.6;
// Above Leaflet's own panes, so a highlighted marker passes over its neighbors
const HOVER_Z_OFFSET = 2000;
const ACTIVE_Z_OFFSET = 1000;

// Quiet tiles (DESIGN.md « Map-first list »): quieted by day, inverted and dimmed by night
const TILE_CLASS =
  '[filter:saturate(0.45)_contrast(0.95)] dark:[filter:invert(1)_hue-rotate(180deg)_brightness(0.85)_contrast(0.9)_saturate(0.4)]';
// The point is a span inside the marker, which Leaflet positions with a transform of its own
const POINT_CLASS =
  'block size-full rounded-full border-2 border-white shadow-marker transition-[scale,box-shadow] duration-150 ease-out group-data-[highlight=hover]/marker:scale-150 group-data-[highlight=hover]/marker:shadow-[var(--shadow-marker),0_0_0_4px_color-mix(in_oklch,var(--foreground)_22%,transparent)] group-data-[highlight=active]/marker:scale-[1.7] group-data-[highlight=active]/marker:shadow-[var(--shadow-marker),0_0_0_5px_color-mix(in_oklch,var(--primary)_40%,transparent)] dark:border-neutral-900';
const TOOLTIP_CLASS =
  'w-max max-w-72 rounded-md border-border bg-popover px-2 py-1 font-sans text-label font-medium whitespace-normal text-popover-foreground shadow-md before:hidden';
const CONTROL_CLASS =
  'bg-muted font-sans [&_.leaflet-bar]:border-border [&_.leaflet-bar]:shadow-whisper [&_.leaflet-bar_a]:border-border [&_.leaflet-bar_a]:bg-background [&_.leaflet-bar_a]:text-foreground [&_.leaflet-bar_a:hover]:bg-muted [&_.leaflet-control-attribution]:bg-background/70 [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-control-attribution]:text-muted-foreground [&_.leaflet-control-attribution_a]:text-muted-foreground';

function isLocated(point: IMapPoint): point is ILocatedPoint {
  return point.latitude !== null && point.longitude !== null;
}

// The Postings of one commune share its coordinates: grouped, they sit side by side
function groupByLocation(pointList: ILocatedPoint[]): ILocatedPoint[][] {
  const groupByKey = new Map<string, ILocatedPoint[]>();
  for (const point of pointList) {
    const key = `${String(point.latitude)},${String(point.longitude)}`;
    groupByKey.set(key, [...(groupByKey.get(key) ?? []), point]);
  }
  return groupByKey.values().toArray();
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function isReducedMotionPreferred(): boolean {
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface IListMapProperties {
  pointList: IMapPoint[];
  hoveredReference: string | null;
  activeReference: string | null;
  // Changes at each activation from the list, even of the same Posting: the map centers on it again
  focusNonce: number;
  // The width the floating list covers on the left, in pixels: the view keeps its points beside it
  coveredLeft: number;
  // The width the open Sheet covers on the right, in pixels
  coveredRight: number;
  // The height the phone's list drawer covers at the bottom, in pixels
  coveredBottom: number;
  // The extent the view fits, a Region's, rather than the points'
  fitCornerList: [[number, number], [number, number]] | undefined;
  // Changes with the list's filters: the view fits again, even after the Candidate moved it
  fitKey: string;
  onHover: (reference: string | null) => void;
  onSelect: (reference: string) => void;
  className?: string;
}

// The map under every list (DESIGN.md « Map-first list »), a custom component in shadcn's spirit: a
// marker per Posting in its group's color, in step with the rows. Leaflet reads the window as it loads:
// only the browser imports it, once React runs.
export function ListMap({
  pointList,
  hoveredReference,
  activeReference,
  focusNonce,
  coveredLeft,
  fitCornerList,
  fitKey,
  coveredRight,
  coveredBottom,
  onHover,
  onSelect,
  className,
}: Readonly<IListMapProperties>) {
  const { t } = useTranslation('lists');
  const containerReference = useRef<HTMLDivElement>(null);
  const mapReference = useRef<{ leaflet: typeof LeafletModule; map: LeafletMap; layer: LayerGroup } | null>(null);
  const markerByReference = useRef(new Map<string, Marker>());
  const [isReady, setIsReady] = useState(false);
  // Once the Candidate moved the view, a resize no longer fits it again
  const userMovedReference = useRef(false);
  // The handlers of the markers read the latest props without rebuilding the markers
  const latest = useRef({ pointList, coveredLeft, coveredRight, coveredBottom, fitCornerList, onHover, onSelect });
  latest.current = { pointList, coveredLeft, coveredRight, coveredBottom, fitCornerList, onHover, onSelect };

  // The view fits the Region filtered, else the points, mainland France first, the overseas ones when alone
  const fitView = useRef(() => {});
  fitView.current = () => {
    const current = mapReference.current;
    if (current === null) {
      return;
    }
    const { leaflet, map } = current;
    const coordinateList = latest.current.pointList
      .filter((point) => isLocated(point))
      .map(({ latitude, longitude }) => leaflet.latLng(latitude, longitude));
    const mainland = leaflet.latLngBounds(MAINLAND_CORNER_LIST);
    const mainlandList = coordinateList.filter((coordinate) => mainland.contains(coordinate));
    const shownList = mainlandList.length > 0 ? mainlandList : coordinateList;
    let bounds = shownList.length > 0 ? leaflet.latLngBounds(shownList) : mainland;
    if (latest.current.fitCornerList !== undefined) {
      bounds = leaflet.latLngBounds(latest.current.fitCornerList);
    }
    map.fitBounds(bounds, {
      maxZoom: FIT_MAX_ZOOM,
      animate: false,
      paddingTopLeft: [latest.current.coveredLeft + FIT_PADDING, FIT_PADDING_TOP],
      paddingBottomRight: [latest.current.coveredRight + FIT_PADDING, latest.current.coveredBottom + FIT_PADDING],
    });
  };

  useEffect(() => {
    let isUnmounted = false;
    let map: LeafletMap | undefined;
    let observer: ResizeObserver | undefined;
    void import('leaflet').then((leaflet) => {
      const container = containerReference.current;
      if (isUnmounted || container === null) {
        return;
      }
      // Fine zoom steps, so a fit fills the map rather than rounding down to a whole level
      map = leaflet.map(container, { zoomSnap: 0.1, zoomDelta: 0.5, zoomControl: false });
      leaflet.control.zoom({ position: 'topright' }).addTo(map);
      leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION, className: TILE_CLASS }).addTo(map);
      map.fitBounds(MAINLAND_CORNER_LIST);
      mapReference.current = { leaflet, map, layer: leaflet.layerGroup().addTo(map) };
      const currentMap = map;
      currentMap.on('dragstart', () => {
        userMovedReference.current = true;
      });
      container.addEventListener(
        'wheel',
        () => {
          userMovedReference.current = true;
        },
        { passive: true },
      );
      observer = new ResizeObserver(() => {
        currentMap.invalidateSize();
        if (!userMovedReference.current) {
          fitView.current();
        }
      });
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
  }, []);

  // The markers, rebuilt when the shown Postings or their groups change, then the view fitted to them
  const pointKey = pointList.map(({ reference, group }) => `${reference}:${group}`).join('|');
  useEffect(() => {
    const current = mapReference.current;
    if (!isReady || current === null) {
      return;
    }
    const { leaflet, layer } = current;
    layer.clearLayers();
    markerByReference.current.clear();
    const locationGroupList = groupByLocation(latest.current.pointList.filter((point) => isLocated(point)));
    for (const locationList of locationGroupList) {
      for (const [index, point] of locationList.entries()) {
        const shift = (index - (locationList.length - 1) / 2) * POINT_STEP;
        const icon = leaflet.divIcon({
          className: 'group/marker',
          html: `<span class="${POINT_CLASS} ${point.toneClass}"></span>`,
          iconSize: [POINT_SIZE, POINT_SIZE],
          iconAnchor: [POINT_SIZE / 2 - shift, POINT_SIZE / 2],
        });
        const marker = leaflet
          .marker([point.latitude, point.longitude], { icon, title: point.label, keyboard: true })
          .addTo(layer);
        marker.getElement()?.setAttribute('data-group', point.group);
        marker.bindTooltip(escapeHtml(point.label), {
          direction: 'top',
          offset: [shift, -POINT_SIZE / 2 - 4],
          className: TOOLTIP_CLASS,
        });
        marker.on('mouseover', () => {
          latest.current.onHover(point.reference);
        });
        marker.on('mouseout', () => {
          latest.current.onHover(null);
        });
        marker.on('click', () => {
          latest.current.onSelect(point.reference);
        });
        markerByReference.current.set(point.reference, marker);
      }
    }
    if (!userMovedReference.current) {
      fitView.current();
    }
  }, [isReady, pointKey]);

  // A filter changed: the view fits what it now shows, wherever the Candidate had moved it
  const fitKeyReference = useRef(fitKey);
  useEffect(() => {
    if (!isReady || fitKeyReference.current === fitKey) {
      return;
    }
    fitKeyReference.current = fitKey;
    userMovedReference.current = false;
    fitView.current();
  }, [isReady, fitKey]);

  // The highlight: hovered, else active, else none; the hovered one opens its label
  useEffect(() => {
    for (const [reference, marker] of markerByReference.current) {
      let highlight: 'hover' | 'active' | null = null;
      if (reference === hoveredReference) {
        highlight = 'hover';
      } else if (reference === activeReference) {
        highlight = 'active';
      }
      const element = marker.getElement();
      if (highlight === null) {
        element?.removeAttribute('data-highlight');
        marker.setZIndexOffset(0);
      } else {
        element?.setAttribute('data-highlight', highlight);
        marker.setZIndexOffset(highlight === 'hover' ? HOVER_Z_OFFSET : ACTIVE_Z_OFFSET);
      }
      if (highlight === 'hover') {
        marker.openTooltip();
      } else if (marker.isTooltipOpen()) {
        marker.closeTooltip();
      }
    }
  }, [hoveredReference, activeReference, pointKey, isReady]);

  // A Posting chosen from the list or the map: its marker centered in what the list and the Sheet leave
  // visible
  useEffect(() => {
    const current = mapReference.current;
    const marker = activeReference === null ? undefined : markerByReference.current.get(activeReference);
    if (focusNonce === 0 || current === null || marker === undefined) {
      return;
    }
    const { map } = current;
    const zoom = Math.min(Math.max(map.getZoom(), FOCUS_ZOOM_MIN), FOCUS_ZOOM_MAX);
    // The center moves by half the difference of the covered widths, and down by half the covered
    // height, so the marker lands in the middle of the rest
    const { coveredLeft: left, coveredRight: right, coveredBottom: bottom } = latest.current;
    const center = map.unproject(
      map.project(marker.getLatLng(), zoom).subtract([(left - right) / 2, -bottom / 2]),
      zoom,
    );
    if (isReducedMotionPreferred()) {
      map.setView(center, zoom, { animate: false });
    } else {
      map.flyTo(center, zoom, { duration: FOCUS_DURATION_S });
    }
    userMovedReference.current = true;
  }, [focusNonce, isReady]);

  const unlocatedCount = pointList.filter((point) => !isLocated(point)).length;
  return (
    <div className={cn('isolate overflow-hidden', className)}>
      <div
        ref={containerReference}
        role="region"
        aria-label={t('mapLabel')}
        className={cn('absolute inset-0 z-0', CONTROL_CLASS)}
      />
      {unlocatedCount > 0 && (
        <p className="absolute right-3 bottom-14 z-10 rounded-md max-md:top-3 max-md:right-auto max-md:bottom-auto max-md:left-3 bg-background/90 px-2 py-1 text-label text-muted-foreground shadow-whisper">
          {t('unlocated', { count: unlocatedCount })}
        </p>
      )}
    </div>
  );
}
