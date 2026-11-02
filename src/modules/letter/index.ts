import { z } from 'zod/v4';

import type { IAiModule } from '#/ai-module/index.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import type { Locale, Posting, Recipients } from '#/domain/index.ts';

import { parseRecipients, readRecipients, RECIPIENTS_FILE_NAME } from './acl/recipients.ts';
import { composeLetterPrompt, LETTER_FILE_NAME } from './prompt.ts';

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

// The Letter, which the Candidate corrects; its Original, which the Artifact module keeps, lets the tool learn
// from the corrections
export const LETTER_MODULE = {
  fileName: LETTER_FILE_NAME,
  format: 'markdown',
  outputFileList: [{ name: LETTER_FILE_NAME }, { name: RECIPIENTS_FILE_NAME, findFormatError: findRecipientsError }],
  composePrompt: composeLetterPrompt,
  // The Letter builds on the Chosen Research of its Posting, and learns from the Letters the
  // Candidate sent: the correction of each Original shows their style
  requiredArtifactList: ['research'],
  isReadingProfile: true,
  isFrozenOnceApplied: true,
  readRecipients,
} satisfies IAiModule & { readRecipients: typeof readRecipients };
