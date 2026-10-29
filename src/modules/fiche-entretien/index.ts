import type { IAiModule } from '#/ai-module/index.ts';

import { FICHE_ENTRETIEN_DEFAULT_CONSIGNES } from './consignes.ts';
import { composeFicheEntretienPrompt } from './prompt.ts';

const FICHE_ENTRETIEN_FILE_NAME = 'fiche-entretien.md';

// A Fiche d'entretien starts with its title; its plan is that of the Consignes, which the
// Candidat may change
function findFormatError(markdown: string): string | undefined {
  return markdown.trimStart().startsWith('# ') ? undefined : 'il ne commence pas par un titre de niveau 1 (« # »)';
}

// The Fiche d'entretien of an Offre: a headless Claude session writes a single Markdown file, to
// revise and train before the interview (ADR-0003)
export const FICHE_ENTRETIEN_MODULE = {
  alias: 'fiche',
  fileName: FICHE_ENTRETIEN_FILE_NAME,
  outputFileList: [{ name: FICHE_ENTRETIEN_FILE_NAME, findFormatError }],
  defaultConsignes: FICHE_ENTRETIEN_DEFAULT_CONSIGNES,
  composePrompt: composeFicheEntretienPrompt,
  // The Fiche d'entretien builds on the Recherche retenue of its Offre, and on its Lettre retenue
  // once there is one, to prepare the questions on what the Candidat wrote
  requiredArtefactList: ['recherche'],
  optionalArtefactList: ['lettre'],
  isReadingProfil: true,
} satisfies IAiModule;
