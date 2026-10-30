import { z } from 'zod/v4';

import { parameter } from '#/parameter/index.ts';
import { defineSource } from '#/source/index.ts';
import { wordListOf } from '#/text/index.ts';

import { readFeed, readJobDescription } from './acl/talent-soft.ts';
import { createTitleMatcher } from './title.ts';

// The title is searched as the Source publishes it, in French, whatever the Candidate's locale
const TITLE_PARAMETER = parameter(z.string().min(1), {
  label: { fr: 'Titre recherché', en: 'Searched title' },
  placeholder: { fr: 'attaché de justice', en: 'attaché de justice' },
});

// The Zone is told in courts of appeal: the Hauts-de-France are exactly those of Douai and Amiens
// (ADR-0001)
const COURT_OF_APPEAL_LIST_PARAMETER = parameter(z.array(z.string().min(1)).min(1), {
  label: { fr: 'Cours d’appel de la Zone', en: 'Courts of appeal of the Zone' },
  placeholder: { fr: 'Douai', en: 'Douai' },
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

  // The Postings of the feed whose title matches that of the Watch, and those that came close
  async search({ title }, httpFetch, locale) {
    const matchTitle = createTitleMatcher(title);
    const listedPostingList = await readFeed(locale, httpFetch);
    return {
      matchingList: listedPostingList.filter((listedPosting) => matchTitle(listedPosting.title) === 'retained'),
      nearMissList: listedPostingList.filter((listedPosting) => matchTitle(listedPosting.title) === 'near-miss'),
    };
  },

  // Downloads the detail page of a Posting. The Zone is read in the employing court of appeal,
  // never in the department the offer shows, which is sometimes wrong (ADR-0001).
  async readJobDescription(reference, { courtOfAppealList }, httpFetch, locale) {
    const { jobDescription, courtOfAppeal } = await readJobDescription(reference, locale, httpFetch);
    const isInZone =
      courtOfAppeal !== null &&
      courtOfAppealList.some((name) => normalizeCourtOfAppeal(name) === normalizeCourtOfAppeal(courtOfAppeal));
    return { jobDescription, isInZone };
  },
});
