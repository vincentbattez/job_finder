// A Region's extent, [[south, west], [north, east]], by the name API Géo gives it: filtering by a Region
// shows the whole Region, not only its Postings (spec #125 « Lists »)
type Bounds = [[number, number], [number, number]];

const BOUNDS_BY_REGION: Record<string, Bounds> = {
  'Auvergne-Rhône-Alpes': [
    [44.11, 2.06],
    [46.81, 7.19],
  ],
  'Bourgogne-Franche-Comté': [
    [46.15, 2.85],
    [48.4, 7.15],
  ],
  Bretagne: [
    [47.28, -5.14],
    [48.9, -1.01],
  ],
  'Centre-Val de Loire': [
    [46.35, 0.05],
    [48.94, 3.13],
  ],
  Corse: [
    [41.33, 8.53],
    [43.03, 9.56],
  ],
  'Grand Est': [
    [47.42, 3.38],
    [50.17, 8.24],
  ],
  'Hauts-de-France': [
    [48.83, 1.38],
    [51.09, 4.26],
  ],
  'Île-de-France': [
    [48.12, 1.44],
    [49.24, 3.56],
  ],
  Normandie: [
    [48.18, -1.95],
    [50.07, 1.8],
  ],
  'Nouvelle-Aquitaine': [
    [42.78, -1.79],
    [47.18, 2.61],
  ],
  Occitanie: [
    [42.33, -0.33],
    [45.05, 4.85],
  ],
  'Pays de la Loire': [
    [46.27, -2.56],
    [48.57, 0.92],
  ],
  "Provence-Alpes-Côte d'Azur": [
    [42.98, 4.23],
    [45.13, 7.72],
  ],
  Guadeloupe: [
    [15.83, -61.81],
    [16.52, -61],
  ],
  Martinique: [
    [14.39, -61.23],
    [14.88, -60.81],
  ],
  Guyane: [
    [2.11, -54.6],
    [5.75, -51.6],
  ],
  'La Réunion': [
    [-21.39, 55.21],
    [-20.87, 55.84],
  ],
  Mayotte: [
    [-13, 45.01],
    [-12.63, 45.3],
  ],
  'Nouvelle-Calédonie': [
    [-22.7, 163.5],
    [-19.5, 168.2],
  ],
};

// With the typographic apostrophe or the straight one
export function regionBoundsOf(region: string): Bounds | undefined {
  return BOUNDS_BY_REGION[region.replaceAll('’', "'")];
}
