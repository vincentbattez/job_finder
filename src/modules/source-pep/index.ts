import { z } from 'zod/v4';

import { textKeyOf } from '#/domain/catalogue/i18n.ts';
import { parameter } from '#/parameter/index.ts';
import { defineSource } from '#/source/index.ts';

import { readFeed, readJobDescription, readStartDate } from './acl/talent-soft.ts';
import { COPY_NAMESPACE } from './copy.ts';
import { createTitleMatcher } from './title.ts';

// The title is searched as the Source publishes it, in French, whatever the Candidate's locale
const TITLE_PARAMETER = parameter(z.string().min(1), {
  label: textKeyOf(COPY_NAMESPACE, 'titleLabel'),
  placeholder: textKeyOf(COPY_NAMESPACE, 'titlePlaceholder'),
});

// The Source PEP: Place de l'Emploi Public, read through the feed of the DSJ (ADR-0001)
export const PEP = defineSource({
  id: 'pep',
  name: 'Place de l’Emploi Public',
  parameterSchema: z.object({ title: TITLE_PARAMETER }),

  // The Postings of the feed whose title matches that of the Watch, and those that came close
  async search({ title }, httpFetch, locale) {
    const matchTitle = createTitleMatcher(title);
    const listedPostingList = await readFeed(locale, httpFetch);
    return {
      matchingList: listedPostingList.filter((listedPosting) => matchTitle(listedPosting.title) === 'retained'),
      nearMissList: listedPostingList.filter((listedPosting) => matchTitle(listedPosting.title) === 'near-miss'),
      // The feed keeps a Posting past its Deadline, until the site takes it offline (ADR-0001)
      publishedReferenceList: listedPostingList.map(({ reference }) => reference),
    };
  },

  // Downloads the detail page of a Posting
  readJobDescription: (reference, parameters, httpFetch, locale) => readJobDescription(reference, locale, httpFetch),

  // The day the detail page gives under the heading of the vacancy
  readStartDate,
});
