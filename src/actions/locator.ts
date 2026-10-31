import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedErrorOf, formatError } from '#/domain/coded-error.ts';
import type { ErrorCode } from '#/domain/error.ts';
import { LOCATION_SCHEMA, type Locale, type Location } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';

// The failures of API Géo, a secondary service whose outage leaves the Postings off the map
const API_GEO_FAILURE_SET = new Set<ErrorCode>(['api_geo_unreachable', 'api_geo_status', 'api_geo_format_changed']);

// API Géo only places a Posting on the map: down, it leaves the Postings without coordinates, which
// the next Detection locates (listUnlocatedPostings), and is asked no more by this run, a Detection
// or an extraction (#44)
export function createTolerantLocator(locate: ActionContext['locate']) {
  let outage: unknown;
  return {
    locate: async (city: string | null, locale: Locale): Promise<Location> => {
      if (outage === undefined) {
        try {
          return await locate(city, locale);
        } catch (error) {
          if (!API_GEO_FAILURE_SET.has(codedErrorOf(error).code)) {
            throw error;
          }
          outage = error;
        }
      }
      return LOCATION_SCHEMA.parse({ city, region: null, latitude: null, longitude: null });
    },
    // What the run reports of the outage, with its code, in the Candidate's locale; null without one
    failureFor: (locale: Locale): string | null => {
      return outage === undefined ? null : tFor(locale, 'error')('postingsNotLocated', { reason: formatError(outage) });
    },
  };
}
