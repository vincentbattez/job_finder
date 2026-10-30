import { readFileSync } from 'node:fs';

import { messageOf } from '#/actions/index.ts';

// A file the Candidate names on the command line, read as text (ADR-0005); the failure in the words
// the command gives, in the Candidate's locale
export function readTextFile(filePath: string, composeError: (filePath: string, reason: string) => string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(composeError(filePath, messageOf(error)), { cause: error });
  }
}
