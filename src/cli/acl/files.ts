import { readFileSync } from 'node:fs';

import { type Locale } from '#/actions/i18n.ts';
import { codedError, messageOf } from '#/actions/index.ts';

// A file the Candidate names on the command line, read as text (ADR-0005); the failure in the
// Candidate's locale
export function readTextFile(filePath: string, locale: Locale): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    throw codedError('unreadable_file', { filePath, reason: messageOf(error) }, { locale, cause: error });
  }
}
