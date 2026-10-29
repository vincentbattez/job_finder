import type { IAiModule } from '#/ai-module/index.ts';

import { VISUALISATION_DEFAULT_CONSIGNES } from './consignes.ts';
import { composeVisualisationPrompt } from './prompt.ts';

const VISUALISATION_FILE_NAME = 'visualisation.html';

// A whole HTML page, without a script: the front's sandboxed frame runs none, so a diagram drawn by
// one would never show
function findFormatError(html: string): string | undefined {
  if (!/^<!doctype html>/i.test(html.trimStart()) || !/<\/html>\s*$/i.test(html)) {
    return "ce n'est pas une page HTML complète, de « <!DOCTYPE html> » à « </html> »";
  }
  return /<script\b/i.test(html) ? "il contient un script, que le front n'exécute pas" : undefined;
}

// The Visualisation of an Offre: a headless Claude session writes a single HTML page from the Fiche
// d'entretien retenue, which the front shows (ADR-0003). It is regenerated, never corrected by hand.
export const VISUALISATION_MODULE = {
  fileName: VISUALISATION_FILE_NAME,
  outputFileList: [{ name: VISUALISATION_FILE_NAME, findFormatError }],
  defaultConsignes: VISUALISATION_DEFAULT_CONSIGNES,
  composePrompt: composeVisualisationPrompt,
  requiredArtefactList: ['fiche_entretien'],
} satisfies IAiModule;
