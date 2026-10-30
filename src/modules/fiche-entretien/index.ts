import type { IAiModule } from '#/ai-module/index.ts';

import { FICHE_ENTRETIEN_DEFAULT_INSTRUCTIONS } from './instructions.ts';
import { composeFicheEntretienPrompt, FICHE_ENTRETIEN_FILE_NAME } from './prompt.ts';

// A Fiche d'entretien starts with its title; its plan is that of the Instructions, which the
// Candidate may change
function findFormatError(markdown: string): string | undefined {
  return markdown.trimStart().startsWith('# ') ? undefined : 'il ne commence pas par un titre de niveau 1 (« # »)';
}

// The Fiche d'entretien of a Posting: a headless Claude session writes a single Markdown file, to
// revise and train before the interview (ADR-0003)
export const FICHE_ENTRETIEN_MODULE = {
  alias: 'fiche',
  fileName: FICHE_ENTRETIEN_FILE_NAME,
  outputFileList: [{ name: FICHE_ENTRETIEN_FILE_NAME, findFormatError }],
  defaultInstructions: FICHE_ENTRETIEN_DEFAULT_INSTRUCTIONS,
  composePrompt: composeFicheEntretienPrompt,
  // The Fiche d'entretien builds on the Recherche retenue of its Posting, and on its Lettre retenue
  // once there is one, to prepare the questions on what the Candidate wrote
  requiredArtefactList: ['recherche'],
  optionalArtefactList: ['lettre'],
  isReadingProfile: true,
} satisfies IAiModule;
