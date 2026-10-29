import { createHash } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { FICHE_DE_POSTE_SCHEMA, LISTED_OFFRE_SCHEMA } from '#/domain/index.ts';

import { EXTRACTION_FILE_NAME, readExtraction } from './acl/extraction.ts';
import { composeExtractionPrompt, EXTRACTION_REQUEST } from './prompt.ts';

// The folder of the Offre where the session writes what it read
const EXTRACTION_DIRECTORY_NAME = 'extraction';

// The Source Import Markdown: a Fiche de poste the Candidat found elsewhere (spec « Sources et
// Détection »)
export function createImportSource(aiSession: IAiSession) {
  return {
    // The Offre as the import lists it, before Claude reads its fields: known by the content of its
    // Fiche de poste, so importing the same file again finds it, and named after its file meanwhile
    list(fileName: string, markdown: string) {
      const reference = `import-${createHash('sha256').update(markdown).digest('hex').slice(0, 10)}`;
      return {
        listedOffre: LISTED_OFFRE_SCHEMA.parse({ reference, title: fileName, url: null, publishedAt: null }),
        fiche: FICHE_DE_POSTE_SCHEMA.parse({
          dateLimite: null,
          employer: null,
          workplace: null,
          applicationEmail: null,
          contact1: null,
          contact2: null,
          courtOfAppeal: null,
          markdown,
        }),
      };
    },

    // A headless Claude session, with a fixed prompt, reads the fields of the Fiche de poste in the
    // folder of the Offre. Throws when the session fails or writes an extraction that is not valid.
    async extract(offreDirectory: string, ficheDePoste: string) {
      const outputDirectory = path.join(offreDirectory, EXTRACTION_DIRECTORY_NAME);
      // The extraction of an earlier run never passes for that of this one
      rmSync(outputDirectory, { recursive: true, force: true });
      mkdirSync(outputDirectory);
      const session = await aiSession.runHeadless({
        fixedPrompt: composeExtractionPrompt(path.join(EXTRACTION_DIRECTORY_NAME, EXTRACTION_FILE_NAME)),
        consignes: EXTRACTION_REQUEST,
        directory: offreDirectory,
        readDirectoryList: [],
        outputDirectory,
      });
      if (!session.isSuccess) {
        throw new Error(`Claude Code n'a pas relevé les champs de la Fiche de poste : ${session.log}`);
      }
      return { ...readExtraction(outputDirectory, ficheDePoste), session };
    },
  };
}
