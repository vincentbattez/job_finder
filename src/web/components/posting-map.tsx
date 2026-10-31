import type { LatLngTuple, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { showStatus, type Step } from './badge.tsx';

import './posting-map.css';

interface IMappedPosting {
  reference: string;
  title: string;
  step: Step;
  isExpired: boolean;
  archivedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
}

interface ILocatedPosting extends IMappedPosting {
  latitude: number;
  longitude: number;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAINLAND_CORNER_LIST: LatLngTuple[] = [
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

// A point per Posting, colored by status like its badge; a click opens its page. The map shows
// metropolitan France, or only the overseas points when the filters leave nothing else.
export function PostingMap({ postingList }: Readonly<{ postingList: IMappedPosting[] }>) {
  const { t } = useTranslation('posting');
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
      const mainlandBounds = leaflet.latLngBounds(MAINLAND_CORNER_LIST);
      const pointList = locatedPostingList.map(({ latitude, longitude }) => leaflet.latLng(latitude, longitude));
      const mainlandPointList = pointList.filter((point) => mainlandBounds.contains(point));
      const shownPointList = mainlandPointList.length > 0 ? mainlandPointList : pointList;
      map.fitBounds(shownPointList.length > 0 ? leaflet.latLngBounds(shownPointList) : mainlandBounds, {
        maxZoom: 11,
        padding: [POINT_STEP * 2, POINT_STEP * 2],
      });
      leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION }).addTo(map);
      for (const locationPostingList of groupByLocation(locatedPostingList)) {
        for (const [index, posting] of locationPostingList.entries()) {
          const shift = (index - (locationPostingList.length - 1) / 2) * POINT_STEP;
          const icon = leaflet.divIcon({
            className: 'posting-map__point',
            iconSize: [POINT_SIZE, POINT_SIZE],
            iconAnchor: [POINT_SIZE / 2 - shift, POINT_SIZE / 2],
          });
          const point = leaflet
            .marker([posting.latitude, posting.longitude], { icon, title: `${posting.title} · ${posting.reference}` })
            .addTo(map);
          point.getElement()?.setAttribute('data-status', showStatus(posting));
          // Archived is a mark beside the status, which the point keeps (ADR-0007)
          if (posting.archivedAt !== null) {
            point.getElement()?.setAttribute('data-archived', '');
          }
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
    <section aria-label={t('mapLabel')} className="posting-map">
      <div ref={containerReference} className="posting-map__canvas" />
      <ul className="posting-map__legend">
        <li className="posting-map__key" data-status="to_apply">
          {t('statusLabelByStatus.to_apply', { ns: 'common' })}
        </li>
        <li className="posting-map__key" data-status="applied">
          {t('statusLabelByStatus.applied', { ns: 'common' })}
        </li>
        <li className="posting-map__key" data-status="invited">
          {t('statusLabelByStatus.invited', { ns: 'common' })}
        </li>
        <li className="posting-map__key" data-status="interviewed">
          {t('statusLabelByStatus.interviewed', { ns: 'common' })}
        </li>
        <li className="posting-map__key" data-status="hired">
          {t('statusLabelByStatus.hired', { ns: 'common' })}
        </li>
        <li className="posting-map__key" data-status="rejected">
          {t('statusLabelByStatus.rejected', { ns: 'common' })}
        </li>
        <li className="posting-map__key" data-status="expired">
          {t('expired', { ns: 'common' })}
        </li>
        <li className="posting-map__key" data-archived="">
          {t('archived', { ns: 'common' })}
        </li>
      </ul>
      {unlocatedCount > 0 && <p className="posting-map__note">{t('unlocatedPostings', { count: unlocatedCount })}</p>}
    </section>
  );
}
