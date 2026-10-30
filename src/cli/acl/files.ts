import { readFileSync } from 'node:fs';

import { messageOf } from '#/actions/index.ts';

// A file the Candidate names on the command line, read as text (ADR-0005)
export function readTextFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    const reason = messageOf(error);
    throw new Error(`Impossible de lire le fichier ${filePath} (${reason}). Vérifier son chemin.`, { cause: error });
  }
}
