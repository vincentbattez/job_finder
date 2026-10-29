import { FICHE_ENTRETIEN_DEFAULT_CONSIGNES } from './consignes.ts';
import { composeFicheEntretienPrompt, FICHE_ENTRETIEN_SECTION_LIST } from './prompt.ts';

const FICHE_ENTRETIEN_FILE_NAME = 'fiche-entretien.md';

// A Fiche d'entretien follows the plan of the prompt: each of its sections is there
function findFormatError(markdown: string): string | undefined {
  const lineSet = new Set(markdown.split('\n').map((line) => line.trim()));
  const missing = FICHE_ENTRETIEN_SECTION_LIST.find((section) => !lineSet.has(`## ${section}`));
  return missing === undefined ? undefined : `il n'a pas de section « ## ${missing} »`;
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
  requiredArtefactList: ['recherche'] as const,
  optionalArtefactList: ['lettre'] as const,
  isReadingProfil: true,
};
