import path from 'node:path';

import { z } from 'zod/v4';

import type { IAiModule } from '#/ai-module/index.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import type { Locale, Posting, Recipients } from '#/domain/index.ts';

import { copyAsReadOnlyOriginal } from './acl/files.ts';
import { parseRecipients, readRecipients, RECIPIENTS_FILE_NAME } from './acl/recipients.ts';
import { composeLetterPrompt, DRAFT_FILE_NAME, LETTER_FILE_NAME } from './prompt.ts';

export { DRAFT_FILE_NAME } from './prompt.ts';

// The recipients follow the format of the prompt, and each address is found as is in the field of
// the Posting it cites, so none is invented, even from a field written as free text
function findRecipientsError(json: string, locale: Locale, posting: Posting): string | undefined {
  const t = tFor(locale, 'error');
  let recipients: Recipients;
  try {
    recipients = parseRecipients(json);
  } catch (error) {
    const detail = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
    return t('recipientsFormat', { detail });
  }
  const addressList = recipients.to === null ? recipients.ccList : [recipients.to, ...recipients.ccList];
  const invented = addressList.find(
    ({ email, source }) => !(posting[source] ?? '').toLowerCase().includes(email.toLowerCase()),
  );
  return invented === undefined ? undefined : t('inventedAddress', { email: invented.email, field: invented.source });
}

// A Version is a pair: the Draft, never modified, so that the tool learns from the corrections
// of the Letter, its copy
export const LETTER_MODULE = {
  fileName: LETTER_FILE_NAME,
  outputFileList: [{ name: DRAFT_FILE_NAME }, { name: RECIPIENTS_FILE_NAME, findFormatError: findRecipientsError }],
  composePrompt: composeLetterPrompt,
  // The Letter builds on the Chosen Research of its Posting, and learns from the Letters the
  // Candidate sent: the correction of each Draft shows their style
  requiredArtifactList: ['research'],
  isReadingProfile: true,
  isReadingSentVersions: true,
  isFrozenOnceApplied: true,
  // The Draft stays as the AI wrote it, so that the tool learns from the corrections of the Letter
  readOnlyFileList: [{ name: DRAFT_FILE_NAME, errorCode: 'draft_not_editable' }],

  // The Letter starts as a copy of the Draft, which becomes read-only: no correction, in the
  // front or with jf edit, can reach it
  completeVersion(versionDirectory: string): void {
    copyAsReadOnlyOriginal(path.join(versionDirectory, DRAFT_FILE_NAME), path.join(versionDirectory, LETTER_FILE_NAME));
  },

  readRecipients,
} satisfies IAiModule & { readRecipients: typeof readRecipients };
