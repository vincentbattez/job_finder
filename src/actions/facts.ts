import { z } from 'zod/v4';

import { PROFILE_FILE_NAME_SCHEMA, SECTION_SCHEMA, type Section } from '#/domain/index.ts';
import { readSections, writeSections } from '#/profile/facts.ts';

import type { ActionContext } from './context.ts';

const FACTS_FILE_NAME = PROFILE_FILE_NAME_SCHEMA.parse('facts.md');

// The form sends every section it shows; a list emptied of its entries sends none
const ENTRY_LIST_BY_TITLE_SCHEMA = z.record(z.string(), z.array(z.string()));
const FACTS_INPUT_SCHEMA = z.object({ entryListByTitle: ENTRY_LIST_BY_TITLE_SCHEMA });

// facts.md stays the source of the Facts, which jf profile writes too: the form reads and rewrites its
// sections, and keeps the rest of the file as written
export function createFactsActions({ workspace, findCandidate }: ActionContext) {
  const readFactsMarkdown = (candidateId: string): string =>
    workspace.readProfileFiles(candidateId).find(({ fileName }) => fileName === FACTS_FILE_NAME)?.markdown ?? '';

  return {
    async readFacts(rawInput: unknown): Promise<Section[]> {
      const candidate = await findCandidate(rawInput);
      return z.array(SECTION_SCHEMA).parse(readSections(readFactsMarkdown(candidate.id)));
    },

    async saveFacts(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const { entryListByTitle } = FACTS_INPUT_SCHEMA.parse(rawInput);
      const sectionList = Object.entries(entryListByTitle).map(([title, entryList]) => ({ title, entryList }));
      workspace.saveProfileFile(
        candidate.id,
        FACTS_FILE_NAME,
        writeSections(readFactsMarkdown(candidate.id), sectionList),
      );
    },
  };
}
