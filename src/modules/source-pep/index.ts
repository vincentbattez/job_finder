import { z } from 'zod/v4';

import { parameter } from '#/parameter/index.ts';
import { defineSource } from '#/source/index.ts';
import { wordListOf } from '#/text/index.ts';

import { readFeed, readFicheDePoste } from './acl/talent-soft.ts';
import { createTitleMatcher } from './title.ts';

const TITLE_PARAMETER = parameter(z.string().min(1), { label: 'Titre recherché', placeholder: 'attaché de justice' });

// The Zone is told in courts of appeal: the Hauts-de-France are exactly those of Douai and Amiens
// (ADR-0001)
const COURT_OF_APPEAL_LIST_PARAMETER = parameter(z.array(z.string().min(1)).min(1), {
  label: 'Cours d’appel de la Zone',
  placeholder: 'Douai',
  type: 'list',
});

function normalizeCourtOfAppeal(name: string): string {
  return wordListOf(name).join(' ');
}

// The Source PEP: Place de l'Emploi Public, read through the feed of the DSJ (ADR-0001)
export const PEP = defineSource({
  id: 'pep',
  name: 'Place de l’Emploi Public',
  parameterSchema: z.object({ title: TITLE_PARAMETER, courtOfAppealList: COURT_OF_APPEAL_LIST_PARAMETER }),

  // The Offres of the feed whose title matches that of the Watch, and those that came close
  async search({ title }, httpFetch) {
    const matchTitle = createTitleMatcher(title);
    const listedOffreList = await readFeed(httpFetch);
    return {
      matchingList: listedOffreList.filter((listedOffre) => matchTitle(listedOffre.title) === 'retained'),
      nearMissList: listedOffreList.filter((listedOffre) => matchTitle(listedOffre.title) === 'near-miss'),
    };
  },

  // Downloads the detail page of an Offre. The Zone is read in the employing court of appeal,
  // never in the department the offer shows, which is sometimes wrong (ADR-0001).
  async readFicheDePoste(reference, { courtOfAppealList }, httpFetch) {
    const { ficheDePoste, courtOfAppeal } = await readFicheDePoste(reference, httpFetch);
    const isInZone =
      courtOfAppeal !== null &&
      courtOfAppealList.some((name) => normalizeCourtOfAppeal(name) === normalizeCourtOfAppeal(courtOfAppeal));
    return { ficheDePoste, isInZone };
  },
});
