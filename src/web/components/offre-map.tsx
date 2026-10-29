import 'leaflet/dist/leaflet.css';

import type { LatLngTuple, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { showStatut, type Statut } from './badge.tsx';

interface IMappedOffre {
  reference: string;
  title: string;
  statut: Statut;
  isExpiree: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface ILocatedOffre extends IMappedOffre {
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

function isLocated(offre: IMappedOffre): offre is ILocatedOffre {
  return offre.latitude !== null && offre.longitude !== null;
}

// The Offres of one commune share its coordinates: they are grouped to sit side by side
function groupByPlace(offreList: ILocatedOffre[]): ILocatedOffre[][] {
  const placeList: ILocatedOffre[][] = [];
  for (const offre of offreList) {
    const placeOffreList = placeList.find(
      ([first]) => first?.latitude === offre.latitude && first.longitude === offre.longitude,
    );
    if (placeOffreList === undefined) {
      placeList.push([offre]);
    } else {
      placeOffreList.push(offre);
    }
  }
  return placeList;
}

// A point per Offre, coloured by statut like its badge; a click opens its fiche. The map shows
// metropolitan France, or only the overseas points when the filters leave nothing else.
export function OffreMap({ offreList }: Readonly<{ offreList: IMappedOffre[] }>) {
  const containerReference = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unlocatedCount = offreList.filter((offre) => !isLocated(offre)).length;

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
      const locatedOffreList = offreList.filter((offre) => isLocated(offre));
      // The view comes first: until the map has one, Leaflet holds back the points it is given
      const metropoleBounds = leaflet.latLngBounds(METROPOLE_CORNER_LIST);
      const pointList = locatedOffreList.map(({ latitude, longitude }) => leaflet.latLng(latitude, longitude));
      const metropolePointList = pointList.filter((point) => metropoleBounds.contains(point));
      const shownPointList = metropolePointList.length > 0 ? metropolePointList : pointList;
      map.fitBounds(shownPointList.length > 0 ? leaflet.latLngBounds(shownPointList) : metropoleBounds, {
        maxZoom: 11,
        padding: [POINT_STEP * 2, POINT_STEP * 2],
      });
      leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION }).addTo(map);
      for (const placeOffreList of groupByPlace(locatedOffreList)) {
        for (const [index, offre] of placeOffreList.entries()) {
          const shift = (index - (placeOffreList.length - 1) / 2) * POINT_STEP;
          const icon = leaflet.divIcon({
            className: 'offre-point',
            iconSize: [POINT_SIZE, POINT_SIZE],
            iconAnchor: [POINT_SIZE / 2 - shift, POINT_SIZE / 2],
          });
          const point = leaflet
            .marker([offre.latitude, offre.longitude], { icon, title: `${offre.title} · ${offre.reference}` })
            .addTo(map);
          point.getElement()?.setAttribute('data-statut', showStatut(offre.statut, offre.isExpiree));
          const openFiche = () => void navigate(`/offres/${offre.reference}`);
          point.on('click', openFiche);
          point.on('keypress', ({ originalEvent }) => {
            if (originalEvent.key === 'Enter') {
              openFiche();
            }
          });
        }
      }
    });
    return () => {
      isUnmounted = true;
      map?.remove();
    };
  }, [offreList, navigate]);

  return (
    <section aria-label="Carte des Offres" className="offre-map">
      <div ref={containerReference} className="offre-map__canvas" />
      <ul className="offre-map__legend">
        <li data-statut="a_traiter">À traiter</li>
        <li data-statut="postulee">Postulée</li>
        <li data-statut="expiree">Expirée</li>
        <li data-statut="archivee">Archivée</li>
      </ul>
      {unlocatedCount > 0 && (
        <p className="offre-map__note">
          {unlocatedCount === 1
            ? '1 Offre sans coordonnées n’est pas sur la carte.'
            : `${String(unlocatedCount)} Offres sans coordonnées ne sont pas sur la carte.`}
        </p>
      )}
    </section>
  );
}
