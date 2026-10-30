import path from 'node:path';

import { z } from 'zod/v4';

import type { IAiModule } from '#/ai-module/index.ts';
import type { Posting, Recipients } from '#/domain/index.ts';

import { copyAsReadOnlyOriginal } from './acl/files.ts';
import { parseRecipients, readRecipients, RECIPIENTS_FILE_NAME } from './acl/recipients.ts';
import { LETTRE_DEFAULT_INSTRUCTIONS } from './instructions.ts';
import { BROUILLON_FILE_NAME, composeLettrePrompt, LETTRE_FILE_NAME } from './prompt.ts';

export { BROUILLON_FILE_NAME } from './prompt.ts';

// The recipients follow the format of the prompt, and each address is found as is in the field of
// the Posting it cites, so none is invented, even from a field written as free text
function findRecipientsError(json: string, posting: Posting): string | undefined {
  let recipients: Recipients;
  try {
    recipients = parseRecipients(json);
  } catch (error) {
    const detail = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
    return `il ne suit pas le format demandé (${detail})`;
  }
  const addressList = recipients.to === null ? recipients.ccList : [recipients.to, ...recipients.ccList];
  const invented = addressList.find(
    ({ email, source }) => !(posting[source] ?? '').toLowerCase().includes(email.toLowerCase()),
  );
  return invented === undefined
    ? undefined
    : `l'adresse ${invented.email} ne figure pas dans le champ ${invented.source} de l'Offre`;
}

// A Version is a pair: the Brouillon, never modified, so that the tool learns from the corrections
// of the Lettre, its copy
export const LETTRE_MODULE = {
  fileName: LETTRE_FILE_NAME,
  outputFileList: [{ name: BROUILLON_FILE_NAME }, { name: RECIPIENTS_FILE_NAME, findFormatError: findRecipientsError }],
  defaultInstructions: LETTRE_DEFAULT_INSTRUCTIONS,
  composePrompt: composeLettrePrompt,
  // The Lettre builds on the Recherche retenue of its Posting, and learns from the Lettres the
  // Candidate sent: the correction of each Brouillon shows their style
  requiredArtefactList: ['recherche'],
  isReadingProfile: true,
  isReadingSentVersions: true,
  isFrozenOnceApplied: true,

  // The Lettre starts as a copy of the Brouillon, which becomes read-only: no correction, in the
  // front or with jf edit, can reach it
  completeVersion(versionDirectory: string): void {
    copyAsReadOnlyOriginal(
      path.join(versionDirectory, BROUILLON_FILE_NAME),
      path.join(versionDirectory, LETTRE_FILE_NAME),
    );
  },

  readRecipients,
} satisfies IAiModule & { readRecipients: typeof readRecipients };
