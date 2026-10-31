import { setTimeout } from 'node:timers/promises';

import { z } from 'zod/v4';

import { addResources, textKeyOf } from '#/domain/catalogue/i18n.ts';
import { JOB_DESCRIPTION_SCHEMA, LISTED_POSTING_SCHEMA, type ListedPosting } from '#/domain/index.ts';
import { parameter } from '#/parameter/index.ts';
import { defineSource } from '#/source/index.ts';

// The words of the fake Source, in its own namespace as a real module's (ADR-0010, ADR-0012)
const COPY_EN = {
  titleLabel: 'Searched title',
  failAfterLabel: 'Fails after this many Job Descriptions',
  referencePrefixLabel: 'Prefix of stable references',
};

declare module 'i18next' {
  interface ResourceNamespaceMap {
    fakeSlowSource: typeof COPY_EN;
  }
}

addResources('fakeSlowSource', {
  en: COPY_EN,
  fr: {
    titleLabel: 'Titre recherché',
    failAfterLabel: 'Échoue après ce nombre de Fiches de poste',
    referencePrefixLabel: 'Préfixe de références stables',
  },
});

// As many Postings as a first launch of the PEP imports: enough to check that the result stays short
const SLOW_SOURCE_POSTING_COUNT = 81;
// Long enough for the front to show each step of the progress, short enough for an e2e test
const SEARCH_DURATION_MS = 1500;
const READ_DURATION_MS = 60;

// Every reference the fake Source ever listed: like a real Source, it keeps them published whatever the
// Watch, so none of its Postings is Unpublished
const LISTED_REFERENCE_SET = new Set<string>();

const TITLE_PARAMETER = parameter(z.string().min(1), { label: textKeyOf('fakeSlowSource', 'titleLabel') });
const REFERENCE_PREFIX_PARAMETER = parameter(z.string().optional(), {
  label: textKeyOf('fakeSlowSource', 'referencePrefixLabel'),
});
const FAIL_AFTER_PARAMETER = parameter(z.string().optional(), {
  label: textKeyOf('fakeSlowSource', 'failAfterLabel'),
});

// Stands in for a Source, an external boundary, in the e2e tests: a slow module of the family, without
// network, declared as a real one (ADR-0010). Each search lists Postings never seen before, or always
// the same ones given referencePrefix, and one near-miss Posting, out of the Zone so that nothing is
// queued nor notified; given failAfter, reading fails once that many Job Descriptions are read.
export const createSlowSource = defineSource({
  id: 'slow',
  name: 'Slow Source',
  parameterSchema: z.object({
    title: TITLE_PARAMETER,
    referencePrefix: REFERENCE_PREFIX_PARAMETER,
    failAfter: FAIL_AFTER_PARAMETER,
  }),

  async search({ title, referencePrefix }) {
    await setTimeout(SEARCH_DURATION_MS);
    const runStamp = Date.now();
    const prefix = referencePrefix ?? String(runStamp);
    const matchingList: ListedPosting[] = [];
    for (let number = 1; number <= SLOW_SOURCE_POSTING_COUNT; number += 1) {
      const reference = `${prefix}-${String(number).padStart(3, '0')}`;
      LISTED_REFERENCE_SET.add(reference);
      matchingList.push(
        LISTED_POSTING_SCHEMA.parse({
          reference,
          title: `${title} ${String(number)}`,
          url: null,
          publishedAt: new Date(runStamp),
        }),
      );
    }
    return {
      matchingList,
      nearMissList: [
        LISTED_POSTING_SCHEMA.parse({
          reference: `${prefix}-near`,
          title: `${title} adjoint`,
          url: null,
          publishedAt: new Date(runStamp),
        }),
      ],
      publishedReferenceList: [...LISTED_REFERENCE_SET],
    };
  },

  async readJobDescription(reference, { failAfter }) {
    await setTimeout(READ_DURATION_MS);
    if (failAfter !== undefined && Number(reference.slice(-3)) > Number(failAfter)) {
      throw new Error(`The slow Source failed on ${reference}.`);
    }
    return {
      jobDescription: JOB_DESCRIPTION_SCHEMA.parse({
        deadline: null,
        employer: null,
        workplace: null,
        applicationEmail: null,
        contact1: null,
        contact2: null,
        markdown: `# ${reference}\n`,
      }),
      isInZone: false,
    };
  },
});
