import { z } from 'zod/v4';

import { codedError } from '#/domain/coded-error.ts';
import { LOCATION_SCHEMA, type Locale, type Location } from '#/domain/index.ts';
import { wordListOf } from '#/text/index.ts';

const ORIGIN = 'https://geo.api.gouv.fr';

// A GeoJSON point: longitude first
const POINT_SCHEMA = z.object({ coordinates: z.tuple([z.number(), z.number()]) });

// Some communes have no region
const COMMUNE_SCHEMA = z.object({
  nom: z.string(),
  centre: POINT_SCHEMA,
  region: z.object({ nom: z.string() }).optional(),
});

// Accents, case and hyphens set aside: « BOULOGNE SUR MER » is Boulogne-sur-Mer
function normalize(name: string): string {
  return wordListOf(name).join(' ');
}

// Not JSON, or JSON of another shape: API Géo changed, which a code tells rather than a raw
// SyntaxError or ZodError
async function parseCommunes(response: Response, url: string, locale: Locale) {
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw codedError('api_geo_format_changed', { url, problem: String(error) }, { locale, cause: error });
  }
  const parsed = z.array(COMMUNE_SCHEMA).safeParse(body);
  if (!parsed.success) {
    const problem = z.prettifyError(parsed.error);
    throw codedError('api_geo_format_changed', { url, problem }, { locale, cause: parsed.error });
  }
  return parsed.data;
}

// API Géo, the State's directory of communes: no key, and no AI that could invent a location
export function createApiGeo(httpFetch: typeof fetch = fetch) {
  return {
    // The commune named like the city, the most populated one when several are. Its search is
    // fuzzy, so a commune with another name is never taken for the city: null.
    async findLocation(city: string, locale: Locale): Promise<Location | null> {
      const url = `${ORIGIN}/communes?nom=${encodeURIComponent(city)}&fields=nom,centre,region&boost=population&limit=5`;
      let response: Response;
      try {
        response = await httpFetch(url);
      } catch (error) {
        throw codedError('api_geo_unreachable', { url, reason: String(error) }, { locale, cause: error });
      }
      if (response.status !== 200) {
        throw codedError('api_geo_status', { url, status: response.status }, { locale });
      }
      const communeList = await parseCommunes(response, url, locale);
      const commune = communeList.find(({ nom }) => normalize(nom) === normalize(city));
      if (commune === undefined) {
        return null;
      }
      const [longitude, latitude] = commune.centre.coordinates;
      return LOCATION_SCHEMA.parse({ city: commune.nom, region: commune.region?.nom ?? null, latitude, longitude });
    },
  };
}
