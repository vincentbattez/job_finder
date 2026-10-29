import { readFileSync } from 'node:fs';

// A file the Candidat names on the command line, read as text (ADR-0005)
export function readTextFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Impossible de lire le fichier ${filePath} (${reason}). Vérifier son chemin.`, { cause: error });
  }
}
