import { z } from 'zod/v4';

import { PROFIL_FILE_NAME_SCHEMA, RUBRIQUE_SCHEMA, type Rubrique } from '#/domain/index.ts';
import { readRubriques, writeRubriques } from '#/profil/faits.ts';

import type { ActionContext } from './context.ts';

const FAITS_FILE_NAME = PROFIL_FILE_NAME_SCHEMA.parse('faits.md');

// The form sends every rubrique it shows; a list emptied of its entries sends none
const ENTRY_LIST_BY_TITLE_SCHEMA = z.record(z.string(), z.array(z.string()));
const FAITS_INPUT_SCHEMA = z.object({ entryListByTitle: ENTRY_LIST_BY_TITLE_SCHEMA });

// faits.md stays the source of the Faits, which jf profil writes too: the form reads and rewrites its
// rubriques, and keeps the rest of the file as written
export function createFaitsActions({ workspace, findCandidat }: ActionContext) {
  const readFaitsMarkdown = (candidatId: string): string =>
    workspace.readProfilFiles(candidatId).find(({ fileName }) => fileName === FAITS_FILE_NAME)?.markdown ?? '';

  return {
    async readFaits(rawInput: unknown): Promise<Rubrique[]> {
      const candidat = await findCandidat(rawInput);
      return z.array(RUBRIQUE_SCHEMA).parse(readRubriques(readFaitsMarkdown(candidat.id)));
    },

    async saveFaits(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { entryListByTitle } = FAITS_INPUT_SCHEMA.parse(rawInput);
      const rubriqueList = Object.entries(entryListByTitle).map(([title, entryList]) => ({ title, entryList }));
      workspace.saveProfilFile(
        candidat.id,
        FAITS_FILE_NAME,
        writeRubriques(readFaitsMarkdown(candidat.id), rubriqueList),
      );
    },
  };
}
