import { chmodSync, copyFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import type { IAiModule } from '#/ai-module/index.ts';
import type { Offre, Recipients } from '#/domain/index.ts';

import { parseRecipients, readRecipients, RECIPIENTS_FILE_NAME } from './acl/recipients.ts';
import { LETTRE_DEFAULT_CONSIGNES } from './consignes.ts';
import { composeLettrePrompt } from './prompt.ts';

const BROUILLON_FILE_NAME = 'brouillon.md';
const LETTRE_FILE_NAME = 'lettre.md';

// The recipients follow the format of the prompt, and each address is found as is in the field of
// the Offre it cites, so none is invented, even from a field written as free text
function findRecipientsError(json: string, offre: Offre): string | undefined {
  let recipients: Recipients;
  try {
    recipients = parseRecipients(json);
  } catch (error) {
    const detail = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
    return `il ne suit pas le format demandé (${detail})`;
  }
  const addressList = recipients.to === null ? recipients.ccList : [recipients.to, ...recipients.ccList];
  const invented = addressList.find(
    ({ email, source }) => !(offre[source] ?? '').toLowerCase().includes(email.toLowerCase()),
  );
  return invented === undefined
    ? undefined
    : `l'adresse ${invented.email} ne figure pas dans le champ ${invented.source} de l'Offre`;
}

// The Lettre of an Offre: a headless Claude session writes the Brouillon and the recommended
// recipients (ADR-0003). A Version is a pair: the Brouillon, never modified, and the Lettre the
// Candidat corrects (spec « Versions »).
export const LETTRE_MODULE = {
  fileName: LETTRE_FILE_NAME,
  outputFileList: [{ name: BROUILLON_FILE_NAME }, { name: RECIPIENTS_FILE_NAME, findFormatError: findRecipientsError }],
  defaultConsignes: LETTRE_DEFAULT_CONSIGNES,
  composePrompt: composeLettrePrompt,
  // The Lettre builds on the Recherche retenue of its Offre, and learns from the Lettres the
  // Candidat sent: the correction of each Brouillon shows their style
  requiredArtefactList: ['recherche'],
  isReadingProfil: true,
  isReadingSentVersions: true,
  isFrozenOncePostulee: true,

  // The Lettre starts as a copy of the Brouillon, which becomes read-only: no correction, in the
  // front or with jf edit, can reach it
  completeVersion(versionDirectory: string): void {
    const brouillonPath = path.join(versionDirectory, BROUILLON_FILE_NAME);
    copyFileSync(brouillonPath, path.join(versionDirectory, LETTRE_FILE_NAME));
    chmodSync(brouillonPath, 0o444);
  },

  readRecipients,
} satisfies IAiModule & { readRecipients: typeof readRecipients };
