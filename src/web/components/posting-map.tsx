import 'leaflet/dist/leaflet.css';

import type { LatLngTuple, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useCatalogue } from '#/web/catalogue.ts';

import { showStatus, type Status } from './badge.tsx';

interface IMappedPosting {
  reference: string;
  title: string;
  status: Status;
  isExpired: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface ILocatedPosting extends IMappedPosting {
  latitude: number;
  longitude: number;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const METROPOLE_CORNER_LIST: LatLngTuple[] = [
  [41.3, -5.2],
  [51.1, 9.6],
];
const POINT_SIZE = 14;
const POINT_STEP = POINT_SIZE + 4;

function isLocated(posting: IMappedPosting): posting is ILocatedPosting {
  return posting.latitude !== null && posting.longitude !== null;
}

// The Postings of one commune share its coordinates: they are grouped to sit side by side
function groupByLocation(postingList: ILocatedPosting[]): ILocatedPosting[][] {
  const locationList: ILocatedPosting[][] = [];
  for (const posting of postingList) {
    const locationPostingList = locationList.find(
      ([first]) => first?.latitude === posting.latitude && first.longitude === posting.longitude,
    );
    if (locationPostingList === undefined) {
      locationList.push([posting]);
    } else {
      locationPostingList.push(posting);
    }
  }
  return locationList;
}

// A point per Posting, coloured by status like its badge; a click opens its page. The map shows
// metropolitan France, or only the overseas points when the filters leave nothing else.
export function PostingMap({ postingList }: Readonly<{ postingList: IMappedPosting[] }>) {
  const { common } = useCatalogue();
  const containerReference = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unlocatedCount = postingList.filter((posting) => !isLocated(posting)).length;

  useEffect(() => {
    let map: LeafletMap | undefined;
    let isUnmounted = false;
    // Leaflet reads the window as soon as it loads: only the browser imports it
    void import('leaflet').then((leaflet) => {
      if (isUnmounted || containerReference.current === null) {
        return;
      }
      // Half zoom steps, so France fills the map rather than a quarter of Europe
      map = leaflet.map(containerReference.current, { zoomSnap: 0.5 });
      const locatedPostingList = postingList.filter((posting) => isLocated(posting));
      // The view comes first: until the map has one, Leaflet holds back the points it is given
      const metropoleBounds = leaflet.latLngBounds(METROPOLE_CORNER_LIST);
      const pointList = locatedPostingList.map(({ latitude, longitude }) => leaflet.latLng(latitude, longitude));
      const metropolePointList = pointList.filter((point) => metropoleBounds.contains(point));
      const shownPointList = metropolePointList.length > 0 ? metropolePointList : pointList;
      map.fitBounds(shownPointList.length > 0 ? leaflet.latLngBounds(shownPointList) : metropoleBounds, {
        maxZoom: 11,
        padding: [POINT_STEP * 2, POINT_STEP * 2],
      });
      leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION }).addTo(map);
      for (const locationPostingList of groupByLocation(locatedPostingList)) {
        for (const [index, posting] of locationPostingList.entries()) {
          const shift = (index - (locationPostingList.length - 1) / 2) * POINT_STEP;
          const icon = leaflet.divIcon({
            className: 'posting-point',
            iconSize: [POINT_SIZE, POINT_SIZE],
            iconAnchor: [POINT_SIZE / 2 - shift, POINT_SIZE / 2],
          });
          const point = leaflet
            .marker([posting.latitude, posting.longitude], { icon, title: `${posting.title} · ${posting.reference}` })
            .addTo(map);
          point.getElement()?.setAttribute('data-status', showStatus(posting.status, posting.isExpired));
          const openPosting = () => void navigate(`/postings/${posting.reference}`);
          point.on('click', openPosting);
          point.on('keypress', ({ originalEvent }) => {
            if (originalEvent.key === 'Enter') {
              openPosting();
            }
          });
        }
      }
    });
    return () => {
      isUnmounted = true;
      map?.remove();
    };
  }, [postingList, navigate]);

  return (
    <section aria-label="Carte des Offres" className="posting-map">
      <div ref={containerReference} className="posting-map__canvas" />
      <ul className="posting-map__legend">
        <li data-status="to_apply">{common.statusLabelByStatus.to_apply}</li>
        <li data-status="applied">{common.statusLabelByStatus.applied}</li>
        <li data-status="expired">{common.expired}</li>
        <li data-status="archived">{common.statusLabelByStatus.archived}</li>
      </ul>
      {unlocatedCount > 0 && (
        <p className="posting-map__note">
          {unlocatedCount === 1
            ? '1 Offre sans coordonnées n’est pas sur la carte.'
            : `${String(unlocatedCount)} Offres sans coordonnées ne sont pas sur la carte.`}
        </p>
      )}
    </section>
  );
}
