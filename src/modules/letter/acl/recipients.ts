import { readFileSync } from 'node:fs';
import path from 'node:path';

import { RECIPIENTS_SCHEMA, type Recipients } from '#/domain/index.ts';

export const RECIPIENTS_FILE_NAME = 'recipients.json';

// The recommended recipients a session wrote as JSON, parsed into the domain (ADR-0005). Throws
// when the file is not JSON or not in the expected shape.
export function parseRecipients(json: string): Recipients {
  return RECIPIENTS_SCHEMA.parse(JSON.parse(json));
}

export function readRecipients(versionDirectory: string): Recipients {
  return parseRecipients(readFileSync(path.join(versionDirectory, RECIPIENTS_FILE_NAME), 'utf8'));
}
