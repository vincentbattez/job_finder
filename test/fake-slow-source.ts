import { existsSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

import { z } from 'zod/v4';

import { addResources, textKeyOf } from '#/domain/catalogue/i18n.ts';
import { JOB_DESCRIPTION_SCHEMA, LISTED_POSTING_SCHEMA, type ListedPosting } from '#/domain/index.ts';
import { parameter } from '#/parameter/index.ts';
import { defineSource, type SourceFactory } from '#/source/index.ts';

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

// Enough to check that the result stays short; more would only make a Detection cost the other tests
const SLOW_SOURCE_POSTING_COUNT = 21;
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

// While the hold file exists, a Detection of the front stays on its first reads: how
// e2e/detection.test.ts looks at one in progress, without racing it
const HELD_AFTER_READ_COUNT = 3;
const HOLD_POLL_MS = 50;
// A test that dies holding it must not stop the next ones for long
const HOLD_LIMIT_MS = 15_000;

// How long each search and each Job Description read take, the seed of test/seed-front.ts not at all,
// and the file that holds the Detection, for the front's Source
interface ISlowSourceDelays {
  searchMs: number;
  readMs: number;
  holdFilePath?: string | undefined;
}

async function waitWhileExists(filePath: string): Promise<void> {
  const limit = Date.now() + HOLD_LIMIT_MS;
  while (existsSync(filePath) && Date.now() < limit) {
    await setTimeout(HOLD_POLL_MS);
  }
}

// Stands in for a Source, an external boundary, in the e2e tests: a slow module of the family, without
// network, declared as a real one (ADR-0010). Each search lists Postings never seen before, or always
// the same ones given referencePrefix, and one near-miss Posting; given failAfter, reading fails once that many Job Descriptions are read.
export function defineSlowSource({ searchMs, readMs, holdFilePath }: ISlowSourceDelays): SourceFactory {
  return defineSource({
    id: 'slow',
    name: 'Slow Source',
    parameterSchema: z.object({
      title: TITLE_PARAMETER,
      referencePrefix: REFERENCE_PREFIX_PARAMETER,
      failAfter: FAIL_AFTER_PARAMETER,
    }),

    async search({ title, referencePrefix }) {
      await setTimeout(searchMs);
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
      await setTimeout(readMs);
      if (holdFilePath !== undefined && Number(reference.slice(-3)) > HELD_AFTER_READ_COUNT) {
        await waitWhileExists(holdFilePath);
      }
      if (failAfter !== undefined && Number(reference.slice(-3)) > Number(failAfter)) {
        throw new Error(`The slow Source failed on ${reference}.`);
      }
      return JOB_DESCRIPTION_SCHEMA.parse({
        deadline: null,
        startDate: null,
        employer: null,
        workplace: null,
        applicationEmail: null,
        contact1: null,
        contact2: null,
        markdown: `# ${reference}\n`,
      });
    },

    readStartDate: () => null,
  });
}
