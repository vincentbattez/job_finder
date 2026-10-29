import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { IAiSession } from '#/ai-session/acl/claude-code.ts';

import { EXTRACTION_FILE_NAME, readExtraction } from './acl/extraction.ts';
import { composeExtractionPrompt, EXTRACTION_REQUEST } from './prompt.ts';

const FICHE_DE_POSTE_FILE_NAME = 'fiche-de-poste.md';

// The Source Import Markdown: a Fiche de poste the Candidat found elsewhere (spec « Sources et
// Détection »)
export function createImportSource(aiSession: IAiSession) {
  return {
    // An imported Offre is known by its Fiche de poste, so importing the same file again finds it
    referenceOf(markdown: string): string {
      return `import-${createHash('sha256').update(markdown).digest('hex').slice(0, 10)}`;
    },

    // A headless Claude session, with a fixed prompt, reads the fields of the Fiche de poste. It
    // works in a folder of its own, since the folder of the Offre is named after a title it has
    // yet to find.
    async extract(reference: string, markdown: string) {
      const directory = mkdtempSync(path.join(tmpdir(), 'jf-import-'));
      try {
        writeFileSync(path.join(directory, FICHE_DE_POSTE_FILE_NAME), markdown);
        const session = await aiSession.runHeadless({
          fixedPrompt: composeExtractionPrompt(FICHE_DE_POSTE_FILE_NAME, EXTRACTION_FILE_NAME),
          consignes: EXTRACTION_REQUEST,
          directory,
          readDirectoryList: [],
          outputDirectory: directory,
        });
        if (!session.isSuccess) {
          throw new Error(`L'extraction des champs de la Fiche de poste a échoué : ${session.log} Relancer l'import.`);
        }
        return readExtraction(directory, reference, markdown);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  };
}
