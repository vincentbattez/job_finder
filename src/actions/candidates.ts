import { z } from 'zod/v4';

import { catalogueOf, DEFAULT_LOCALE, type Catalogue } from '#/domain/catalogue/index.ts';
import {
  DEFAULT_DEADLINE_PERIOD_SCHEMA,
  LOCALE_SCHEMA,
  OBSOLETE_CONFIG_SCHEMA,
  type DefaultDeadlinePeriod,
  type ObsoleteConfig,
} from '#/domain/index.ts';

import type { ActionContext } from './context.ts';

// The identifier names the Candidate's folder and the commands of jf: a slug, which never leads out of
// the data folder
const CANDIDATE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RENAME_INPUT_SCHEMA = z.object({ name: z.string() });

// No screen sets the locale yet (spec #65)
const NEW_CANDIDATE_INPUT_SCHEMA = RENAME_INPUT_SCHEMA.extend({
  id: z.string(),
  locale: LOCALE_SCHEMA.default(DEFAULT_LOCALE),
});

// A field of the front arrives as text
const DEFAULT_DEADLINE_PERIOD_INPUT_SCHEMA = z.object({ months: z.union([z.string(), z.number()]) });

// The identifier and the name come from the front: checked before anything is saved
function parseCandidateId(id: string, { error }: Catalogue): string {
  if (!CANDIDATE_ID_PATTERN.test(id)) {
    throw new Error(error.invalidCandidateId(id));
  }
  return id;
}

function parseName(name: string, { error }: Catalogue): string {
  const trimmedName = name.trim();
  if (trimmedName === '') {
    throw new Error(error.emptyCandidateName);
  }
  return trimmedName;
}

function parseMonths(typedMonths: string | number): number {
  const months = Number(typedMonths);
  if (!Number.isSafeInteger(months) || months < 1) {
    // Shared by every Candidate: in the default locale
    throw new Error(catalogueOf(null).error.invalidDefaultDeadlinePeriod);
  }
  return months;
}

// Any visitor of the front creates or renames a Candidate and sets the Default Deadline Period; no Candidate is
// ever deleted (ADR-0002, ADR-0011)
export function createCandidateActions({ workspace, findCandidate }: ActionContext) {
  return {
    async createCandidate(rawInput: unknown): Promise<void> {
      const input = NEW_CANDIDATE_INPUT_SCHEMA.parse(rawInput);
      // In the locale of the Candidate being created
      const catalogue = catalogueOf(input);
      const candidate = {
        id: parseCandidateId(input.id, catalogue),
        name: parseName(input.name, catalogue),
        locale: input.locale,
      };
      const candidateList = await workspace.listCandidates();
      if (candidateList.some(({ id }) => id === candidate.id)) {
        throw new Error(catalogue.error.duplicateCandidateId(candidate.id));
      }
      await workspace.createCandidate(candidate);
    },

    async renameCandidate(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const name = parseName(RENAME_INPUT_SCHEMA.parse(rawInput).name, catalogueOf(candidate));
      await workspace.renameCandidate(candidate, name);
    },

    readDefaultDeadlinePeriod(): Promise<DefaultDeadlinePeriod> {
      return workspace.readDefaultDeadlinePeriod();
    },

    // Expired follows at once, here, and at their next launch in the other processes (ADR-0011)
    async saveDefaultDeadlinePeriod(rawInput: unknown): Promise<void> {
      const { months } = DEFAULT_DEADLINE_PERIOD_INPUT_SCHEMA.parse(rawInput);
      await workspace.saveDefaultDeadlinePeriod(DEFAULT_DEADLINE_PERIOD_SCHEMA.parse({ months: parseMonths(months) }));
    },

    // The config an older jf left, which jf and the Candidates page say to delete once imported
    findObsoleteConfig(): Promise<ObsoleteConfig> {
      return Promise.resolve(OBSOLETE_CONFIG_SCHEMA.parse({ path: workspace.findObsoleteConfig() }));
    },
  };
}
