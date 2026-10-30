import type { Veille } from '#/domain/index.ts';
import { wordListOf } from '#/text/index.ts';

import { readFeed, readFicheDePoste } from './acl/talent-soft.ts';
import { createTitleMatcher } from './title.ts';

function normalizeCourtOfAppeal(name: string): string {
  return wordListOf(name).join(' ');
}

// The Source PEP: Place de l'Emploi Public, read through the feed of the DSJ (ADR-0001)
export function createPepSource(httpFetch?: typeof fetch) {
  return {
    // The Offres of the feed whose title matches the criteria, and those that came close
    async search(criteria: Veille['criteria']) {
      const matchTitle = createTitleMatcher(criteria.title);
      const listedOffreList = await readFeed(httpFetch);
      return {
        matchingList: listedOffreList.filter((listedOffre) => matchTitle(listedOffre.title) === 'retained'),
        nearMissList: listedOffreList.filter((listedOffre) => matchTitle(listedOffre.title) === 'near-miss'),
      };
    },

    // Downloads the detail page of an Offre. The Zone is read in the employing court of appeal,
    // never in the department the offer shows, which is sometimes wrong (ADR-0001).
    async readFicheDePoste(reference: string, zone: Veille['zone']) {
      const ficheDePoste = await readFicheDePoste(reference, httpFetch);
      const courtOfAppeal =
        ficheDePoste.courtOfAppeal === null ? null : normalizeCourtOfAppeal(ficheDePoste.courtOfAppeal);
      const isInZone = zone.courtOfAppealList.some((name) => normalizeCourtOfAppeal(name) === courtOfAppeal);
      return { ficheDePoste, isInZone };
    },
  };
}
